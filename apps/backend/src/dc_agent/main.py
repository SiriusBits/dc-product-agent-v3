import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from dc_agent.api.routes import router as api_router
from dc_agent.kg.graphiti_store import GraphitiKGStore
from dc_agent.kg.neo4j import Neo4jKGStore
from dc_agent.kg.schema import init_schema, validate_schema

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown lifecycle hook."""
    # --- startup: Neo4j schema ---
    try:
        async with Neo4jKGStore() as store:
            if await store.verify_connectivity():
                await init_schema(store)
                await validate_schema(store)
            else:
                logger.warning("Neo4j not reachable — skipping schema init")
    except Exception:
        logger.exception("Schema init failed — app will start without KG schema")

    # --- startup: Graphiti episodic memory ---
    graphiti_store = GraphitiKGStore()
    try:
        await graphiti_store._ensure_initialized()
        health = await graphiti_store.health_check()
        logger.info("Graphiti health: %s", health)
    except Exception:
        logger.exception("Graphiti init failed — app will start without episodic memory")
    app.state.graphiti_store = graphiti_store

    yield  # app is running

    # --- shutdown ---
    await graphiti_store.close()
    logger.info("Application shutting down")


app = FastAPI(
    title="Dixie Chemical Product Agent API",
    description="Backend API for the Agentic RAG application",
    version="0.1.0",
    lifespan=lifespan,
)

app.include_router(api_router, prefix="/api/v1")

# Mount static files
# Paths are relative to apps/backend/ where the server runs
PDF_DIR = "../../data/extracts/pdfs"
IMAGES_DIR = "../../data/extracts/images"

# Ensure directories exist to avoid errors
os.makedirs(PDF_DIR, exist_ok=True)
os.makedirs(IMAGES_DIR, exist_ok=True)

app.mount("/static/pdfs", StaticFiles(directory=PDF_DIR), name="pdfs")
app.mount("/static/images", StaticFiles(directory=IMAGES_DIR), name="images")

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "ok", "service": "dc-agent-backend"}

@app.get("/")
async def root():
    """Root endpoint."""
    return {"message": "Welcome to the Dixie Chemical Product Agent API"}
