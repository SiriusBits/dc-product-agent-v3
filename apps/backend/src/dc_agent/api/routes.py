from fastapi import APIRouter, HTTPException
from typing import List
from dc_agent.models.api import QueryRequest, QueryResponse, IngestRequest, Source

router = APIRouter()

from dc_agent.vector.chroma import ChromaVectorStore

# Initialize stores
vector_store = ChromaVectorStore()

@router.post("/query", response_model=QueryResponse)
async def query_endpoint(request: QueryRequest):
    """
    Process a natural language query and return an answer with sources.
    """
    # Query Vector DB
    results = vector_store.query(request.query, n_results=request.top_k)
    
    sources = []
    if results and results.get("ids"):
        ids = results["ids"][0]
        documents = results["documents"][0]
        metadatas = results["metadatas"][0]
        
        for i, doc_id in enumerate(ids):
            sources.append(Source(
                id=doc_id,
                content=documents[i],
                metadata=metadatas[i] or {}
            ))
    
    return QueryResponse(
        answer=f"Found {len(sources)} relevant documents for your query: '{request.query}'",
        sources=sources
    )

@router.post("/ingest")
async def ingest_endpoint(request: IngestRequest):
    """
    Trigger the data ingestion pipeline.
    """
    # Placeholder logic
    return {"status": "ingestion_started", "message": "Ingestion process initiated."}

from dc_agent.kg.neo4j import Neo4jKGStore

kg_store = Neo4jKGStore()

@router.get("/documents")
async def list_documents():
    """
    List available documents/products in the system.
    """
    try:
        results = kg_store.query_graph("MATCH (p:Product) RETURN p.name as name, p.filename as filename")
        documents = [f"{r['name']} ({r['filename']})" for r in results]
        return {"documents": documents}
    except Exception as e:
        # Fallback if KG fails
        return {"documents": [], "error": str(e)}
