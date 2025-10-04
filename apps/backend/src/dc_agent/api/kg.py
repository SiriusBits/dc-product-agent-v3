"""Knowledge graph query endpoints."""

import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query

from ..kg.service import KnowledgeGraphService
from ..models.api_models import (
    ApiResponse,
    GraphVisualizationData,
    KGQueryRequest,
    KGQueryResponse,
    RetrievalResult,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/kg", tags=["knowledge-graph"])


# Service dependencies
async def get_kg_service() -> KnowledgeGraphService:
    """Get knowledge graph service."""
    service = KnowledgeGraphService()
    if not service._initialized:
        await service.initialize()
    return service


@router.get("/entities/{entity_name}", response_model=ApiResponse[KGQueryResponse])
async def get_entity_neighbors(
    entity_name: str,
    relationship_types: list[str] = Query(
        None, description="Filter by relationship types"
    ),
    max_depth: int = Query(2, ge=1, le=5, description="Maximum traversal depth"),
    limit: int = Query(20, ge=1, le=100, description="Maximum number of results"),
    include_properties: bool = Query(True, description="Include entity properties"),
    kg_service: KnowledgeGraphService = Depends(get_kg_service),
) -> ApiResponse[KGQueryResponse]:
    """Get knowledge graph neighbors for an entity."""
    try:
        logger.info(f"Getting KG neighbors for entity: {entity_name}")

        # Create KG query request
        kg_request = KGQueryRequest(
            entity_name=entity_name,
            relationship_types=relationship_types,
            max_depth=max_depth,
            limit=limit,
            include_properties=include_properties,
        )

        # Query knowledge graph service
        kg_response = await kg_service.get_entity_neighbors(
            entity_name=entity_name,
            relationship_types=relationship_types,
            max_depth=max_depth,
            limit=limit,
        )

        logger.info(f"Found {len(kg_response.related_entities)} related entities and {len(kg_response.relationships)} relationships")

        return ApiResponse(
            data=kg_response,
            message=f"Found knowledge graph data for entity: {entity_name}",
        )

    except Exception as e:
        logger.error(f"Failed to query knowledge graph for {entity_name}: {e}", exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"Failed to query knowledge graph: {str(e)}"
        )


@router.get(
    "/relationships/{relationship_type}", response_model=ApiResponse[list[dict[str, Any]]]
)
async def get_relationships_by_type(
    relationship_type: str,
    limit: int = Query(20, ge=1, le=100),
    include_entities: bool = Query(True, description="Include full entity information"),
    kg_service: KnowledgeGraphService = Depends(get_kg_service),
) -> ApiResponse[list[dict[str, Any]]]:
    """Get all relationships of a specific type."""
    try:
        logger.info(f"Getting relationships of type: {relationship_type}")

        # Query relationships by type
        relationships = await kg_service.query_relationships_by_type(
            relationship_type=relationship_type,
            limit=limit,
            include_entities=include_entities,
        )

        logger.info(f"Found {len(relationships)} relationships of type {relationship_type}")

        return ApiResponse(
            data=relationships,
            message=f"Found {len(relationships)} relationships of type: {relationship_type}",
        )

    except Exception as e:
        logger.error(f"Failed to query relationships of type {relationship_type}: {e}", exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"Failed to query relationships: {str(e)}"
        )


@router.get("/search", response_model=ApiResponse[list[RetrievalResult]])
async def search_entities(
    query: str = Query(..., min_length=1, description="Search query"),
    entity_types: list[str] = Query(None, description="Filter by entity types"),
    limit: int = Query(20, ge=1, le=100),
    min_confidence: float = Query(0.0, ge=0.0, le=1.0, description="Minimum confidence score"),
    kg_service: KnowledgeGraphService = Depends(get_kg_service),
) -> ApiResponse[list[RetrievalResult]]:
    """Search for entities in the knowledge graph."""
    try:
        logger.info(f"Searching KG entities with query: '{query}'")

        # Search entities using knowledge graph service
        entities = await kg_service.search_entities(
            query=query,
            entity_types=entity_types,
            limit=limit,
        )

        # Filter by minimum confidence if specified
        if min_confidence > 0.0:
            entities = [e for e in entities if e.score >= min_confidence]

        logger.info(f"Found {len(entities)} entities matching query")

        return ApiResponse(
            data=entities,
            message=f"Found {len(entities)} entities matching query: {query}",
        )

    except Exception as e:
        logger.error(f"Failed to search entities with query '{query}': {e}", exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"Failed to search entities: {str(e)}"
        )


@router.get("/stats", response_model=ApiResponse[dict[str, Any]])
async def get_kg_statistics(
    kg_service: KnowledgeGraphService = Depends(get_kg_service)
) -> ApiResponse[dict[str, Any]]:
    """Get knowledge graph statistics."""
    try:
        logger.info("Getting knowledge graph statistics")

        # Get statistics from knowledge graph service
        stats = await kg_service.get_statistics()

        logger.info("Knowledge graph statistics retrieved")

        return ApiResponse(
            data=stats,
            message="Knowledge graph statistics retrieved successfully"
        )

    except Exception as e:
        logger.error(f"Failed to get KG statistics: {e}", exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"Failed to get KG statistics: {str(e)}"
        )


@router.post("/validate", response_model=ApiResponse[dict[str, Any]])
async def validate_kg_data(
    kg_service: KnowledgeGraphService = Depends(get_kg_service)
) -> ApiResponse[dict[str, Any]]:
    """Validate knowledge graph data integrity."""
    try:
        logger.info("Starting knowledge graph validation")

        # Perform validation using knowledge graph service
        validation_results = await kg_service.validate_data_integrity()

        logger.info(f"KG validation completed: {validation_results.get('statistics', {}).get('issues_found', 0)} issues found")

        return ApiResponse(
            data=validation_results,
            message="Knowledge graph validation completed successfully"
        )

    except Exception as e:
        logger.error(f"Failed to validate knowledge graph: {e}", exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"Failed to validate knowledge graph: {str(e)}"
        )

@router.get("/entities/{entity_name}/paths/{target_entity}", response_model=ApiResponse[list[dict[str, Any]]])
async def find_entity_paths(
    entity_name: str,
    target_entity: str,
    max_depth: int = Query(3, ge=1, le=6, description="Maximum path length"),
    limit: int = Query(10, ge=1, le=50, description="Maximum number of paths"),
    kg_service: KnowledgeGraphService = Depends(get_kg_service),
) -> ApiResponse[list[dict[str, Any]]]:
    """Find paths between two entities in the knowledge graph."""
    try:
        logger.info(f"Finding paths from {entity_name} to {target_entity}")

        # Find paths using knowledge graph service
        paths = await kg_service.find_paths_between_entities(
            source_entity=entity_name,
            target_entity=target_entity,
            max_depth=max_depth,
            limit=limit,
        )

        logger.info(f"Found {len(paths)} paths between entities")

        return ApiResponse(
            data=paths,
            message=f"Found {len(paths)} paths from {entity_name} to {target_entity}",
        )

    except Exception as e:
        logger.error(f"Failed to find paths between entities: {e}", exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"Failed to find entity paths: {str(e)}"
        )


@router.get("/entities/types", response_model=ApiResponse[list[dict[str, Any]]])
async def list_entity_types(
    kg_service: KnowledgeGraphService = Depends(get_kg_service),
) -> ApiResponse[list[dict[str, Any]]]:
    """Get list of all entity types with counts."""
    try:
        logger.info("Listing entity types")

        # Get entity types from knowledge graph service
        entity_types = await kg_service.get_entity_types()

        logger.info(f"Found {len(entity_types)} entity types")

        return ApiResponse(
            data=entity_types,
            message=f"Found {len(entity_types)} entity types",
        )

    except Exception as e:
        logger.error(f"Failed to list entity types: {e}", exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"Failed to list entity types: {str(e)}"
        )


@router.get("/relationships/types", response_model=ApiResponse[list[dict[str, Any]]])
async def list_relationship_types(
    kg_service: KnowledgeGraphService = Depends(get_kg_service),
) -> ApiResponse[list[dict[str, Any]]]:
    """Get list of all relationship types with counts."""
    try:
        logger.info("Listing relationship types")

        # Get relationship types from knowledge graph service
        relationship_types = await kg_service.get_relationship_types()

        logger.info(f"Found {len(relationship_types)} relationship types")

        return ApiResponse(
            data=relationship_types,
            message=f"Found {len(relationship_types)} relationship types",
        )

    except Exception as e:
        logger.error(f"Failed to list relationship types: {e}", exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"Failed to list relationship types: {str(e)}"
        )


@router.get("/entities/{entity_name}/similar", response_model=ApiResponse[list[RetrievalResult]])
async def find_similar_entities(
    entity_name: str,
    similarity_threshold: float = Query(0.5, ge=0.0, le=1.0, description="Minimum similarity score"),
    limit: int = Query(10, ge=1, le=50, description="Maximum number of similar entities"),
    kg_service: KnowledgeGraphService = Depends(get_kg_service),
) -> ApiResponse[list[RetrievalResult]]:
    """Find entities similar to the specified entity."""
    try:
        logger.info(f"Finding entities similar to: {entity_name}")

        # Find similar entities using knowledge graph service
        similar_entities = await kg_service.find_similar_entities(
            entity_name=entity_name,
            similarity_threshold=similarity_threshold,
            limit=limit,
        )

        logger.info(f"Found {len(similar_entities)} similar entities")

        return ApiResponse(
            data=similar_entities,
            message=f"Found {len(similar_entities)} entities similar to {entity_name}",
        )

    except Exception as e:
        logger.error(f"Failed to find similar entities for {entity_name}: {e}", exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"Failed to find similar entities: {str(e)}"
        )


@router.get("/subgraph/{entity_name}", response_model=ApiResponse[GraphVisualizationData])
async def get_entity_subgraph(
    entity_name: str,
    max_depth: int = Query(2, ge=1, le=4, description="Maximum traversal depth"),
    max_nodes: int = Query(50, ge=5, le=200, description="Maximum number of nodes"),
    relationship_types: list[str] = Query(None, description="Filter by relationship types"),
    kg_service: KnowledgeGraphService = Depends(get_kg_service),
) -> ApiResponse[GraphVisualizationData]:
    """Get a subgraph centered on the specified entity for visualization."""
    try:
        logger.info(f"Getting subgraph for entity: {entity_name}")

        # Get subgraph data from knowledge graph service
        subgraph = await kg_service.get_entity_subgraph(
            entity_name=entity_name,
            max_depth=max_depth,
            max_nodes=max_nodes,
            relationship_types=relationship_types,
        )

        logger.info(f"Generated subgraph with {len(subgraph.nodes)} nodes and {len(subgraph.edges)} edges")

        return ApiResponse(
            data=subgraph,
            message=f"Generated subgraph for {entity_name}",
        )

    except Exception as e:
        logger.error(f"Failed to get subgraph for {entity_name}: {e}", exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"Failed to get entity subgraph: {str(e)}"
        )


@router.post("/query", response_model=ApiResponse[list[dict[str, Any]]])
async def execute_cypher_query(
    query: str = Query(..., description="Cypher query to execute"),
    parameters: dict[str, Any] = Query(None, description="Query parameters"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of results"),
    kg_service: KnowledgeGraphService = Depends(get_kg_service),
) -> ApiResponse[list[dict[str, Any]]]:
    """Execute a custom Cypher query against the knowledge graph."""
    try:
        logger.info(f"Executing custom Cypher query: {query[:100]}...")

        # Validate query for safety (basic checks)
        if any(dangerous in query.upper() for dangerous in ["DELETE", "DROP", "CREATE", "MERGE", "SET"]):
            raise HTTPException(
                status_code=400,
                detail="Dangerous operations not allowed in queries"
            )

        # Execute query using knowledge graph service
        results = await kg_service.execute_cypher_query(
            query=query,
            parameters=parameters or {},
            limit=limit,
        )

        logger.info(f"Query executed successfully, returned {len(results)} results")

        return ApiResponse(
            data=results,
            message=f"Query executed successfully, returned {len(results)} results",
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to execute Cypher query: {e}", exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"Failed to execute query: {str(e)}"
        )


@router.get("/health", response_model=ApiResponse[dict[str, Any]])
async def get_kg_health(
    kg_service: KnowledgeGraphService = Depends(get_kg_service)
) -> ApiResponse[dict[str, Any]]:
    """Get knowledge graph service health status."""
    try:
        logger.info("Checking knowledge graph health")

        # Get health status from knowledge graph service
        health_status = await kg_service.health_check()

        return ApiResponse(
            data=health_status,
            message="Knowledge graph health check completed",
        )

    except Exception as e:
        logger.error(f"Failed to check KG health: {e}", exc_info=True)
        return ApiResponse(
            data={"status": "unhealthy", "error": str(e)},
            message="Knowledge graph health check failed",
        )
