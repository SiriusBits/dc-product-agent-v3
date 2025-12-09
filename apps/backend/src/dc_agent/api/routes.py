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

from dc_agent.kg.graphiti_store import GraphitiKGStore

kg_store = GraphitiKGStore()

@router.get("/documents")
async def list_documents():
    """
    List availabe documents/products.
    
    Note: With Graphiti, listing all "Products" is less direct than a Cypher query.
    For now, we return a message or try a broad search. 
    Actually, we can fallback to Chroma for the list or return a static list if known.
    Let's return an empty list with a note for now, as querying all nodes might be expensive or API-limited.
    """
    return {"documents": [], "message": "List documents not fully implemented for Graphiti yet."}

@router.post("/query-kg", response_model=QueryResponse)
async def query_kg_endpoint(request: QueryRequest):
    """
    Specific endpoint to query the Knowledge Graph via Graphiti.
    """
    answer = await kg_store.search(request.query)
    # Convert Graphiti results to string if it's an object
    return QueryResponse(
        answer=str(answer),
        sources=[] 
    )
