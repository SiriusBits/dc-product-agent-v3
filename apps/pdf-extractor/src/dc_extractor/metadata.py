"""Utilities for extracting metadata from PDF files."""

from __future__ import annotations

import datetime as _dt
from collections import OrderedDict
from pathlib import Path
from typing import List, Optional, Sequence

from pypdf import PdfReader


def _parse_pdf_date(value: Optional[str]) -> Optional[_dt.datetime]:
    """Parse a PDF date string (D:YYYYMMDDHHmmSSOHH'mm')."""
    if not value:
        return None
    text = str(value).strip()
    if not text:
        return None
    if text.startswith("D:"):
        text = text[2:]
    if len(text) < 4:
        return None

    year = int(text[0:4])
    pos = 4

    def consume(length: int, default: int) -> int:
        nonlocal pos
        if len(text) >= pos + length:
            chunk = text[pos : pos + length]
            if chunk.isdigit():
                pos += length
                return int(chunk)
        return default

    month = consume(2, 1)
    day = consume(2, 1)
    hour = consume(2, 0)
    minute = consume(2, 0)
    second = consume(2, 0)

    tzinfo = None
    if pos < len(text):
        sign = text[pos]
        pos += 1
        if sign in "+-":
            offset_hours = consume(2, 0)
            if pos < len(text) and text[pos] == "'":
                pos += 1
            offset_minutes = consume(2, 0)
            if pos < len(text) and text[pos] == "'":
                pos += 1
            delta = _dt.timedelta(hours=offset_hours, minutes=offset_minutes)
            tzinfo = _dt.timezone(delta if sign == "+" else -delta)
        elif sign in "Zz":
            tzinfo = _dt.timezone.utc
    try:
        return _dt.datetime(year, month, day, hour, minute, second, tzinfo=tzinfo)
    except ValueError:
        return None


def _format_pdf_datetime(value: Optional[str]) -> Optional[str]:
    dt = _parse_pdf_date(value)
    if not dt:
        return None
    suffix = ""
    if dt.tzinfo:
        dt = dt.astimezone(_dt.timezone.utc)
        suffix = " UTC"
    hour12 = dt.hour % 12 or 12
    am_pm = "AM" if dt.hour < 12 else "PM"
    return f"{dt.month}/{dt.day}/{dt.year % 100:02d}, {hour12}:{dt.minute:02d}:{dt.second:02d} {am_pm}{suffix}"


def _split_metadata_list(raw: Optional[str]) -> Optional[List[str]]:
    if raw is None:
        return None
    text = str(raw).strip()
    if not text:
        return None

    tokens: List[str] = []
    current: List[str] = []
    in_quote = False
    for ch in text:
        if ch == '"':
            in_quote = not in_quote
            current.append(ch)
        elif not in_quote and ch in {",", ";"}:
            token = "".join(current).strip()
            if token:
                if token.startswith('"') and token.endswith('"') and len(token) >= 2:
                    token = token[1:-1]
                token = token.strip()
                if token:
                    tokens.append(token)
            current = []
        else:
            current.append(ch)
    token = "".join(current).strip()
    if token:
        if token.startswith('"') and token.endswith('"') and len(token) >= 2:
            token = token[1:-1]
        token = token.strip()
        if token:
            tokens.append(token)

    if not tokens:
        return None

    if len(tokens) > 1 and '"' not in text and ";" not in text and len(tokens) % 2 == 0:
        paired: List[str] = []
        idx = 0
        while idx < len(tokens):
            left = tokens[idx].strip()
            right = tokens[idx + 1].strip()
            if left and right:
                paired.append(f"{left}, {right}")
            idx += 2
        if paired:
            tokens = paired

    seen = set()
    deduped: List[str] = []
    for token in tokens:
        if token not in seen:
            deduped.append(token)
            seen.add(token)
    return deduped


def _read_pdf_version(path: Path) -> Optional[str]:
    with path.open("rb") as fh:
        header = fh.readline().decode("latin1", errors="ignore").strip()
    if header.startswith("%PDF-"):
        version = header[5:].split()[0]
        return version
    return None


def _detect_linearized(path: Path) -> bool:
    with path.open("rb") as fh:
        chunk = fh.read(2048)
    text = chunk.decode("latin1", errors="ignore")
    return "Linearized" in text


def _page_size_string(reader: PdfReader) -> Optional[str]:
    if not reader.pages:
        return None
    box = reader.pages[0].mediabox
    width = float(box.width) / 72.0
    height = float(box.height) / 72.0
    return f"{width:.2f} x {height:.2f} in"


def _human_readable_size(path: Path) -> str:
    size_bytes = path.stat().st_size
    size_kb = size_bytes / 1024
    return f"{size_kb:.2f} KB ({size_bytes:,} Bytes)"


def extract_pdf_metadata(pdf_path: Path) -> OrderedDict:
    """Return document metadata for the given PDF path."""
    reader = PdfReader(str(pdf_path))
    info = reader.metadata or {}

    metadata: "OrderedDict[str, object]" = OrderedDict()
    title = (info.get("/Title") or "").strip()
    if not title:
        title = pdf_path.name
    metadata["document_title"] = title

    authors = _split_metadata_list(info.get("/Author"))
    if authors:
        metadata["author"] = authors

    author_titles = _split_metadata_list(info.get("/AuthorTitle") or info.get("/Author Title"))
    if author_titles:
        metadata["author_title"] = author_titles

    description = (info.get("/Subject") or info.get("/Description") or "").strip()
    if description:
        metadata["description"] = description

    description_writer = _split_metadata_list(
        info.get("/DescriptionWriter") or info.get("/Description Writer")
    )
    if description_writer:
        metadata["description_writer"] = description_writer

    keywords = _split_metadata_list(info.get("/Keywords"))
    if keywords:
        metadata["keywords"] = keywords

    copyright_notice = (
        info.get("/Copyright") or info.get("/Rights") or info.get("/CopyrightNotice") or ""
    ).strip()
    copyright_status = info.get("/CopyrightStatus") or info.get("/Copyright Status")
    if isinstance(copyright_status, str):
        cleaned = copyright_status.strip()
        if cleaned in {"Unknown", "Copyrighted", "Public Domain"}:
            metadata["copyright_status"] = cleaned
        elif cleaned:
            metadata["copyright_status"] = "Copyrighted"
        else:
            metadata["copyright_status"] = "Unknown"
    else:
        metadata["copyright_status"] = "Copyrighted" if copyright_notice else "Unknown"
    if copyright_notice:
        metadata["copyright_notice"] = copyright_notice

    copyright_url = (info.get("/CopyrightURL") or info.get("/Copyright Url") or "").strip()
    if copyright_url:
        metadata["copyright_info"] = copyright_url

    created = _format_pdf_datetime(info.get("/CreationDate"))
    if created:
        metadata["created"] = created

    modified = _format_pdf_datetime(info.get("/ModDate"))
    if modified:
        metadata["modified"] = modified

    application = (info.get("/Creator") or info.get("/Producer") or "").strip()
    if application:
        metadata["application"] = application

    advanced: "OrderedDict[str, object]" = OrderedDict()
    producer = (info.get("/Producer") or "").strip()
    if producer:
        advanced["pdf_producer"] = producer

    version = _read_pdf_version(pdf_path)
    if version:
        advanced["pdf_version"] = version

    advanced["location"] = str(pdf_path.resolve())
    advanced["file_size"] = _human_readable_size(pdf_path)

    page_size = _page_size_string(reader)
    if page_size:
        advanced["page_size"] = page_size

    advanced["number_of_pages"] = len(reader.pages)

    mark_info = None
    try:
        root = reader.trailer.get("/Root")
        if root:
            mark_info = root.get("/MarkInfo")
    except Exception:  # pragma: no cover - PyPDF2 edge cases
        mark_info = None

    tagged = "No"
    if isinstance(mark_info, dict):
        marked_value = mark_info.get("/Marked")
        if isinstance(marked_value, bool):
            tagged = "Yes" if marked_value else "No"
        elif marked_value:
            tagged = "Yes"
    advanced["tagged_pdf"] = tagged

    advanced["fast_web_view"] = "Yes" if _detect_linearized(pdf_path) else "No"

    metadata["advanced"] = advanced
    return metadata


def batch_extract_metadata(paths: Sequence[Path]) -> List[OrderedDict]:
    """Extract metadata for a sequence of PDF paths."""
    return [extract_pdf_metadata(path) for path in paths]


__all__ = [
    "extract_pdf_metadata",
    "batch_extract_metadata",
]
