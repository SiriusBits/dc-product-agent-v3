"""API routes for the DC Agent."""

from .chat import router as chat_router
from .health import router as health_router
from .kg import router as kg_router
from .products import router as products_router

__all__ = ["chat_router", "health_router", "kg_router", "products_router"]