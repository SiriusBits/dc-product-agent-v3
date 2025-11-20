from __future__ import annotations

import uuid
from pathlib import Path

import yaml
from PyPDF2 import PdfWriter

from backend.ingest import convert_base_yaml


def create_sample_pdf(path: Path) -> None:
    writer = PdfWriter()
    writer.add_blank_page(width=200, height=200)
    with path.open("wb") as handle:
        writer.write(handle)


def test_convert_base_yaml_generates_hash_and_metadata(tmp_path: Path) -> None:
    pdf_dir = tmp_path / "pdfs"
    pdf_dir.mkdir()
    pdf_path = pdf_dir / "sample.pdf"
    create_sample_pdf(pdf_path)

    constants = {
        "paths": {
            "raw_pdfs_root": str(pdf_dir),
            "processed_pdfs_root": "data/pdf_extracts/v1/pdfs",
            "processed_images_root": "data/pdf_extracts/v1/images",
        },
        "defaults": {"document_type": "Product Technical Bulletin"},
        "extraction": {
            "extractor_version": "1.2.3",
            "default_confidence_scores": {
                "product_info": 100,
                "key_benefits": 100,
                "applications_text": 100,
                "applications": 100,
                "properties_and_specifications": 100,
                "typical_properties": 100,
                "epoxy_resin_properties": 100,
                "other_tables": 100,
                "formulation_data": 100,
                "toxicity_data": 100,
                "sections": 100,
                "images": 100,
                "registrations": 100,
                "document_footnotes": 100,
                "overall": 100,
            },
        },
    }

    yaml_payload = {
        "filename": "sample.pdf",
        "source_filepath": "${paths.raw_pdfs_root}/sample.pdf",
        "filepath": "data/pdf_extracts/v1/pdfs/sample.pdf",
        "manufacturer": "Example Corp",
        "contact_info": {
            "address": "123 Example St",
            "phone": "N/A",
            "fax": None,
            "email": "info@example.com",
        },
        "product_info": {
            "product_name": "Sample",
            "product_short_name": "Sample",
        },
        "registrations": [],
        "key_benefits": [],
        "applications": [],
        "properties_and_specifications": [],
        "typical_properties": {
            "table_name": "Typical Properties",
            "page": 1,
            "data_type": "typical_properties",
            "description": "",
            "row_count": 0,
            "data": [],
        },
        "other_tables": [],
        "formulation_data": [],
        "toxicity_data": [],
        "sections": [],
        "images": [
            {
                "filename": "sample_graph.png",
                "page": 1,
                "type": "graph",
                "description": "Example graph",
                "x_axis": {"label": "Temperature", "unit": "C"},
                "y_axis": {"label": "Viscosity", "unit": "cPs"},
                "graph_data": [],
            }
        ],
        "document_footnotes": {},
        "extraction_metadata": {},
    }

    yaml_path = tmp_path / "Sample_base.yaml"
    with yaml_path.open("w", encoding="utf-8") as handle:
        yaml.safe_dump(yaml_payload, handle, sort_keys=False)

    record = convert_base_yaml(yaml_path, pdf_root=pdf_dir, constants=constants)

    # doc_id should be a valid UUID
    uuid.UUID(record["doc_id"])  # raises if invalid

    assert record["filename"] == "sample.pdf"
    assert record["source_filepath"].endswith("sample.pdf")
    assert record["document_file_metadata"]["advanced"]["number_of_pages"] == 1
    assert record["source_file_hash"]["sha256"]
    assert record["extraction_metadata"]["extractor_version"] == "1.2.3"
    scores = record["extraction_metadata"]["confidence_scores"]
    assert scores["product_info"] == 100
    assert "typical_properties" in scores
    assert isinstance(record["registrations"], list)
    assert record["document_footnotes"] == {}
    assert record["images"][0]["image_path"].endswith("sample/sample_graph.png")
    assert record["has_images"] is True
    assert record["typical_properties"]["table_notes"] == []
