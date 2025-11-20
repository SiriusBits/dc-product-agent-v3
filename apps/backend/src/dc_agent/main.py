from fastapi import FastAPI
from dc_agent.api.router import api_router

app = FastAPI(
    title="Dixie Chemical Product Agent",
    description="Agentic RAG API for Dixie Chemical products",
    version="3.0.0",
)

app.include_router(api_router, prefix="/api/v1")

@app.get("/")
async def root():
    return {"message": "Dixie Chemical Product Agent v3 API"}
