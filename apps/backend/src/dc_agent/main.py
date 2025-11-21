from fastapi import FastAPI

app = FastAPI(
    title="Dixie Chemical Product Agent API",
    description="Backend API for the Agentic RAG application",
    version="0.1.0",
)

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "ok", "service": "dc-agent-backend"}

@app.get("/")
async def root():
    """Root endpoint."""
    return {"message": "Welcome to the Dixie Chemical Product Agent API"}
