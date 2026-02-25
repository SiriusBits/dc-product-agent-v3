"""KG Query Service — typed, async queries over the Neo4j knowledge graph.

All user-supplied *values* are passed as Cypher ``$parameters``.
Node labels and relationship types (which cannot be parameterised in
Cypher) are validated against the schema before interpolation.

Usage::

    from dc_agent.kg.neo4j import Neo4jKGStore
    from dc_agent.kg.query_service import KGQueryService

    async with Neo4jKGStore() as store:
        svc = KGQueryService(store)
        profile = await svc.get_product_profile("DCA 221")
"""

from __future__ import annotations

import logging
import re
from typing import Any

from dc_agent.kg.query_models import (
    EntitySearchResult,
    FormulationComponent,
    FormulationResult,
    HazardEntry,
    FirstAidEntry,
    IdentifierEntry,
    KGNode,
    KGRelationship,
    NeighborEntry,
    PPEEntry,
    ProductProfile,
    PropertyComparisonResult,
    PropertyComparisonRow,
    PropertyEntry,
    RelatedProductEntry,
    RelatedProductsResult,
    SafetyProfile,
    StorageEntry,
    ToxicityEntry,
    TraversalResult,
)
from dc_agent.kg.schema import NODE_LABELS
from dc_agent.kg.store import KGStore

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Allowed relationship types (for safe interpolation in Cypher)
# ---------------------------------------------------------------------------

VALID_REL_TYPES: frozenset[str] = frozenset({
    "IS_A",
    "DERIVED_FROM",
    "FUNCTIONS_AS",
    "PRODUCED_BY",
    "PUBLISHES",
    "LOCATED_AT",
    "HAS_IDENTIFIER",
    "HAS_PROPERTY",
    "HAS_APPLICATION",
    "HAS_BENEFIT",
    "HAS_HAZARD",
    "REQUIRES_PPE",
    "HAS_FIRST_AID",
    "HAS_STORAGE",
    "HAS_TOXICITY",
    "COMPATIBLE_WITH",
    "INCOMPATIBLE_WITH",
    "REACTS_WITH",
    "CONTAINS",
    "FORMULATED_WITH",
    "ACHIEVES",
    "HAS_CURE_DATA",
    "HAS_DOSAGE",
    "COMPARED_TO",
    "MODIFIES",
    "AVAILABLE_IN",
    "LOWERS_FREEZING_POINT_OF",
    "TESTED_WITH",
})

VALID_LABELS: frozenset[str] = frozenset(NODE_LABELS)

_LABEL_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")

_MAX_TRAVERSAL_HOPS = 3
_DEFAULT_SEARCH_LIMIT = 20


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _validate_label(label: str) -> str:
    """Return *label* if it is a known Neo4j node label, else raise."""
    if label not in VALID_LABELS:
        raise ValueError(f"Invalid node label: {label!r}")
    return label


def _validate_rel_type(rel_type: str) -> str:
    """Return *rel_type* if it is a known relationship type, else raise."""
    if rel_type not in VALID_REL_TYPES:
        raise ValueError(f"Invalid relationship type: {rel_type!r}")
    return rel_type


def _safe_identifier(name: str) -> str:
    """Ensure *name* is safe for Cypher identifier interpolation."""
    if not _LABEL_RE.match(name):
        raise ValueError(f"Unsafe Cypher identifier: {name!r}")
    return name


def _to_dict(obj: Any) -> dict[str, Any]:
    """Safely convert a Neo4j Node/Relationship or plain dict to a Python dict.

    Neo4j driver objects expose ``.items()`` but ``dict(obj)`` may fail
    because ``__iter__`` yields keys (not key-value tuples).
    """
    if obj is None:
        return {}
    if isinstance(obj, dict):
        return obj
    if hasattr(obj, "items"):
        return dict(obj.items())
    return {}


def _node_from_record(record: dict[str, Any], key: str = "n") -> KGNode | None:
    """Extract a :class:`KGNode` from a query record."""
    raw = record.get(key)
    if raw is None:
        return None

    props = _to_dict(raw)
    labels = props.pop("_labels", [])
    label = labels[0] if labels else ""
    return KGNode(
        id=props.get("id", ""),
        label=label,
        canonical_name=props.get("canonical_name", ""),
        properties=props,
    )


def _rel_props(record: dict[str, Any], key: str = "r") -> dict[str, Any]:
    """Extract relationship properties from a query record."""
    return _to_dict(record.get(key))


def _str(val: Any, default: str = "") -> str:
    """Coerce a value to ``str``, replacing ``None`` with *default*."""
    return str(val) if val is not None else default


# ---------------------------------------------------------------------------
# Service
# ---------------------------------------------------------------------------


class KGQueryService:
    """Typed async query interface over :class:`KGStore`.

    Parameters
    ----------
    store:
        An initialised :class:`KGStore` (typically :class:`Neo4jKGStore`).
    """

    def __init__(self, store: KGStore) -> None:
        self._store = store

    # -- private helpers ----------------------------------------------------

    async def _resolve_node(self, name_or_id: str) -> dict[str, Any] | None:
        """Find a node by ``id``, ``canonical_name``, or ``aliases``."""
        # Try by id
        rows = await self._store.query(
            "MATCH (n {id: $val}) "
            "RETURN n, labels(n) AS _labels LIMIT 1",
            {"val": name_or_id},
        )
        if rows:
            return rows[0]

        # Try by canonical_name (case-insensitive)
        rows = await self._store.query(
            "MATCH (n) WHERE toLower(n.canonical_name) = toLower($val) "
            "RETURN n, labels(n) AS _labels LIMIT 1",
            {"val": name_or_id},
        )
        if rows:
            return rows[0]

        # Try by alias (case-insensitive)
        rows = await self._store.query(
            "MATCH (n) WHERE any(a IN n.aliases WHERE toLower(a) = toLower($val)) "
            "RETURN n, labels(n) AS _labels LIMIT 1",
            {"val": name_or_id},
        )
        return rows[0] if rows else None

    def _to_kg_node(self, record: dict[str, Any]) -> KGNode:
        """Convert a resolved record to :class:`KGNode`."""
        props = _to_dict(record.get("n"))
        labels = record.get("_labels", [])
        label = labels[0] if labels else ""
        return KGNode(
            id=props.get("id", ""),
            label=label,
            canonical_name=props.get("canonical_name", ""),
            properties=props,
        )

    # -- public API ---------------------------------------------------------

    async def get_entity_by_id(self, entity_id: str) -> KGNode | None:
        """Look up a single entity by its UUID."""
        record = await self._resolve_node(entity_id)
        if record is None:
            return None
        return self._to_kg_node(record)

    # ---- Product profile --------------------------------------------------

    async def get_product_profile(self, name_or_id: str) -> ProductProfile | None:
        """Full product/chemical profile: classification, apps, props, ids, manufacturer."""
        record = await self._resolve_node(name_or_id)
        if record is None:
            return None

        node = self._to_kg_node(record)
        node_id = node.id

        # Classification (IS_A → ChemicalClass)
        rows = await self._store.query(
            "MATCH (n {id: $id})-[:IS_A]->(c:ChemicalClass) "
            "RETURN c.canonical_name AS name",
            {"id": node_id},
        )
        classification = [r["name"] for r in rows if r.get("name")]

        # Applications
        rows = await self._store.query(
            "MATCH (n {id: $id})-[:HAS_APPLICATION]->(a:Application) "
            "RETURN a.canonical_name AS name",
            {"id": node_id},
        )
        applications = [r["name"] for r in rows if r.get("name")]

        # Properties
        rows = await self._store.query(
            "MATCH (n {id: $id})-[r:HAS_PROPERTY]->(p) "
            "RETURN r, p.canonical_name AS prop_name",
            {"id": node_id},
        )
        properties: list[PropertyEntry] = []
        for r in rows:
            rp = _rel_props(r, "r")
            properties.append(PropertyEntry(
                property_name=_str(r.get("prop_name") or rp.get("property_name")),
                value=_str(rp.get("value")),
                numeric_value=rp.get("numeric_value"),
                unit=_str(rp.get("unit")),
                temperature=_str(rp.get("temperature")),
                source_predicate=_str(rp.get("source_predicate")),
            ))

        # Identifiers
        rows = await self._store.query(
            "MATCH (n {id: $id})-[:HAS_IDENTIFIER]->(i:Identifier) "
            "RETURN i.identifier_type AS itype, i.value AS val",
            {"id": node_id},
        )
        identifiers = [
            IdentifierEntry(identifier_type=r.get("itype", ""), value=r.get("val", ""))
            for r in rows
        ]

        # Manufacturer
        rows = await self._store.query(
            "MATCH (n {id: $id})-[:PRODUCED_BY]->(o:Organization) "
            "RETURN o.canonical_name AS name LIMIT 1",
            {"id": node_id},
        )
        manufacturer = rows[0]["name"] if rows else None

        # Benefits
        rows = await self._store.query(
            "MATCH (n {id: $id})-[:HAS_BENEFIT]->(b:Benefit) "
            "RETURN b.canonical_name AS name",
            {"id": node_id},
        )
        benefits = [r["name"] for r in rows if r.get("name")]

        return ProductProfile(
            node=node,
            classification=classification,
            applications=applications,
            properties=properties,
            identifiers=identifiers,
            manufacturer=manufacturer,
            benefits=benefits,
        )

    # ---- Safety profile ---------------------------------------------------

    async def get_safety_profile(self, name_or_id: str) -> SafetyProfile | None:
        """Safety data: hazards, PPE, first aid, storage, toxicity."""
        record = await self._resolve_node(name_or_id)
        if record is None:
            return None

        node = self._to_kg_node(record)
        nid = node.id

        # Hazards
        rows = await self._store.query(
            "MATCH (n {id: $id})-[r:HAS_HAZARD]->() "
            "RETURN r",
            {"id": nid},
        )
        hazards = [
            HazardEntry(
                description=_str(_rel_props(r).get("value")),
                hazard_type=_str(_rel_props(r).get("hazard_type")),
                severity=_str(_rel_props(r).get("severity")),
            )
            for r in rows
        ]

        # PPE
        rows = await self._store.query(
            "MATCH (n {id: $id})-[r:REQUIRES_PPE]->() RETURN r",
            {"id": nid},
        )
        ppe = [
            PPEEntry(
                ppe_type=_str(_rel_props(r).get("value") or _rel_props(r).get("ppe_type")),
                description=_str(_rel_props(r).get("description")),
            )
            for r in rows
        ]

        # First aid
        rows = await self._store.query(
            "MATCH (n {id: $id})-[r:HAS_FIRST_AID]->() RETURN r",
            {"id": nid},
        )
        first_aid = [
            FirstAidEntry(
                instruction=_str(_rel_props(r).get("value") or _rel_props(r).get("instruction")),
                route=_str(_rel_props(r).get("route")),
            )
            for r in rows
        ]

        # Storage
        rows = await self._store.query(
            "MATCH (n {id: $id})-[r:HAS_STORAGE]->() RETURN r",
            {"id": nid},
        )
        storage = [
            StorageEntry(
                requirement=_str(_rel_props(r).get("value")),
                requirement_type=_str(_rel_props(r).get("requirement_type")),
            )
            for r in rows
        ]

        # Toxicity
        rows = await self._store.query(
            "MATCH (n {id: $id})-[r:HAS_TOXICITY]->() RETURN r",
            {"id": nid},
        )
        toxicity = [
            ToxicityEntry(
                test_type=_str(_rel_props(r).get("test_type")),
                value=_str(_rel_props(r).get("value")),
                route=_str(_rel_props(r).get("route")),
                species=_str(_rel_props(r).get("species")),
            )
            for r in rows
        ]

        return SafetyProfile(
            node=node,
            hazards=hazards,
            ppe=ppe,
            first_aid=first_aid,
            storage=storage,
            toxicity=toxicity,
        )

    # ---- Property comparison ----------------------------------------------

    async def compare_property(
        self,
        property_name: str,
        *,
        temperature: str | None = None,
    ) -> PropertyComparisonResult:
        """Compare a named property across all chemicals that have it."""
        if temperature:
            rows = await self._store.query(
                "MATCH (ch)-[r:HAS_PROPERTY]->(p:Property {canonical_name: $pname}) "
                "WHERE r.temperature = $temp "
                "RETURN ch.canonical_name AS chem, r.value AS val, "
                "       r.numeric_value AS nval, r.unit AS unit "
                "ORDER BY r.numeric_value",
                {"pname": property_name, "temp": temperature},
            )
        else:
            rows = await self._store.query(
                "MATCH (ch)-[r:HAS_PROPERTY]->(p:Property {canonical_name: $pname}) "
                "RETURN ch.canonical_name AS chem, r.value AS val, "
                "       r.numeric_value AS nval, r.unit AS unit "
                "ORDER BY r.numeric_value",
                {"pname": property_name},
            )

        return PropertyComparisonResult(
            property_name=property_name,
            temperature=temperature,
            rows=[
                PropertyComparisonRow(
                    chemical_name=_str(r.get("chem")),
                    value=_str(r.get("val")),
                    numeric_value=r.get("nval"),
                    unit=_str(r.get("unit")),
                )
                for r in rows
            ],
        )

    # ---- Formulations -----------------------------------------------------

    async def get_formulations(
        self,
        name_or_id: str,
        *,
        formulation_name: str | None = None,
    ) -> FormulationResult | None:
        """Formulation components for a chemical."""
        record = await self._resolve_node(name_or_id)
        if record is None:
            return None

        node = self._to_kg_node(record)

        if formulation_name:
            rows = await self._store.query(
                "MATCH (n {id: $id})-[r:FORMULATED_WITH]->(c:Chemical) "
                "WHERE r.formulation_name = $fname "
                "RETURN c.canonical_name AS comp, r",
                {"id": node.id, "fname": formulation_name},
            )
        else:
            rows = await self._store.query(
                "MATCH (n {id: $id})-[r:FORMULATED_WITH]->(c:Chemical) "
                "RETURN c.canonical_name AS comp, r",
                {"id": node.id},
            )

        components = [
            FormulationComponent(
                component_name=_str(r.get("comp")),
                amount=_str(_rel_props(r).get("amount")),
                amount_unit=_str(_rel_props(r).get("amount_unit")),
                role=_str(_rel_props(r).get("role")),
                source_predicate=_str(_rel_props(r).get("source_predicate")),
            )
            for r in rows
        ]

        return FormulationResult(
            chemical_name=node.canonical_name,
            formulation_name=formulation_name,
            components=components,
        )

    # ---- Fulltext entity search -------------------------------------------

    async def search_entities(
        self,
        query: str,
        *,
        labels: list[str] | None = None,
        limit: int = _DEFAULT_SEARCH_LIMIT,
    ) -> list[EntitySearchResult]:
        """Search entities by name using the ``entity_names`` fulltext index."""
        # Validate labels if provided
        if labels:
            for lb in labels:
                _validate_label(lb)

        rows = await self._store.query(
            "CALL db.index.fulltext.queryNodes('entity_names', $q) "
            "YIELD node, score "
            "RETURN node, score, labels(node) AS _labels "
            "ORDER BY score DESC LIMIT $lim",
            {"q": query, "lim": limit},
        )

        results: list[EntitySearchResult] = []
        for r in rows:
            node_props = _to_dict(r.get("node"))
            node_labels = r.get("_labels", [])
            label = node_labels[0] if node_labels else ""

            # Filter by labels if provided
            if labels and label not in labels:
                continue

            results.append(EntitySearchResult(
                id=node_props.get("id", ""),
                label=label,
                canonical_name=node_props.get("canonical_name", ""),
                score=r.get("score", 0.0),
            ))

        return results

    # ---- Related products -------------------------------------------------

    async def find_related_products(
        self,
        entity_name: str,
        *,
        relationship_type: str | None = None,
    ) -> RelatedProductsResult:
        """Find products/chemicals sharing a relationship to *entity_name*."""
        if relationship_type:
            safe_rel = _validate_rel_type(relationship_type)
            rows = await self._store.query(
                f"MATCH (p)-[r:{safe_rel}]->(e) "
                "WHERE toLower(e.canonical_name) = toLower($ename) "
                "RETURN p.id AS pid, p.canonical_name AS pname, "
                "       e.canonical_name AS ename, type(r) AS rtype",
                {"ename": entity_name},
            )
        else:
            rows = await self._store.query(
                "MATCH (p)-[r]->(e) "
                "WHERE toLower(e.canonical_name) = toLower($ename) "
                "RETURN p.id AS pid, p.canonical_name AS pname, "
                "       e.canonical_name AS ename, type(r) AS rtype",
                {"ename": entity_name},
            )

        entries = [
            RelatedProductEntry(
                product_id=r.get("pid", ""),
                product_name=r.get("pname", ""),
                shared_entity=r.get("ename", ""),
                relationship_type=r.get("rtype", ""),
            )
            for r in rows
        ]

        return RelatedProductsResult(query_entity=entity_name, results=entries)

    # ---- Traversal --------------------------------------------------------

    async def traverse(
        self,
        start_name_or_id: str,
        *,
        max_hops: int = 2,
        rel_types: list[str] | None = None,
        limit: int = 100,
    ) -> TraversalResult:
        """Variable-length path traversal from a start node.

        Parameters
        ----------
        max_hops:
            Maximum relationship hops (capped at 3).
        rel_types:
            If provided, only traverse these relationship types.
        limit:
            Maximum number of paths returned.
        """
        record = await self._resolve_node(start_name_or_id)
        if record is None:
            return TraversalResult()

        node = self._to_kg_node(record)
        hops = min(max_hops, _MAX_TRAVERSAL_HOPS)

        # Build relationship pattern
        if rel_types:
            safe_types = [_validate_rel_type(rt) for rt in rel_types]
            rel_pattern = ":" + "|".join(safe_types)
        else:
            rel_pattern = ""

        cypher = (
            f"MATCH path = (start {{id: $id}})-[{rel_pattern}*1..{hops}]-(end) "
            "UNWIND relationships(path) AS rel "
            "WITH DISTINCT rel, startNode(rel) AS sn, endNode(rel) AS en "
            f"RETURN sn, en, rel, type(rel) AS rtype LIMIT $lim"
        )

        rows = await self._store.query(cypher, {"id": node.id, "lim": limit})

        seen_nodes: dict[str, KGNode] = {node.id: node}
        relationships: list[KGRelationship] = []

        for r in rows:
            # Collect nodes from both ends of each relationship
            for key in ("sn", "en"):
                props = _to_dict(r.get(key))
                nid = props.get("id", "")
                if nid and nid not in seen_nodes:
                    seen_nodes[nid] = KGNode(
                        id=nid,
                        label="",  # labels not returned in this query shape
                        canonical_name=props.get("canonical_name", ""),
                        properties=props,
                    )

            # Relationship
            rp = _rel_props(r, "rel")
            sn_id = _to_dict(r.get("sn")).get("id", "")
            en_id = _to_dict(r.get("en")).get("id", "")

            relationships.append(KGRelationship(
                type=r.get("rtype", ""),
                source_id=sn_id,
                target_id=en_id,
                properties=rp,
            ))

        return TraversalResult(
            nodes=list(seen_nodes.values()),
            relationships=relationships,
        )

    # ---- Neighbors --------------------------------------------------------

    async def get_entity_neighbors(
        self,
        entity_id: str,
        *,
        direction: str = "both",
        rel_types: list[str] | None = None,
        limit: int = 50,
    ) -> list[NeighborEntry]:
        """One-hop neighbors of a node.

        Parameters
        ----------
        direction:
            ``"out"``, ``"in"``, or ``"both"`` (default).
        rel_types:
            Optional filter on relationship types.
        """
        if rel_types:
            safe_types = [_validate_rel_type(rt) for rt in rel_types]
            rel_pattern = ":" + "|".join(safe_types)
        else:
            rel_pattern = ""

        if direction == "out":
            pattern = f"(n {{id: $id}})-[r{rel_pattern}]->(m)"
        elif direction == "in":
            pattern = f"(n {{id: $id}})<-[r{rel_pattern}]-(m)"
        else:
            pattern = f"(n {{id: $id}})-[r{rel_pattern}]-(m)"

        rows = await self._store.query(
            f"MATCH {pattern} "
            "RETURN m, labels(m) AS _labels, r, type(r) AS rtype, "
            "       startNode(r) = n AS is_outgoing "
            f"LIMIT $lim",
            {"id": entity_id, "lim": limit},
        )

        entries: list[NeighborEntry] = []
        for r in rows:
            m_props = _to_dict(r.get("m"))
            m_labels = r.get("_labels", [])
            rp = _rel_props(r, "r")
            is_out = r.get("is_outgoing", True)

            neighbor = KGNode(
                id=m_props.get("id", ""),
                label=m_labels[0] if m_labels else "",
                canonical_name=m_props.get("canonical_name", ""),
                properties=m_props,
            )
            rel = KGRelationship(
                type=r.get("rtype", ""),
                source_id=entity_id if is_out else neighbor.id,
                target_id=neighbor.id if is_out else entity_id,
                properties=rp,
            )
            entries.append(NeighborEntry(relationship=rel, node=neighbor))

        return entries
