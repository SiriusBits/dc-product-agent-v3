from fastapi import APIRouter, HTTPException, Request
from typing import List
from dc_agent.models.api import QueryRequest, QueryResponse, IngestRequest, Source
from dc_agent.models.products import (
    ProductListResponse,
    ProductDetail,
    ProductPdfResponse,
)
from dc_agent.models.search import SearchRequest, SearchResponse
from dc_agent.services.products import get_product_service
from dc_agent.services.search import get_search_service

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


@router.post("/search", response_model=SearchResponse)
async def search_endpoint(request: SearchRequest):
    """
    Perform semantic search over product documents.
    
    Returns search results with product attribution including:
    - Product ID and name
    - Section name and chunk type
    - Relevance score (0-1, higher is more relevant)
    - Text content of matching chunks
    """
    search_service = get_search_service()
    return search_service.semantic_search(
        query=request.query,
        top_k=request.top_k,
    )


@router.get("/documents")
async def list_documents():
    """
    List available documents/products.
    
    Returns a list of unique product names found in the Vector Store.
    """
    try:
        products = vector_store.list_unique_products()
        return {"documents": products, "count": len(products)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

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


# Product endpoints
@router.get("/products", response_model=ProductListResponse)
async def list_products():
    """
    List all products with summary information.
    
    Returns a list of all products including:
    - Product name and short name
    - Product family and CAS number
    - AI-generated summary
    - Key applications
    """
    product_service = get_product_service()
    return product_service.get_all_products()


@router.get("/products/{product_id}", response_model=ProductDetail)
async def get_product(product_id: str):
    """
    Get full details for a specific product.
    
    Args:
        product_id: The document ID (UUID) of the product
        
    Returns:
        Complete product information including properties, specifications,
        sections, and derived AI analysis.
    """
    product_service = get_product_service()
    product = product_service.get_product_by_id(product_id)
    
    if not product:
        raise HTTPException(status_code=404, detail=f"Product not found: {product_id}")
    
    return product


@router.get("/products/{product_id}/pdf", response_model=ProductPdfResponse)
async def get_product_pdf(product_id: str, request: Request):
    """
    Get the PDF URL for a product's technical bulletin.
    
    Args:
        product_id: The document ID (UUID) of the product
        
    Returns:
        PDF URL and metadata for the product's technical bulletin.
    """
    product_service = get_product_service()
    
    # Build base URL from request
    base_url = str(request.base_url).rstrip("/")
    
    pdf_info = product_service.get_product_pdf(product_id, base_url)
    
    if not pdf_info:
        raise HTTPException(
            status_code=404, 
            detail=f"PDF not found for product: {product_id}"
        )
    
    return pdf_info
