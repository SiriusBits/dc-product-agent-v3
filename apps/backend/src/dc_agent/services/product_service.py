"""Product service for browsing and searching products."""

import logging
from typing import Any
from uuid import UUID

from sqlalchemy import and_, desc, func, or_, select

from ..database.connection import get_database_manager
from ..database.models import Document as DocumentModel
from ..kg.service import KnowledgeGraphService
from ..models.api_models import (
    FacetCount,
    ProductSearchRequest,
    ProductSearchResponse,
    ProductSummary,
    SearchFacets,
)
from ..models.product_models import BaseExtractionDocument
from ..services.vector_service import VectorService

logger = logging.getLogger(__name__)


class ProductService:
    """Service for product browsing and search operations."""

    def __init__(
        self,
        vector_service: VectorService | None = None,
        kg_service: KnowledgeGraphService | None = None,
    ):
        """Initialize product service.
        
        Args:
            vector_service: Vector search service
            kg_service: Knowledge graph service
        """
        self.vector_service = vector_service or VectorService()
        self.kg_service = kg_service or KnowledgeGraphService()
        self._initialized = False

    async def initialize(self) -> bool:
        """Initialize the product service.
        
        Returns:
            True if initialization successful
        """
        try:
            # Initialize vector service
            vector_success = await self.vector_service.initialize()

            # Initialize knowledge graph service
            kg_success = await self.kg_service.initialize()

            # Service is usable if at least one component is working
            if vector_success or kg_success:
                self._initialized = True
                logger.info(f"Product service initialized (vector: {vector_success}, kg: {kg_success})")
                return True
            else:
                logger.error("Failed to initialize product service - no components available")
                return False

        except Exception as e:
            logger.error(f"Failed to initialize product service: {e}")
            return False

    async def search_products(self, request: ProductSearchRequest) -> ProductSearchResponse:
        """Search products based on request parameters.
        
        Args:
            request: Product search request
            
        Returns:
            Product search response with results and facets
        """
        try:
            if not self._initialized:
                await self.initialize()

            # If there's a text query, use vector search
            if request.query and request.query.strip():
                return await self._vector_search_products(request)
            else:
                # Use database filtering for non-text searches
                return await self._database_search_products(request)

        except Exception as e:
            logger.error(f"Failed to search products: {e}")
            return ProductSearchResponse(
                products=[],
                total_count=0,
                facets=SearchFacets(),
                query_info={"error": str(e)},
            )

    async def get_product_by_id(self, product_id: str) -> BaseExtractionDocument | None:
        """Get detailed product information by ID.
        
        Args:
            product_id: Product identifier
            
        Returns:
            Product document or None if not found
        """
        try:
            db_manager = await get_database_manager()

            async with db_manager.get_session() as session:
                # Try to find by document ID first
                try:
                    doc_uuid = UUID(product_id)
                    stmt = select(DocumentModel).where(DocumentModel.id == doc_uuid)
                    result = await session.execute(stmt)
                    document = result.scalar_one_or_none()
                except ValueError:
                    # Not a UUID, try to find by filename or product name
                    stmt = select(DocumentModel).where(
                        or_(
                            DocumentModel.filename.ilike(f"%{product_id}%"),
                            func.json_extract_path_text(
                                DocumentModel.extraction_metadata, "product_info", "product_name"
                            ).ilike(f"%{product_id}%"),
                        )
                    )
                    result = await session.execute(stmt)
                    document = result.scalar_one_or_none()

                if not document or not document.extraction_metadata:
                    return None

                # Convert database model to product document
                return self._convert_to_product_document(document)

        except Exception as e:
            logger.error(f"Failed to get product {product_id}: {e}")
            return None

    async def get_related_products(self, product_id: str, limit: int = 10) -> list[ProductSummary]:
        """Get products related to the specified product.
        
        Args:
            product_id: Product identifier
            limit: Maximum number of related products
            
        Returns:
            List of related product summaries
        """
        try:
            # First get the product to understand what we're looking for
            product = await self.get_product_by_id(product_id)
            if not product:
                return []

            related_products = []

            # Use knowledge graph to find related entities
            if self.kg_service and product.product_info.product_name:
                try:
                    kg_response = await self.kg_service.get_entity_neighbors(
                        entity_name=product.product_info.product_name,
                        relationship_types=["similar_to", "belongs_to_family", "competes_with"],
                        max_depth=2,
                        limit=limit,
                    )

                    # Convert related entities to product summaries
                    for entity in kg_response.related_entities:
                        if entity.type == "PRODUCT" and entity.canonical_name != product.product_info.product_name:
                            # Try to find the full product document
                            related_doc = await self.get_product_by_id(entity.canonical_name)
                            if related_doc:
                                summary = self._convert_to_product_summary(related_doc)
                                related_products.append(summary)

                except Exception as e:
                    logger.warning(f"KG-based related product search failed: {e}")

            # Use vector similarity for content-based recommendations
            if self.vector_service and len(related_products) < limit:
                try:
                    # Create a query from product information
                    query_parts = [product.product_info.product_name]
                    if product.product_info.product_family:
                        query_parts.append(product.product_info.product_family)
                    if product.applications:
                        query_parts.extend(product.applications[:3])

                    query = " ".join(query_parts)

                    # Search for similar products
                    vector_results = await self.vector_service.search(
                        query=query,
                        collection_name="technical_bulletins",
                        k=limit * 2,  # Get more to filter out the original
                        min_score=0.3,
                    )

                    # Convert vector results to product summaries
                    for result in vector_results:
                        if result.metadata.get("product_name") != product.product_info.product_name:
                            # Create summary from vector result metadata
                            summary = ProductSummary(
                                id=result.metadata.get("doc_id", "unknown"),
                                name=result.metadata.get("product_name", "Unknown Product"),
                                short_name=result.metadata.get("product_short_name"),
                                family=result.metadata.get("product_family"),
                                cas_number=result.metadata.get("cas_number"),
                                applications=result.metadata.get("applications", []),
                                key_properties=result.metadata.get("key_properties", []),
                                document_count=1,
                            )

                            # Avoid duplicates
                            if not any(p.name == summary.name for p in related_products):
                                related_products.append(summary)

                            if len(related_products) >= limit:
                                break

                except Exception as e:
                    logger.warning(f"Vector-based related product search failed: {e}")

            return related_products[:limit]

        except Exception as e:
            logger.error(f"Failed to get related products for {product_id}: {e}")
            return []

    async def compare_products(
        self, product_id1: str, product_id2: str, aspects: list[str] | None = None
    ) -> dict[str, Any]:
        """Compare two products across specified aspects.
        
        Args:
            product_id1: First product identifier
            product_id2: Second product identifier
            aspects: Specific aspects to compare (optional)
            
        Returns:
            Comparison data structure
        """
        try:
            # Get both products
            product1 = await self.get_product_by_id(product_id1)
            product2 = await self.get_product_by_id(product_id2)

            if not product1 or not product2:
                missing = []
                if not product1:
                    missing.append(product_id1)
                if not product2:
                    missing.append(product_id2)
                return {"error": f"Products not found: {', '.join(missing)}"}

            # Default aspects if not specified
            if not aspects:
                aspects = ["basic_info", "properties", "applications", "benefits"]

            comparison = {
                "product_1": {
                    "id": product_id1,
                    "name": product1.product_info.product_name,
                    "family": product1.product_info.product_family,
                },
                "product_2": {
                    "id": product_id2,
                    "name": product2.product_info.product_name,
                    "family": product2.product_info.product_family,
                },
                "comparison_matrix": [],
                "similarities": [],
                "differences": [],
                "recommendations": [],
            }

            # Compare basic information
            if "basic_info" in aspects:
                basic_comparison = self._compare_basic_info(product1, product2)
                comparison["comparison_matrix"].append(basic_comparison)

            # Compare properties
            if "properties" in aspects:
                properties_comparison = self._compare_properties(product1, product2)
                comparison["comparison_matrix"].append(properties_comparison)

            # Compare applications
            if "applications" in aspects:
                applications_comparison = self._compare_applications(product1, product2)
                comparison["comparison_matrix"].append(applications_comparison)

            # Compare benefits
            if "benefits" in aspects:
                benefits_comparison = self._compare_benefits(product1, product2)
                comparison["comparison_matrix"].append(benefits_comparison)

            # Generate recommendations
            comparison["recommendations"] = self._generate_comparison_recommendations(
                product1, product2, comparison["comparison_matrix"]
            )

            return comparison

        except Exception as e:
            logger.error(f"Failed to compare products {product_id1} and {product_id2}: {e}")
            return {"error": str(e)}

    async def list_product_families(self) -> list[str]:
        """Get list of all product families.
        
        Returns:
            List of product family names
        """
        try:
            db_manager = await get_database_manager()

            async with db_manager.get_session() as session:
                # Query distinct product families from extraction metadata
                stmt = select(
                    func.distinct(
                        func.json_extract_path_text(
                            DocumentModel.extraction_metadata, "product_info", "product_family"
                        )
                    ).label("family")
                ).where(
                    and_(
                        DocumentModel.extraction_metadata.is_not(None),
                        func.json_extract_path_text(
                            DocumentModel.extraction_metadata, "product_info", "product_family"
                        ).is_not(None),
                    )
                )

                result = await session.execute(stmt)
                families = [row.family for row in result if row.family]
                families.sort()

                return families

        except Exception as e:
            logger.error(f"Failed to list product families: {e}")
            return []

    async def list_applications(self) -> list[str]:
        """Get list of all product applications.
        
        Returns:
            List of application names
        """
        try:
            db_manager = await get_database_manager()

            async with db_manager.get_session() as session:
                # Query applications from extraction metadata
                stmt = select(
                    func.json_extract_path_text(
                        DocumentModel.extraction_metadata, "applications"
                    ).label("applications_json")
                ).where(
                    and_(
                        DocumentModel.extraction_metadata.is_not(None),
                        func.json_extract_path_text(
                            DocumentModel.extraction_metadata, "applications"
                        ).is_not(None),
                    )
                )

                result = await session.execute(stmt)
                all_applications = set()

                for row in result:
                    if row.applications_json:
                        try:
                            import json
                            applications = json.loads(row.applications_json)
                            if isinstance(applications, list):
                                all_applications.update(applications)
                        except (json.JSONDecodeError, TypeError):
                            continue

                applications_list = sorted(all_applications)
                return applications_list

        except Exception as e:
            logger.error(f"Failed to list applications: {e}")
            return []

    # Private helper methods

    async def _vector_search_products(self, request: ProductSearchRequest) -> ProductSearchResponse:
        """Search products using vector similarity."""
        try:
            # Perform vector search
            results = await self.vector_service.search(
                query=request.query,
                collection_name="technical_bulletins",
                k=request.limit * 2,  # Get more results to allow for filtering
                min_score=0.2,
            )

            # Convert vector results to product summaries
            products = []
            for result in results:
                if len(products) >= request.limit:
                    break

                # Apply filters
                if request.family and result.metadata.get("product_family") != request.family:
                    continue

                if request.applications:
                    product_apps = result.metadata.get("applications", [])
                    if not any(app in product_apps for app in request.applications):
                        continue

                # Create product summary
                summary = ProductSummary(
                    id=result.metadata.get("doc_id", "unknown"),
                    name=result.metadata.get("product_name", "Unknown Product"),
                    short_name=result.metadata.get("product_short_name"),
                    family=result.metadata.get("product_family"),
                    cas_number=result.metadata.get("cas_number"),
                    applications=result.metadata.get("applications", []),
                    key_properties=result.metadata.get("key_properties", []),
                    document_count=1,
                )
                products.append(summary)

            # Generate facets from results
            facets = await self._generate_facets_from_results(products)

            return ProductSearchResponse(
                products=products,
                total_count=len(products),
                facets=facets,
                query_info={
                    "processed_query": request.query,
                    "search_type": "vector",
                    "filters_applied": self._get_applied_filters(request),
                },
            )

        except Exception as e:
            logger.error(f"Vector search failed: {e}")
            return ProductSearchResponse(
                products=[],
                total_count=0,
                facets=SearchFacets(),
                query_info={"error": str(e)},
            )

    async def _database_search_products(self, request: ProductSearchRequest) -> ProductSearchResponse:
        """Search products using database filtering."""
        try:
            db_manager = await get_database_manager()

            async with db_manager.get_session() as session:
                # Build query with filters
                stmt = select(DocumentModel).where(
                    DocumentModel.extraction_metadata.is_not(None)
                )

                # Apply family filter
                if request.family:
                    stmt = stmt.where(
                        func.json_extract_path_text(
                            DocumentModel.extraction_metadata, "product_info", "product_family"
                        ) == request.family
                    )

                # Apply application filters
                if request.applications:
                    for app in request.applications:
                        stmt = stmt.where(
                            func.json_extract_path_text(
                                DocumentModel.extraction_metadata, "applications"
                            ).contains(app)
                        )

                # Apply sorting
                if request.sort_by == "name":
                    sort_field = func.json_extract_path_text(
                        DocumentModel.extraction_metadata, "product_info", "product_name"
                    )
                elif request.sort_by == "family":
                    sort_field = func.json_extract_path_text(
                        DocumentModel.extraction_metadata, "product_info", "product_family"
                    )
                else:  # relevance - use created date as proxy
                    sort_field = DocumentModel.created_at

                if request.sort_order == "desc":
                    stmt = stmt.order_by(desc(sort_field))
                else:
                    stmt = stmt.order_by(sort_field)

                # Apply pagination
                stmt = stmt.limit(request.limit).offset(request.offset)

                result = await session.execute(stmt)
                documents = result.scalars().all()

                # Convert to product summaries
                products = []
                for doc in documents:
                    if doc.extraction_metadata:
                        summary = self._convert_document_to_summary(doc)
                        if summary:
                            products.append(summary)

                # Generate facets
                facets = await self._generate_facets_from_database()

                return ProductSearchResponse(
                    products=products,
                    total_count=len(products),
                    facets=facets,
                    query_info={
                        "search_type": "database",
                        "filters_applied": self._get_applied_filters(request),
                    },
                )

        except Exception as e:
            logger.error(f"Database search failed: {e}")
            return ProductSearchResponse(
                products=[],
                total_count=0,
                facets=SearchFacets(),
                query_info={"error": str(e)},
            )

    def _convert_to_product_document(self, document: DocumentModel) -> BaseExtractionDocument:
        """Convert database document to product document."""
        # This would need to parse the extraction_metadata JSON
        # For now, return a basic structure
        metadata = document.extraction_metadata or {}

        return BaseExtractionDocument(
            doc_id=str(document.id),
            filename=document.filename,
            source_filepath=document.file_path,
            document_type="technical_bulletin",
            manufacturer=metadata.get("manufacturer", "Unknown"),
            product_info=metadata.get("product_info", {}),
            applications=metadata.get("applications", []),
            key_benefits=metadata.get("key_benefits", []),
            properties_and_specifications=metadata.get("properties_and_specifications", []),
            typical_properties=metadata.get("typical_properties", {}),
            sections=metadata.get("sections", []),
            extraction_metadata=metadata.get("extraction_metadata", {}),
        )

    def _convert_to_product_summary(self, document: BaseExtractionDocument) -> ProductSummary:
        """Convert product document to summary."""
        return ProductSummary(
            id=document.doc_id or "unknown",
            name=document.product_info.product_name,
            short_name=document.product_info.product_short_name,
            family=document.product_info.product_family,
            cas_number=document.product_info.cas_number,
            applications=document.applications,
            key_properties=[prop.name for prop in document.properties_and_specifications[:5]],
            document_count=1,
        )

    def _convert_document_to_summary(self, document: DocumentModel) -> ProductSummary | None:
        """Convert database document to product summary."""
        try:
            metadata = document.extraction_metadata or {}
            product_info = metadata.get("product_info", {})

            if not product_info.get("product_name"):
                return None

            return ProductSummary(
                id=str(document.id),
                name=product_info.get("product_name", "Unknown Product"),
                short_name=product_info.get("product_short_name"),
                family=product_info.get("product_family"),
                cas_number=product_info.get("cas_number"),
                applications=metadata.get("applications", []),
                key_properties=[],  # Would need to extract from properties
                document_count=1,
            )

        except Exception as e:
            logger.error(f"Failed to convert document to summary: {e}")
            return None

    async def _generate_facets_from_results(self, products: list[ProductSummary]) -> SearchFacets:
        """Generate search facets from product results."""
        families = {}
        applications = {}

        for product in products:
            # Count families
            if product.family:
                families[product.family] = families.get(product.family, 0) + 1

            # Count applications
            for app in product.applications:
                applications[app] = applications.get(app, 0) + 1

        return SearchFacets(
            families=[FacetCount(value=k, count=v) for k, v in sorted(families.items())],
            applications=[FacetCount(value=k, count=v) for k, v in sorted(applications.items())],
            manufacturers=[],  # Would need manufacturer data
            properties=[],  # Would need property analysis
        )

    async def _generate_facets_from_database(self) -> SearchFacets:
        """Generate search facets from database."""
        # This would query the database for facet counts
        # For now, return empty facets
        return SearchFacets()

    def _get_applied_filters(self, request: ProductSearchRequest) -> list[str]:
        """Get list of applied filters for query info."""
        filters = []
        if request.family:
            filters.append(f"family:{request.family}")
        if request.applications:
            filters.extend([f"application:{app}" for app in request.applications])
        return filters

    def _compare_basic_info(self, product1: BaseExtractionDocument, product2: BaseExtractionDocument) -> dict:
        """Compare basic product information."""
        return {
            "aspect": "Basic Information",
            "product_1": {
                "name": product1.product_info.product_name,
                "family": product1.product_info.product_family,
                "cas_number": product1.product_info.cas_number,
                "chemical_name": product1.product_info.chemical_name,
            },
            "product_2": {
                "name": product2.product_info.product_name,
                "family": product2.product_info.product_family,
                "cas_number": product2.product_info.cas_number,
                "chemical_name": product2.product_info.chemical_name,
            },
            "similarity_score": 0.8 if product1.product_info.product_family == product2.product_info.product_family else 0.3,
        }

    def _compare_properties(self, product1: BaseExtractionDocument, product2: BaseExtractionDocument) -> dict:
        """Compare product properties."""
        # This would do detailed property comparison
        return {
            "aspect": "Properties",
            "product_1": {"property_count": len(product1.properties_and_specifications)},
            "product_2": {"property_count": len(product2.properties_and_specifications)},
            "similarity_score": 0.5,  # Placeholder
        }

    def _compare_applications(self, product1: BaseExtractionDocument, product2: BaseExtractionDocument) -> dict:
        """Compare product applications."""
        common_apps = set(product1.applications) & set(product2.applications)
        total_apps = set(product1.applications) | set(product2.applications)

        similarity = len(common_apps) / len(total_apps) if total_apps else 0

        return {
            "aspect": "Applications",
            "product_1": {"applications": product1.applications},
            "product_2": {"applications": product2.applications},
            "common_applications": list(common_apps),
            "similarity_score": similarity,
        }

    def _compare_benefits(self, product1: BaseExtractionDocument, product2: BaseExtractionDocument) -> dict:
        """Compare product benefits."""
        return {
            "aspect": "Key Benefits",
            "product_1": {"benefits": product1.key_benefits},
            "product_2": {"benefits": product2.key_benefits},
            "similarity_score": 0.4,  # Placeholder
        }

    def _generate_comparison_recommendations(
        self, product1: BaseExtractionDocument, product2: BaseExtractionDocument, comparison_matrix: list
    ) -> list[str]:
        """Generate recommendations based on comparison."""
        recommendations = []

        # Analyze comparison matrix for recommendations
        for comparison in comparison_matrix:
            if comparison["aspect"] == "Applications" and comparison["similarity_score"] > 0.5:
                recommendations.append("Both products are suitable for similar applications")
            elif comparison["aspect"] == "Basic Information" and comparison["similarity_score"] > 0.7:
                recommendations.append("Products are from the same family and may be interchangeable")

        if not recommendations:
            recommendations.append("Products have different characteristics - choose based on specific requirements")

        return recommendations
