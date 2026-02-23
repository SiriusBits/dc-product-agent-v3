from fastapi import APIRouter, HTTPException, Request
from typing import List
from dc_agent.models.api import QueryRequest, QueryResponse, IngestRequest, Source
from dc_agent.models.products import (
    ProductListResponse,
    ProductDetail,
    ProductPdfResponse,
)
from dc_agent.models.search import SearchRequest, SearchResponse
from dc_agent.models.chat import ChatRequest, ChatResponse
from dc_agent.models.llm import AVAILABLE_MODELS, ModelListResponse
from dc_agent.services.products import get_product_service
from dc_agent.services.search import get_search_service
from dc_agent.services.chat import get_chat_service

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

from dc_agent.kg.graphiti_models import GraphitiSearchResponse


@router.post("/query-kg", response_model=GraphitiSearchResponse)
async def query_kg_endpoint(body: QueryRequest, request: Request):
    """
    Query the Knowledge Graph via Graphiti episodic memory.
    """
    store = getattr(request.app.state, "graphiti_store", None)
    if store is None or not store._initialized:
        raise HTTPException(
            status_code=503,
            detail="Graphiti episodic memory is not available",
        )
    return await store.search(
        query=body.query,
        num_results=body.top_k,
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


# Model listing endpoint
@router.get("/models", response_model=ModelListResponse)
async def list_models():
    """
    List available LLM models for chat generation.
    
    Returns all configured models grouped by provider (Ollama, OpenAI, Anthropic).
    """
    return ModelListResponse(models=AVAILABLE_MODELS, count=len(AVAILABLE_MODELS))


# Chat endpoint
@router.post("/chat", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest):
    """
    Chat with the Dixie Chemical product assistant.
    
    This endpoint uses RAG (Retrieval-Augmented Generation) to:
    1. Search for relevant product information based on the query
    2. Use the selected LLM to generate a contextual response
    3. Return the answer with cited sources
    
    Args:
        request: ChatRequest containing the message, optional conversation history,
                 and optional model_id to select the generation model.
        
    Returns:
        ChatResponse with the generated answer, cited sources, and conversation ID
    """
    chat_service = get_chat_service()
    
    try:
        response = await chat_service.chat(
            query=request.message,
            conversation_history=request.conversation_history,
            conversation_id=request.conversation_id,
            model_id=request.model_id,
        )
        return response
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail=str(e),
        )
    except RuntimeError as e:
        raise HTTPException(
            status_code=503,
            detail=f"Chat service unavailable: {str(e)}"
        )
