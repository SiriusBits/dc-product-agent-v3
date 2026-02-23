"""Neo4j schema initialisation — constraints, indexes, and full-text search.

All operations are idempotent (safe to call on every startup) thanks to
``IF NOT EXISTS`` in Neo4j 5.x Cypher.

Usage::

    from dc_agent.kg.neo4j import Neo4jKGStore
    from dc_agent.kg.schema import init_schema

    async with Neo4jKGStore() as store:
        await init_schema(store)
"""

from __future__ import annotations

import logging
from typing import Any

from dc_agent.kg.store import KGStore

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Schema definitions (derived from docs/kg-schema.md)
# ---------------------------------------------------------------------------

#: Every node label that should have a uniqueness constraint on ``id``.
NODE_LABELS: list[str] = [
    "Chemical",
    "ChemicalClass",
    "Product",
    "Organization",
    "Application",
    "Document",
    "Identifier",
    "Material",
    "Property",
    "Benefit",
    "Hazard",
    "Location",
    "ChemicalFunction",
]

#: Constraints — one uniqueness constraint per label on ``id``.
UNIQUENESS_CONSTRAINTS: list[str] = [
    f"CREATE CONSTRAINT {label.lower()}_id IF NOT EXISTS "
    f"FOR (n:{label}) REQUIRE n.id IS UNIQUE"
    for label in NODE_LABELS
]

#: Single-property indexes for common lookups.
PROPERTY_INDEXES: list[str] = [
    # canonical_name lookups (most-queried labels)
    "CREATE INDEX chemical_name IF NOT EXISTS FOR (n:Chemical) ON (n.canonical_name)",
    "CREATE INDEX product_name IF NOT EXISTS FOR (n:Product) ON (n.canonical_name)",
    "CREATE INDEX chemical_class_name IF NOT EXISTS FOR (n:ChemicalClass) ON (n.canonical_name)",
    "CREATE INDEX organization_name IF NOT EXISTS FOR (n:Organization) ON (n.canonical_name)",
    "CREATE INDEX application_name IF NOT EXISTS FOR (n:Application) ON (n.canonical_name)",
    "CREATE INDEX property_name IF NOT EXISTS FOR (n:Property) ON (n.canonical_name)",
    "CREATE INDEX benefit_name IF NOT EXISTS FOR (n:Benefit) ON (n.canonical_name)",
    # Identifier value/type lookups (CAS number search)
    "CREATE INDEX identifier_value IF NOT EXISTS FOR (n:Identifier) ON (n.value)",
    "CREATE INDEX identifier_type IF NOT EXISTS FOR (n:Identifier) ON (n.identifier_type)",
    # Provenance lookups
    "CREATE INDEX chemical_document IF NOT EXISTS FOR (n:Chemical) ON (n.document_id)",
    "CREATE INDEX product_document IF NOT EXISTS FOR (n:Product) ON (n.document_id)",
]

#: Full-text index for natural-language entity search.
FULLTEXT_INDEX: str = (
    "CREATE FULLTEXT INDEX entity_names IF NOT EXISTS "
    "FOR (n:Chemical|ChemicalClass|Product|Application|Benefit|Hazard) "
    "ON EACH [n.canonical_name, n.source_text]"
)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


async def init_schema(store: KGStore) -> None:
    """Apply all constraints, indexes, and full-text indexes.

    Safe to call on every startup — all statements use ``IF NOT EXISTS``.
    """
    logger.info("Applying Neo4j schema (%d labels) …", len(NODE_LABELS))

    # Uniqueness constraints
    for stmt in UNIQUENESS_CONSTRAINTS:
        await store.execute(stmt)
    logger.info("Applied %d uniqueness constraints", len(UNIQUENESS_CONSTRAINTS))

    # Property indexes
    for stmt in PROPERTY_INDEXES:
        await store.execute(stmt)
    logger.info("Applied %d property indexes", len(PROPERTY_INDEXES))

    # Full-text index
    await store.execute(FULLTEXT_INDEX)
    logger.info("Applied full-text search index")

    logger.info("Schema initialisation complete")


async def validate_schema(store: KGStore) -> dict[str, Any]:
    """Check which constraints and indexes currently exist.

    Returns a summary dict and logs the findings.
    """
    constraints = await store.query("SHOW CONSTRAINTS")
    indexes = await store.query("SHOW INDEXES")

    constraint_names = [c.get("name", "?") for c in constraints]
    index_names = [i.get("name", "?") for i in indexes]

    expected_constraints = {label.lower() + "_id" for label in NODE_LABELS}
    found_constraints = set(constraint_names) & expected_constraints
    missing_constraints = expected_constraints - found_constraints

    summary: dict[str, Any] = {
        "total_constraints": len(constraints),
        "total_indexes": len(indexes),
        "expected_constraints": len(expected_constraints),
        "found_constraints": len(found_constraints),
        "missing_constraints": sorted(missing_constraints),
        "has_fulltext": any("entity_names" in n for n in index_names),
    }

    if missing_constraints:
        logger.warning(
            "Missing %d constraints: %s",
            len(missing_constraints),
            ", ".join(sorted(missing_constraints)),
        )
    else:
        logger.info("All %d expected constraints present", len(expected_constraints))

    if summary["has_fulltext"]:
        logger.info("Full-text index 'entity_names' present")
    else:
        logger.warning("Full-text index 'entity_names' NOT found")

    return summary


async def wipe_and_reinit(store: KGStore) -> None:
    """Delete **all** data and re-apply the schema.

    .. warning:: This is destructive — only use in development.
    """
    logger.warning("Wiping all Neo4j data …")
    # Batch delete to avoid OOM on large graphs
    deleted = True
    while deleted:
        result = await store.execute(
            "MATCH (n) WITH n LIMIT 10000 DETACH DELETE n RETURN count(*) AS cnt"
        )
        cnt = result[0]["cnt"] if result else 0
        deleted = cnt > 0
        if cnt:
            logger.info("Deleted batch of %d nodes", cnt)

    logger.info("All data deleted — re-applying schema")
    await init_schema(store)
    logger.info("Wipe and reinit complete")
