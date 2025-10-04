"""Product browsing and search endpoints."""

import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query

from ..models.api_models import (
    ApiResponse,
    ProductSearchRequest,
    ProductSearchResponse,
    ProductSummary,
)
from ..models.product_models import BaseExtractionDocument
from ..services.product_service import ProductService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/products", tags=["products"])


# Service dependencies
async def get_product_service() -> ProductService:
    """Get product service."""
    service = ProductService()
    if not service._initialized:
        await service.initialize()
    return service


@router.get("/", response_model=ApiResponse[ProductSearchResponse])
async def search_products(
    query: str = Query(None, description="Search query"),
    family: str = Query(None, description="Product family filter"),
    applications: list[str] = Query(None, description="Application filters"),
    limit: int = Query(20, ge=1, le=100, description="Number of results"),
    offset: int = Query(0, ge=0, description="Offset for pagination"),
    sort_by: str = Query("relevance", pattern="^(name|family|relevance)$"),
    sort_order: str = Query("desc", pattern="^(asc|desc)$"),
    product_service: ProductService = Depends(get_product_service),
) -> ApiResponse[ProductSearchResponse]:
    """Search and filter products."""
    try:
        logger.info(f"Product search request: query='{query}', family='{family}', limit={limit}")

        # Create search request
        search_request = ProductSearchRequest(
            query=query,
            family=family,
            applications=applications,
            limit=limit,
            offset=offset,
            sort_by=sort_by,
            sort_order=sort_order,
        )

        # Perform search using product service
        search_response = await product_service.search_products(search_request)

        logger.info(f"Product search completed: {search_response.total_count} results")

        return ApiResponse(
            data=search_response,
            message=f"Found {search_response.total_count} products"
        )

    except Exception as e:
        logger.error(f"Failed to search products: {e}", exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"Failed to search products: {str(e)}"
        )


@router.get("/{product_id}", response_model=ApiResponse[BaseExtractionDocument])
async def get_product(
    product_id: str,
    product_service: ProductService = Depends(get_product_service)
) -> ApiResponse[BaseExtractionDocument]:
    """Get detailed product information by ID."""
    try:
        logger.info(f"Getting product details for: {product_id}")

        # Get product from service
        product = await product_service.get_product_by_id(product_id)

        if not product:
            raise HTTPException(status_code=404, detail=f"Product {product_id} not found")

        logger.info(f"Retrieved product: {product.product_info.product_name}")

        return ApiResponse(
            data=product,
            message="Product retrieved successfully"
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to retrieve product {product_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"Failed to retrieve product: {str(e)}"
        )


@router.get("/{product_id}/related", response_model=ApiResponse[list[ProductSummary]])
async def get_related_products(
    product_id: str,
    limit: int = Query(10, ge=1, le=50),
    product_service: ProductService = Depends(get_product_service),
) -> ApiResponse[list[ProductSummary]]:
    """Get products related to the specified product."""
    try:
        logger.info(f"Getting related products for: {product_id}")

        # Get related products from service
        related_products = await product_service.get_related_products(product_id, limit)

        logger.info(f"Found {len(related_products)} related products")

        return ApiResponse(
            data=related_products,
            message=f"Found {len(related_products)} related products",
        )

    except Exception as e:
        logger.error(f"Failed to get related products for {product_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"Failed to get related products: {str(e)}"
        )


@router.get("/{product_id}/compare/{other_product_id}")
async def compare_products(
    product_id: str,
    other_product_id: str,
    aspects: list[str] = Query(None, description="Comparison aspects"),
    product_service: ProductService = Depends(get_product_service),
) -> ApiResponse[dict[str, Any]]:
    """Compare two products across specified aspects."""
    try:
        logger.info(f"Comparing products: {product_id} vs {other_product_id}")

        # Perform comparison using service
        comparison_data = await product_service.compare_products(
            product_id, other_product_id, aspects
        )

        if "error" in comparison_data:
            raise HTTPException(status_code=400, detail=comparison_data["error"])

        logger.info("Product comparison completed")

        return ApiResponse(
            data=comparison_data,
            message="Product comparison generated successfully"
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to compare products {product_id} vs {other_product_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"Failed to compare products: {str(e)}"
        )


@router.get("/families/", response_model=ApiResponse[list[str]])
async def list_product_families(
    product_service: ProductService = Depends(get_product_service),
) -> ApiResponse[list[str]]:
    """Get list of all product families."""
    try:
        logger.info("Listing product families")

        # Get families from service
        families = await product_service.list_product_families()

        logger.info(f"Found {len(families)} product families")

        return ApiResponse(
            data=families,
            message=f"Found {len(families)} product families"
        )

    except Exception as e:
        logger.error(f"Failed to list product families: {e}", exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"Failed to list product families: {str(e)}"
        )


@router.get("/applications/", response_model=ApiResponse[list[str]])
async def list_applications(
    product_service: ProductService = Depends(get_product_service),
) -> ApiResponse[list[str]]:
    """Get list of all product applications."""
    try:
        logger.info("Listing product applications")

        # Get applications from service
        applications = await product_service.list_applications()

        logger.info(f"Found {len(applications)} applications")

        return ApiResponse(
            data=applications,
            message=f"Found {len(applications)} applications"
        )

    except Exception as e:
        logger.error(f"Failed to list applications: {e}", exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"Failed to list applications: {str(e)}"
        )


@router.post("/search", response_model=ApiResponse[ProductSearchResponse])
async def advanced_product_search(
    request: ProductSearchRequest,
    product_service: ProductService = Depends(get_product_service),
) -> ApiResponse[ProductSearchResponse]:
    """Advanced product search with complex filters."""
    try:
        logger.info(f"Advanced product search: {request.dict()}")

        # Perform search using service
        search_response = await product_service.search_products(request)

        logger.info(f"Advanced search completed: {search_response.total_count} results")

        return ApiResponse(
            data=search_response,
            message=f"Found {search_response.total_count} products"
        )

    except Exception as e:
        logger.error(f"Failed to perform advanced product search: {e}", exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"Failed to perform advanced search: {str(e)}"
        )


@router.get("/{product_id}/properties", response_model=ApiResponse[list[dict[str, Any]]])
async def get_product_properties(
    product_id: str,
    category: str = Query(None, description="Property category filter"),
    product_service: ProductService = Depends(get_product_service),
) -> ApiResponse[list[dict[str, Any]]]:
    """Get detailed properties for a specific product."""
    try:
        logger.info(f"Getting properties for product: {product_id}")

        # Get product details
        product = await product_service.get_product_by_id(product_id)
        if not product:
            raise HTTPException(status_code=404, detail=f"Product {product_id} not found")

        # Extract properties
        properties = []
        for prop in product.properties_and_specifications:
            prop_dict = {
                "category": prop.category,
                "name": prop.name,
                "value_string": prop.value_string,
                "value_numeric": prop.value_numeric,
                "value_min": prop.value_min,
                "value_max": prop.value_max,
                "unit": prop.unit,
                "test_method": prop.test_method,
                "page": prop.page,
            }

            # Apply category filter if specified
            if not category or prop.category.lower() == category.lower():
                properties.append(prop_dict)

        logger.info(f"Retrieved {len(properties)} properties")

        return ApiResponse(
            data=properties,
            message=f"Retrieved {len(properties)} properties"
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get product properties: {e}", exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"Failed to get product properties: {str(e)}"
        )


@router.get("/{product_id}/applications", response_model=ApiResponse[list[str]])
async def get_product_applications(
    product_id: str,
    product_service: ProductService = Depends(get_product_service),
) -> ApiResponse[list[str]]:
    """Get applications for a specific product."""
    try:
        logger.info(f"Getting applications for product: {product_id}")

        # Get product details
        product = await product_service.get_product_by_id(product_id)
        if not product:
            raise HTTPException(status_code=404, detail=f"Product {product_id} not found")

        applications = product.applications

        logger.info(f"Retrieved {len(applications)} applications")

        return ApiResponse(
            data=applications,
            message=f"Retrieved {len(applications)} applications"
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get product applications: {e}", exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"Failed to get product applications: {str(e)}"
        )


@router.get("/stats/", response_model=ApiResponse[dict[str, Any]])
async def get_product_statistics(
    product_service: ProductService = Depends(get_product_service),
) -> ApiResponse[dict[str, Any]]:
    """Get overall product database statistics."""
    try:
        logger.info("Getting product statistics")

        # Get basic statistics
        families = await product_service.list_product_families()
        applications = await product_service.list_applications()

        # TODO: Add more detailed statistics from database
        stats = {
            "total_families": len(families),
            "total_applications": len(applications),
            "families": families[:10],  # Top 10 families
            "applications": applications[:10],  # Top 10 applications
        }

        logger.info("Product statistics retrieved")

        return ApiResponse(
            data=stats,
            message="Product statistics retrieved successfully"
        )

    except Exception as e:
        logger.error(f"Failed to get product statistics: {e}", exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"Failed to get product statistics: {str(e)}"
        )
