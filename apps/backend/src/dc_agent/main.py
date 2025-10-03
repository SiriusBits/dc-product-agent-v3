"""FastAPI application entry point."""

import logging
import time
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from .api import chat_router, health_router, kg_router, products_router
from .models.api_models import ApiError, ApiResponse

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan manager."""
    # Startup
    logger.info("Starting Dixie Chemical Product Agent API v3.0.0")

    # TODO: Initialize services
    # - Database connections
    # - Vector database connection
    # - Knowledge graph connection
    # - Cache connection

    yield

    # Shutdown
    logger.info("Shutting down Dixie Chemical Product Agent API")

    # TODO: Cleanup services
    # - Close database connections
    # - Close vector database connection
    # - Close knowledge graph connection
    # - Close cache connection


app = FastAPI(
    title="Dixie Chemical Product Agent API",
    description="Agentic RAG API for chemical product information",
    version="3.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)

# Security middleware
app.add_middleware(
    TrustedHostMiddleware, allowed_hosts=["*"]  # TODO: Configure for production
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:4321",  # Astro dev server
        "http://127.0.0.1:4321",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)


# Request timing middleware
@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    """Add processing time to response headers."""
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time
    response.headers["X-Process-Time"] = str(process_time)
    return response


# Exception handlers
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Handle request validation errors."""
    return JSONResponse(
        status_code=422,
        content=ApiError(
            error_code="VALIDATION_ERROR",
            message="Request validation failed",
            details={"errors": exc.errors()},
        ).dict(),
    )


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    """Handle HTTP exceptions."""
    return JSONResponse(
        status_code=exc.status_code,
        content=ApiError(
            error_code="HTTP_ERROR",
            message=exc.detail,
            details={"status_code": exc.status_code},
        ).dict(),
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """Handle general exceptions."""
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content=ApiError(
            error_code="INTERNAL_ERROR",
            message="An internal server error occurred",
            details={"type": type(exc).__name__},
        ).dict(),
    )


# Include routers
app.include_router(health_router, prefix="/api")
app.include_router(chat_router, prefix="/api")
app.include_router(products_router, prefix="/api")
app.include_router(kg_router, prefix="/api")


@app.get("/", response_model=ApiResponse[dict])
async def root() -> ApiResponse[dict]:
    """Root endpoint."""
    return ApiResponse(
        data={
            "name": "Dixie Chemical Product Agent API",
            "version": "3.0.0",
            "description": "Agentic RAG API for chemical product information",
            "docs_url": "/docs",
            "health_url": "/api/health",
        },
        message="Welcome to the Dixie Chemical Product Agent API",
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "dc_agent.main:app", host="0.0.0.0", port=8080, reload=True, log_level="info"
    )
