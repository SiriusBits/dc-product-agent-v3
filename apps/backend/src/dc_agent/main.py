from fastapi import FastAPI
from dc_agent.api.routes import router as api_router

app = FastAPI(
    title="Dixie Chemical Product Agent API",
    description="Backend API for the Agentic RAG application",
    version="0.1.0",
)

from fastapi.staticfiles import StaticFiles
import os

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
