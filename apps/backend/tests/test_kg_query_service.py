"""Tests for KGQueryService.

All tests use a mock KGStore so no live Neo4j is required.
"""

import pytest
from unittest.mock import AsyncMock

from dc_agent.kg.query_service import (
    KGQueryService,
    VALID_LABELS,
    VALID_REL_TYPES,
    _validate_label,
    _validate_rel_type,
    _rel_props,
)
from dc_agent.kg.query_models import (
    EntitySearchResult,
    FormulationResult,
    KGNode,
    NeighborEntry,
    ProductProfile,
    PropertyComparisonResult,
    RelatedProductsResult,
    SafetyProfile,
    TraversalResult,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def mock_store():
    """An async mock implementing the KGStore interface."""
    store = AsyncMock()
    store.query = AsyncMock(return_value=[])
    return store


@pytest.fixture
def svc(mock_store):
    return KGQueryService(mock_store)


def _node_record(
    node_id: str = "id-1",
    label: str = "Chemical",
    name: str = "Test Chemical",
    **extra: object,
) -> dict:
    """Build a mock record matching the ``_resolve_node`` return shape."""
    props = {"id": node_id, "canonical_name": name, **extra}
    return {"n": props, "_labels": [label]}


# ---------------------------------------------------------------------------
# Validation helpers
# ---------------------------------------------------------------------------


class TestValidationHelpers:
    def test_validate_label_accepts_known(self):
        for lb in VALID_LABELS:
            assert _validate_label(lb) == lb

    def test_validate_label_rejects_unknown(self):
        with pytest.raises(ValueError, match="Invalid node label"):
            _validate_label("FakeLabel")

    def test_validate_rel_type_accepts_known(self):
        for rt in VALID_REL_TYPES:
            assert _validate_rel_type(rt) == rt

    def test_validate_rel_type_rejects_unknown(self):
        with pytest.raises(ValueError, match="Invalid relationship type"):
            _validate_rel_type("FAKE_REL")

    def test_rel_props_returns_dict(self):
        assert _rel_props({"r": {"value": "42"}}) == {"value": "42"}

    def test_rel_props_returns_empty_for_none(self):
        assert _rel_props({}) == {}
        assert _rel_props({"r": None}) == {}


# ---------------------------------------------------------------------------
# get_entity_by_id
# ---------------------------------------------------------------------------


class TestGetEntityById:
    @pytest.mark.asyncio
    async def test_returns_node_when_found(self, svc, mock_store):
        mock_store.query.return_value = [_node_record()]
        result = await svc.get_entity_by_id("id-1")

        assert result is not None
        assert isinstance(result, KGNode)
        assert result.id == "id-1"
        assert result.label == "Chemical"
        assert result.canonical_name == "Test Chemical"

    @pytest.mark.asyncio
    async def test_returns_none_when_not_found(self, svc, mock_store):
        mock_store.query.return_value = []
        result = await svc.get_entity_by_id("nonexistent")
        assert result is None


# ---------------------------------------------------------------------------
# _resolve_node
# ---------------------------------------------------------------------------


class TestResolveNode:
    @pytest.mark.asyncio
    async def test_tries_id_first_then_name(self, svc, mock_store):
        # First call (by id) returns nothing, second (by name) returns a result
        mock_store.query.side_effect = [[], [_node_record()]]
        result = await svc._resolve_node("Test Chemical")

        assert result is not None
        assert mock_store.query.call_count == 2

    @pytest.mark.asyncio
    async def test_returns_immediately_on_id_match(self, svc, mock_store):
        mock_store.query.return_value = [_node_record()]
        result = await svc._resolve_node("id-1")

        assert result is not None
        # Only called once (id match succeeded)
        assert mock_store.query.call_count == 1

    @pytest.mark.asyncio
    async def test_falls_back_to_alias(self, svc, mock_store):
        # id miss, canonical_name miss, alias hit
        mock_store.query.side_effect = [[], [], [_node_record(name="Dixie Chemical Amine 221")]]
        result = await svc._resolve_node("DCA 221")

        assert result is not None
        assert mock_store.query.call_count == 3

    @pytest.mark.asyncio
    async def test_returns_none_when_all_lookups_miss(self, svc, mock_store):
        mock_store.query.side_effect = [[], [], []]
        result = await svc._resolve_node("nonexistent")

        assert result is None
        assert mock_store.query.call_count == 3


# ---------------------------------------------------------------------------
# get_product_profile
# ---------------------------------------------------------------------------


class TestGetProductProfile:
    @pytest.mark.asyncio
    async def test_returns_none_for_unknown(self, svc, mock_store):
        mock_store.query.return_value = []
        result = await svc.get_product_profile("Unknown")
        assert result is None

    @pytest.mark.asyncio
    async def test_assembles_full_profile(self, svc, mock_store):
        mock_store.query.side_effect = [
            # _resolve_node (id match)
            [_node_record("p1", "Product", "DCA 221")],
            # classification
            [{"name": "Anhydrides"}],
            # applications
            [{"name": "Electrical encapsulation"}, {"name": "Filament winding"}],
            # properties
            [{"r": {"value": "170", "property_name": "MW", "source_predicate": "has_mw"}, "prop_name": "Molecular Weight"}],
            # identifiers
            [{"itype": "CAS", "val": "123-45-6"}],
            # manufacturer
            [{"name": "Dixie Chemical"}],
            # benefits
            [{"name": "Low viscosity"}],
        ]

        result = await svc.get_product_profile("DCA 221")

        assert result is not None
        assert isinstance(result, ProductProfile)
        assert result.node.id == "p1"
        assert result.node.canonical_name == "DCA 221"
        assert result.classification == ["Anhydrides"]
        assert len(result.applications) == 2
        assert result.applications[0] == "Electrical encapsulation"
        assert len(result.properties) == 1
        assert result.properties[0].property_name == "Molecular Weight"
        assert result.properties[0].value == "170"
        assert result.identifiers[0].identifier_type == "CAS"
        assert result.manufacturer == "Dixie Chemical"
        assert result.benefits == ["Low viscosity"]

    @pytest.mark.asyncio
    async def test_handles_empty_relations(self, svc, mock_store):
        mock_store.query.side_effect = [
            [_node_record("p2", "Product", "NMA")],
            [],  # classification
            [],  # applications
            [],  # properties
            [],  # identifiers
            [],  # manufacturer
            [],  # benefits
        ]

        result = await svc.get_product_profile("NMA")

        assert result is not None
        assert result.classification == []
        assert result.applications == []
        assert result.properties == []
        assert result.manufacturer is None


# ---------------------------------------------------------------------------
# get_safety_profile
# ---------------------------------------------------------------------------


class TestGetSafetyProfile:
    @pytest.mark.asyncio
    async def test_returns_none_for_unknown(self, svc, mock_store):
        mock_store.query.return_value = []
        result = await svc.get_safety_profile("Unknown")
        assert result is None

    @pytest.mark.asyncio
    async def test_assembles_safety_data(self, svc, mock_store):
        mock_store.query.side_effect = [
            # _resolve_node
            [_node_record("c1", "Chemical", "Test Chem")],
            # hazards
            [{"r": {"value": "Skin irritant", "hazard_type": "irritant"}}],
            # PPE
            [{"r": {"value": "Safety goggles"}}],
            # first aid
            [{"r": {"value": "Flush with water", "route": "eye"}}],
            # storage
            [{"r": {"value": "Keep cool", "requirement_type": "temperature"}}],
            # toxicity
            [{"r": {"test_type": "LD50", "value": ">2000 mg/kg", "route": "oral", "species": "rat"}}],
        ]

        result = await svc.get_safety_profile("Test Chem")

        assert result is not None
        assert isinstance(result, SafetyProfile)
        assert len(result.hazards) == 1
        assert result.hazards[0].description == "Skin irritant"
        assert len(result.ppe) == 1
        assert result.ppe[0].ppe_type == "Safety goggles"
        assert len(result.first_aid) == 1
        assert result.first_aid[0].route == "eye"
        assert len(result.storage) == 1
        assert len(result.toxicity) == 1
        assert result.toxicity[0].test_type == "LD50"


# ---------------------------------------------------------------------------
# compare_property
# ---------------------------------------------------------------------------


class TestCompareProperty:
    @pytest.mark.asyncio
    async def test_returns_comparison_rows(self, svc, mock_store):
        mock_store.query.return_value = [
            {"chem": "DCA 221", "val": "3.6", "nval": 3.6, "unit": ""},
            {"chem": "MHHPA 301", "val": "4.1", "nval": 4.1, "unit": ""},
        ]

        result = await svc.compare_property("Dielectric Constant")

        assert isinstance(result, PropertyComparisonResult)
        assert result.property_name == "Dielectric Constant"
        assert result.temperature is None
        assert len(result.rows) == 2
        assert result.rows[0].chemical_name == "DCA 221"

    @pytest.mark.asyncio
    async def test_passes_temperature_filter(self, svc, mock_store):
        mock_store.query.return_value = []
        await svc.compare_property("Viscosity", temperature="25°C")

        # Verify temperature was included in query params
        call_args = mock_store.query.call_args
        assert call_args[0][1]["temp"] == "25°C"

    @pytest.mark.asyncio
    async def test_empty_result(self, svc, mock_store):
        mock_store.query.return_value = []
        result = await svc.compare_property("Nonexistent")
        assert result.rows == []


# ---------------------------------------------------------------------------
# get_formulations
# ---------------------------------------------------------------------------


class TestGetFormulations:
    @pytest.mark.asyncio
    async def test_returns_none_for_unknown_entity(self, svc, mock_store):
        mock_store.query.return_value = []
        result = await svc.get_formulations("Unknown")
        assert result is None

    @pytest.mark.asyncio
    async def test_returns_components(self, svc, mock_store):
        mock_store.query.side_effect = [
            # _resolve_node
            [_node_record("c1", "Chemical", "DCA 221")],
            # formulation query
            [
                {"comp": "Bis-A Type II", "r": {"amount": "100", "role": "resin", "source_predicate": "formulated_with_bis_a"}},
                {"comp": "BGE", "r": {"amount": "10", "role": "diluent", "source_predicate": "formulated_with_bge"}},
            ],
        ]

        result = await svc.get_formulations("DCA 221")

        assert result is not None
        assert isinstance(result, FormulationResult)
        assert result.chemical_name == "DCA 221"
        assert len(result.components) == 2
        assert result.components[0].component_name == "Bis-A Type II"
        assert result.components[0].role == "resin"

    @pytest.mark.asyncio
    async def test_filters_by_formulation_name(self, svc, mock_store):
        mock_store.query.side_effect = [
            [_node_record("c1", "Chemical", "DCA 221")],
            [{"comp": "Bis-A", "r": {"formulation_name": "High Impact"}}],
        ]

        result = await svc.get_formulations("DCA 221", formulation_name="High Impact")

        assert result is not None
        # Verify formulation_name was passed in query
        call_args = mock_store.query.call_args
        assert call_args[0][1]["fname"] == "High Impact"


# ---------------------------------------------------------------------------
# search_entities
# ---------------------------------------------------------------------------


class TestSearchEntities:
    @pytest.mark.asyncio
    async def test_returns_scored_results(self, svc, mock_store):
        mock_store.query.return_value = [
            {
                "node": {"id": "e1", "canonical_name": "MHHPA 301"},
                "_labels": ["Chemical"],
                "score": 2.5,
            },
            {
                "node": {"id": "e2", "canonical_name": "MHHPA-NC"},
                "_labels": ["Chemical"],
                "score": 1.8,
            },
        ]

        results = await svc.search_entities("MHHPA")

        assert len(results) == 2
        assert all(isinstance(r, EntitySearchResult) for r in results)
        assert results[0].canonical_name == "MHHPA 301"
        assert results[0].score == 2.5

    @pytest.mark.asyncio
    async def test_filters_by_label(self, svc, mock_store):
        mock_store.query.return_value = [
            {"node": {"id": "e1", "canonical_name": "X"}, "_labels": ["Chemical"], "score": 2.0},
            {"node": {"id": "e2", "canonical_name": "Y"}, "_labels": ["Application"], "score": 1.0},
        ]

        results = await svc.search_entities("test", labels=["Chemical"])
        assert len(results) == 1
        assert results[0].label == "Chemical"

    @pytest.mark.asyncio
    async def test_rejects_invalid_label(self, svc):
        with pytest.raises(ValueError, match="Invalid node label"):
            await svc.search_entities("test", labels=["FakeLabel"])

    @pytest.mark.asyncio
    async def test_empty_results(self, svc, mock_store):
        mock_store.query.return_value = []
        results = await svc.search_entities("zzzzz")
        assert results == []


# ---------------------------------------------------------------------------
# find_related_products
# ---------------------------------------------------------------------------


class TestFindRelatedProducts:
    @pytest.mark.asyncio
    async def test_finds_related_by_entity_name(self, svc, mock_store):
        mock_store.query.return_value = [
            {"pid": "p1", "pname": "DCA 221", "ename": "Electrical encapsulation", "rtype": "HAS_APPLICATION"},
            {"pid": "p2", "pname": "MHHPA 301", "ename": "Electrical encapsulation", "rtype": "HAS_APPLICATION"},
        ]

        result = await svc.find_related_products("Electrical encapsulation")

        assert isinstance(result, RelatedProductsResult)
        assert result.query_entity == "Electrical encapsulation"
        assert len(result.results) == 2

    @pytest.mark.asyncio
    async def test_filters_by_rel_type(self, svc, mock_store):
        mock_store.query.return_value = [
            {"pid": "p1", "pname": "DCA 221", "ename": "Anhydrides", "rtype": "IS_A"},
        ]

        result = await svc.find_related_products("Anhydrides", relationship_type="IS_A")

        assert len(result.results) == 1
        # Verify rel type was interpolated in Cypher
        cypher = mock_store.query.call_args[0][0]
        assert ":IS_A" in cypher

    @pytest.mark.asyncio
    async def test_rejects_invalid_rel_type(self, svc):
        with pytest.raises(ValueError, match="Invalid relationship type"):
            await svc.find_related_products("test", relationship_type="FAKE_REL")


# ---------------------------------------------------------------------------
# traverse
# ---------------------------------------------------------------------------


class TestTraverse:
    @pytest.mark.asyncio
    async def test_returns_empty_for_unknown_start(self, svc, mock_store):
        mock_store.query.return_value = []
        result = await svc.traverse("Unknown")

        assert isinstance(result, TraversalResult)
        assert result.nodes == []
        assert result.relationships == []

    @pytest.mark.asyncio
    async def test_returns_subgraph(self, svc, mock_store):
        mock_store.query.side_effect = [
            # _resolve_node
            [_node_record("c1", "Chemical", "DCA 221")],
            # traversal
            [
                {
                    "sn": {"id": "c1", "canonical_name": "DCA 221"},
                    "en": {"id": "cc1", "canonical_name": "Anhydrides"},
                    "rel": {"source_predicate": "is_a"},
                    "rtype": "IS_A",
                },
            ],
        ]

        result = await svc.traverse("DCA 221", max_hops=2)

        assert isinstance(result, TraversalResult)
        assert len(result.nodes) == 2  # start + end
        assert len(result.relationships) == 1
        assert result.relationships[0].type == "IS_A"

    @pytest.mark.asyncio
    async def test_caps_hops_at_3(self, svc, mock_store):
        mock_store.query.side_effect = [
            [_node_record("c1", "Chemical", "DCA 221")],
            [],  # traversal
        ]

        await svc.traverse("DCA 221", max_hops=10)

        cypher = mock_store.query.call_args[0][0]
        assert "*1..3" in cypher  # capped to 3

    @pytest.mark.asyncio
    async def test_filters_rel_types(self, svc, mock_store):
        mock_store.query.side_effect = [
            [_node_record("c1", "Chemical", "DCA 221")],
            [],
        ]

        await svc.traverse("DCA 221", rel_types=["IS_A", "HAS_APPLICATION"])

        cypher = mock_store.query.call_args[0][0]
        assert "IS_A" in cypher
        assert "HAS_APPLICATION" in cypher

    @pytest.mark.asyncio
    async def test_rejects_invalid_rel_type(self, svc, mock_store):
        mock_store.query.side_effect = [
            [_node_record("c1", "Chemical", "DCA 221")],
        ]

        with pytest.raises(ValueError, match="Invalid relationship type"):
            await svc.traverse("DCA 221", rel_types=["FAKE_REL"])


# ---------------------------------------------------------------------------
# get_entity_neighbors
# ---------------------------------------------------------------------------


class TestGetEntityNeighbors:
    @pytest.mark.asyncio
    async def test_returns_neighbors(self, svc, mock_store):
        mock_store.query.return_value = [
            {
                "m": {"id": "a1", "canonical_name": "Coatings"},
                "_labels": ["Application"],
                "r": {"source_predicate": "has_application"},
                "rtype": "HAS_APPLICATION",
                "is_outgoing": True,
            },
        ]

        results = await svc.get_entity_neighbors("c1")

        assert len(results) == 1
        assert isinstance(results[0], NeighborEntry)
        assert results[0].node.canonical_name == "Coatings"
        assert results[0].relationship.type == "HAS_APPLICATION"
        assert results[0].relationship.source_id == "c1"
        assert results[0].relationship.target_id == "a1"

    @pytest.mark.asyncio
    async def test_direction_out(self, svc, mock_store):
        mock_store.query.return_value = []
        await svc.get_entity_neighbors("c1", direction="out")

        cypher = mock_store.query.call_args[0][0]
        assert ")-[r]->(m)" in cypher

    @pytest.mark.asyncio
    async def test_direction_in(self, svc, mock_store):
        mock_store.query.return_value = []
        await svc.get_entity_neighbors("c1", direction="in")

        cypher = mock_store.query.call_args[0][0]
        assert ")<-[r]-(m)" in cypher

    @pytest.mark.asyncio
    async def test_direction_both(self, svc, mock_store):
        mock_store.query.return_value = []
        await svc.get_entity_neighbors("c1", direction="both")

        cypher = mock_store.query.call_args[0][0]
        assert ")-[r]-(m)" in cypher

    @pytest.mark.asyncio
    async def test_filters_rel_types(self, svc, mock_store):
        mock_store.query.return_value = []
        await svc.get_entity_neighbors("c1", rel_types=["IS_A"])

        cypher = mock_store.query.call_args[0][0]
        assert ":IS_A" in cypher

    @pytest.mark.asyncio
    async def test_rejects_invalid_rel_type(self, svc):
        with pytest.raises(ValueError, match="Invalid relationship type"):
            await svc.get_entity_neighbors("c1", rel_types=["BAD_TYPE"])

    @pytest.mark.asyncio
    async def test_incoming_neighbor_direction(self, svc, mock_store):
        mock_store.query.return_value = [
            {
                "m": {"id": "org1", "canonical_name": "Dixie Chemical"},
                "_labels": ["Organization"],
                "r": {},
                "rtype": "PRODUCED_BY",
                "is_outgoing": False,
            },
        ]

        results = await svc.get_entity_neighbors("c1")

        assert results[0].relationship.source_id == "org1"
        assert results[0].relationship.target_id == "c1"
