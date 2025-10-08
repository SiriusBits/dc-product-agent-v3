"""Unit tests for product service."""

import pytest
from unittest.mock import Mock, AsyncMock, patch
from typing import List, Dict, Any, Optional
from uuid import uuid4

from dc_agent.services.product_service import ProductService
from dc_agent.models.product_models import Product, ProductFamily, PropertySpecification
from dc_agent.models.api_models import ProductSearchRequest, ProductSearchResponse


class MockProductRepository:
    """Mock product repository for testing."""
    
    def __init__(self):
        self.products = {
            "asa-150": Product(
                id="asa-150",
                name="ASA 150",
                short_name="ASA150",
                family=ProductFamily.ASA,
                cas_number="12345-67-8",
                chemical_name="Alkenyl Succinic Anhydride 150",
                synonyms=["ASA-150", "Alkenyl Succinic Anhydride 150"],
                properties=[
                    PropertySpecification(
                        category="Physical",
                        name="Viscosity",
                        value_string="150 cP",
                        value_numeric=150.0,
                        unit="cP",
                        test_method="ASTM D445"
                    )
                ],
                applications=["Coatings", "Adhesives"],
                key_benefits=["High viscosity", "Good adhesion"]
            ),
            "dca-467": Product(
                id="dca-467",
                name="DCA 467",
                short_name="DCA467",
                family=ProductFamily.DCA,
                cas_number="98765-43-2",
                chemical_name="Dicyandiamide 467",
                synonyms=["DCA-467"],
                properties=[
                    PropertySpecification(
                        category="Physical",
                        name="Melting Point",
                        value_string="200°C",
                        value_numeric=200.0,
                        unit="°C",
                        test_method="DSC"
                    )
                ],
                applications=["Epoxy Curing"],
                key_benefits=["Fast cure", "High strength"]
            )
        }
    
    async def get_product_by_id(self, product_id: str) -> Optional[Product]:
        """Mock get product by ID."""
        return self.products.get(product_id)
    
    async def get_product_by_name(self, name: str) -> Optional[Product]:
        """Mock get product by name."""
        for product in self.products.values():
            if product.name.lower() == name.lower():
                return product
        return None
    
    async def list_products(
        self, 
        family: Optional[ProductFamily] = None,
        limit: int = 100,
        offset: int = 0
    ) -> List[Product]:
        """Mock list products."""
        products = list(self.products.values())
        
        if family:
            products = [p for p in products if p.family == family]
        
        return products[offset:offset + limit]
    
    async def search_products(
        self,
        query: str,
        families: Optional[List[ProductFamily]] = None,
        applications: Optional[List[str]] = None,
        limit: int = 100
    ) -> List[Product]:
        """Mock search products."""
        products = list(self.products.values())
        
        # Simple text search
        if query:
            query_lower = query.lower()
            products = [
                p for p in products 
                if (query_lower in p.name.lower() or 
                    query_lower in p.chemical_name.lower() or
                    any(query_lower in synonym.lower() for synonym in p.synonyms))
            ]
        
        # Filter by families
        if families:
            products = [p for p in products if p.family in families]
        
        # Filter by applications
        if applications:
            products = [
                p for p in products 
                if any(app in p.applications for app in applications)
            ]
        
        return products[:limit]


@pytest.fixture
def mock_product_repo():
    """Create mock product repository."""
    return MockProductRepository()


@pytest.fixture
def product_service(mock_product_repo):
    """Create product service with mock repository."""
    return ProductService(product_repository=mock_product_repo)


class TestProductService:
    """Test cases for ProductService."""
    
    @pytest.mark.asyncio
    async def test_get_product_by_id_success(self, product_service):
        """Test successful product retrieval by ID."""
        product = await product_service.get_product_by_id("asa-150")
        
        assert product is not None
        assert product.id == "asa-150"
        assert product.name == "ASA 150"
        assert product.family == ProductFamily.ASA
    
    @pytest.mark.asyncio
    async def test_get_product_by_id_not_found(self, product_service):
        """Test product retrieval with non-existent ID."""
        product = await product_service.get_product_by_id("non-existent")
        
        assert product is None
    
    @pytest.mark.asyncio
    async def test_get_product_by_name_success(self, product_service):
        """Test successful product retrieval by name."""
        product = await product_service.get_product_by_name("ASA 150")
        
        assert product is not None
        assert product.name == "ASA 150"
        assert product.id == "asa-150"
    
    @pytest.mark.asyncio
    async def test_get_product_by_name_case_insensitive(self, product_service):
        """Test case insensitive product retrieval by name."""
        product = await product_service.get_product_by_name("asa 150")
        
        assert product is not None
        assert product.name == "ASA 150"
    
    @pytest.mark.asyncio
    async def test_get_product_by_name_not_found(self, product_service):
        """Test product retrieval with non-existent name."""
        product = await product_service.get_product_by_name("Non Existent Product")
        
        assert product is None
    
    @pytest.mark.asyncio
    async def test_list_products_all(self, product_service):
        """Test listing all products."""
        products = await product_service.list_products()
        
        assert len(products) == 2
        product_names = [p.name for p in products]
        assert "ASA 150" in product_names
        assert "DCA 467" in product_names
    
    @pytest.mark.asyncio
    async def test_list_products_by_family(self, product_service):
        """Test listing products filtered by family."""
        asa_products = await product_service.list_products(family=ProductFamily.ASA)
        
        assert len(asa_products) == 1
        assert asa_products[0].name == "ASA 150"
        assert asa_products[0].family == ProductFamily.ASA
    
    @pytest.mark.asyncio
    async def test_list_products_with_pagination(self, product_service):
        """Test listing products with pagination."""
        # First page
        page1 = await product_service.list_products(limit=1, offset=0)
        assert len(page1) == 1
        
        # Second page
        page2 = await product_service.list_products(limit=1, offset=1)
        assert len(page2) == 1
        
        # Should be different products
        assert page1[0].id != page2[0].id
    
    @pytest.mark.asyncio
    async def test_search_products_by_name(self, product_service):
        """Test searching products by name."""
        results = await product_service.search_products("ASA")
        
        assert len(results) == 1
        assert results[0].name == "ASA 150"
    
    @pytest.mark.asyncio
    async def test_search_products_by_chemical_name(self, product_service):
        """Test searching products by chemical name."""
        results = await product_service.search_products("Alkenyl")
        
        assert len(results) == 1
        assert results[0].name == "ASA 150"
    
    @pytest.mark.asyncio
    async def test_search_products_by_synonym(self, product_service):
        """Test searching products by synonym."""
        results = await product_service.search_products("ASA-150")
        
        assert len(results) == 1
        assert results[0].name == "ASA 150"
    
    @pytest.mark.asyncio
    async def test_search_products_with_family_filter(self, product_service):
        """Test searching products with family filter."""
        results = await product_service.search_products(
            query="",
            families=[ProductFamily.DCA]
        )
        
        assert len(results) == 1
        assert results[0].family == ProductFamily.DCA
    
    @pytest.mark.asyncio
    async def test_search_products_with_application_filter(self, product_service):
        """Test searching products with application filter."""
        results = await product_service.search_products(
            query="",
            applications=["Coatings"]
        )
        
        assert len(results) == 1
        assert "Coatings" in results[0].applications
    
    @pytest.mark.asyncio
    async def test_search_products_no_results(self, product_service):
        """Test searching products with no matching results."""
        results = await product_service.search_products("NonExistentProduct")
        
        assert len(results) == 0
    
    @pytest.mark.asyncio
    async def test_search_products_empty_query(self, product_service):
        """Test searching products with empty query."""
        results = await product_service.search_products("")
        
        assert len(results) == 2  # Should return all products
    
    @pytest.mark.asyncio
    async def test_get_product_properties(self, product_service):
        """Test getting product properties."""
        product = await product_service.get_product_by_id("asa-150")
        
        assert len(product.properties) == 1
        prop = product.properties[0]
        assert prop.name == "Viscosity"
        assert prop.value_numeric == 150.0
        assert prop.unit == "cP"
    
    @pytest.mark.asyncio
    async def test_get_product_applications(self, product_service):
        """Test getting product applications."""
        product = await product_service.get_product_by_id("asa-150")
        
        assert "Coatings" in product.applications
        assert "Adhesives" in product.applications
    
    @pytest.mark.asyncio
    async def test_get_product_benefits(self, product_service):
        """Test getting product benefits."""
        product = await product_service.get_product_by_id("dca-467")
        
        assert "Fast cure" in product.key_benefits
        assert "High strength" in product.key_benefits
    
    @pytest.mark.asyncio
    async def test_compare_products(self, product_service):
        """Test comparing two products."""
        product1 = await product_service.get_product_by_id("asa-150")
        product2 = await product_service.get_product_by_id("dca-467")
        
        comparison = await product_service.compare_products([product1.id, product2.id])
        
        assert len(comparison) == 2
        assert comparison[0].id == "asa-150"
        assert comparison[1].id == "dca-467"
    
    @pytest.mark.asyncio
    async def test_get_product_families(self, product_service):
        """Test getting available product families."""
        families = await product_service.get_product_families()
        
        assert ProductFamily.ASA in families
        assert ProductFamily.DCA in families
    
    @pytest.mark.asyncio
    async def test_get_applications(self, product_service):
        """Test getting available applications."""
        applications = await product_service.get_applications()
        
        assert "Coatings" in applications
        assert "Adhesives" in applications
        assert "Epoxy Curing" in applications


@pytest.mark.integration
class TestProductServiceIntegration:
    """Integration tests for ProductService with real database."""
    
    @pytest.mark.asyncio
    async def test_database_integration(self):
        """Test integration with real database."""
        pytest.skip("Integration test requires database setup")
    
    @pytest.mark.asyncio
    async def test_search_performance(self):
        """Test search performance with large dataset."""
        pytest.skip("Performance test requires large dataset")