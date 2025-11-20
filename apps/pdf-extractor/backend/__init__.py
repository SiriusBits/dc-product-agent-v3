"""pdf_data_extractor package."""

from importlib.metadata import version, PackageNotFoundError

try:
    __version__ = version("pdf-data-extractor-utility")
except PackageNotFoundError:  # local development fallback
    __version__ = "0.0.0"

__all__ = ["__version__"]
