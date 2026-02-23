"""Predicate normalization: raw YAML predicates → canonical Neo4j relationship types.

Derived from ``docs/kg-schema.md`` section 6.

Usage::

    from dc_agent.kg.predicates import normalize_predicate

    rel_type = normalize_predicate("has_dielectric_constant_23c_60hz")
    # => "HAS_PROPERTY"
"""

from __future__ import annotations

# ---------------------------------------------------------------------------
# Entity type → Neo4j label mapping
# ---------------------------------------------------------------------------

#: Maps raw YAML entity ``type`` values to Neo4j node labels.
#: CAS_NUMBER, IDENTIFIER, and REGISTRATION are consolidated into Identifier.
ENTITY_TYPE_MAP: dict[str, str] = {
    "CHEMICAL": "Chemical",
    "CHEMICAL_CLASS": "ChemicalClass",
    "PRODUCT_NAME": "Product",
    "ORGANIZATION": "Organization",
    "APPLICATION": "Application",
    "DOCUMENT": "Document",
    "CAS_NUMBER": "Identifier",
    "IDENTIFIER": "Identifier",
    "REGISTRATION": "Identifier",
    "MATERIAL": "Material",
    "PROPERTY": "Property",
    "BENEFIT": "Benefit",
    "HAZARD": "Hazard",
    "LOCATION": "Location",
    "CHEMICAL_FUNCTION": "ChemicalFunction",
}

#: Valid Neo4j node labels (the values in ENTITY_TYPE_MAP).
VALID_LABELS: frozenset[str] = frozenset(ENTITY_TYPE_MAP.values())

# ---------------------------------------------------------------------------
# Predicate → relationship type mapping
# ---------------------------------------------------------------------------

#: Explicit 1:1 predicate map (most common predicates).
PREDICATE_MAP: dict[str, str] = {
    # Taxonomy
    "is_a": "IS_A",
    "is_type_of": "IS_A",
    "is_chemical_type": "IS_A",
    "derived_from": "DERIVED_FROM",
    "is_derived_from": "DERIVED_FROM",
    "functions_as": "FUNCTIONS_AS",

    # Provenance
    "is_produced_by": "PRODUCED_BY",
    "manufactured_by": "PRODUCED_BY",
    "is_manufactured_by": "PRODUCED_BY",
    "is_available_from": "PRODUCED_BY",
    "has_manufacturer": "PRODUCED_BY",
    "publishes": "PUBLISHES",
    "published": "PUBLISHES",
    "located_at": "LOCATED_AT",
    "located_in": "LOCATED_AT",

    # Identification
    "has_cas_number": "HAS_IDENTIFIER",
    "has_reach_number": "HAS_IDENTIFIER",
    "has_reach_registration": "HAS_IDENTIFIER",
    "has_registration": "HAS_IDENTIFIER",
    "has_identifier": "HAS_IDENTIFIER",
    "has_chemical_name": "HAS_IDENTIFIER",

    # Applications
    "has_application": "HAS_APPLICATION",
    "used_in": "HAS_APPLICATION",
    "used_in_application": "HAS_APPLICATION",
    "used_as": "HAS_APPLICATION",
    "used_as_intermediate_for": "HAS_APPLICATION",

    # Benefits
    "has_benefit": "HAS_BENEFIT",
    "has_key_benefit": "HAS_BENEFIT",
    "provides": "HAS_BENEFIT",
    "provides_property": "HAS_BENEFIT",

    # Safety
    "has_hazard": "HAS_HAZARD",
    "has_safety_hazard": "HAS_HAZARD",
    "may_cause": "HAS_HAZARD",
    "is_irritant_to": "HAS_HAZARD",
    "is_corrosive_to": "HAS_HAZARD",
    "requires_ppe": "REQUIRES_PPE",
    "requires": "REQUIRES_PPE",
    "has_first_aid": "HAS_FIRST_AID",
    "has_storage_requirement": "HAS_STORAGE",
    "requires_storage_condition": "HAS_STORAGE",
    "has_storage_guidance_in": "HAS_STORAGE",
    "has_shelf_life": "HAS_STORAGE",
    "storage_recommendation": "HAS_STORAGE",
    "has_special_handling": "HAS_STORAGE",
    "can_be_stored_in": "HAS_STORAGE",

    # Toxicity
    "has_ld50": "HAS_TOXICITY",
    "has_skin_irritation_value": "HAS_TOXICITY",
    "is_eye_irritant": "HAS_TOXICITY",
    "has_mutagenicity_value": "HAS_TOXICITY",
    "has_mutagenic_activity": "HAS_TOXICITY",
    "has_toxicity_comparison": "HAS_TOXICITY",

    # Chemistry
    "is_compatible_with": "COMPATIBLE_WITH",
    "compatible_with": "COMPATIBLE_WITH",
    "can_be_formulated_with": "COMPATIBLE_WITH",
    "can_be_combined_with": "COMPATIBLE_WITH",
    "is_equivalent_to": "COMPATIBLE_WITH",
    "used_with": "COMPATIBLE_WITH",
    "is_incompatible_with": "INCOMPATIBLE_WITH",
    "reacts_with": "REACTS_WITH",
    "crosslinks_with": "REACTS_WITH",
    "cures": "REACTS_WITH",
    "is_cured_with": "REACTS_WITH",
    "catalyzes": "REACTS_WITH",
    "catalyzed_by": "REACTS_WITH",
    "reacts_with_to_form": "REACTS_WITH",
    "can_be_converted_to": "REACTS_WITH",
    "has_chemical_reaction": "REACTS_WITH",
    "used_with_catalyst": "REACTS_WITH",
    "contains_component": "CONTAINS",
    "contains_additive": "CONTAINS",
    "contains": "CONTAINS",
    "has_variant": "CONTAINS",
    "has_solvent": "CONTAINS",

    # Formulation & Performance
    "has_formulation_with": "FORMULATED_WITH",
    "has_formulation_property": "FORMULATED_WITH",
    "has_formulation_data_with": "FORMULATED_WITH",
    "with_resin": "FORMULATED_WITH",
    "has_cure_schedule": "HAS_CURE_DATA",
    "has_cure_cycle": "HAS_CURE_DATA",
    "has_property_when_cured": "HAS_CURE_DATA",
    "has_gel_time": "HAS_CURE_DATA",
    "has_cured_tg": "HAS_CURE_DATA",
    "has_dosage_with": "HAS_DOSAGE",
    "recommended_addition_level": "HAS_DOSAGE",
    "recommended_equivalents": "HAS_DOSAGE",
    "typical_usage_range": "HAS_DOSAGE",
    "high_performance_usage": "HAS_DOSAGE",
    "has_theoretical_level_with": "HAS_DOSAGE",

    # Other
    "compared_to": "COMPARED_TO",
    "modifies": "MODIFIES",
    "reduces": "MODIFIES",
    "is_available_in": "AVAILABLE_IN",
    "lowers_freezing_point_of": "LOWERS_FREEZING_POINT_OF",
    "is_tested_with": "TESTED_WITH",
    "are_considered": "HAS_HAZARD",
}

#: Prefix-based rules for predicates not in the explicit map.
#: Checked in order; first match wins.
PREDICATE_PREFIX_RULES: list[tuple[str, str]] = [
    ("formulated_with_", "FORMULATED_WITH"),
    ("achieves_", "ACHIEVES"),
    ("has_dielectric_", "HAS_PROPERTY"),
    ("has_dissipation_", "HAS_PROPERTY"),
    ("has_volume_resistivity_", "HAS_PROPERTY"),
    ("has_surface_resistivity_", "HAS_PROPERTY"),
    ("has_arc_resistance", "HAS_PROPERTY"),
    ("has_tensile_strength_", "HAS_PROPERTY"),
    ("has_tensile_modulus_", "HAS_PROPERTY"),
    ("has_elongation_", "HAS_PROPERTY"),
    ("has_water_boil_gain_", "HAS_PROPERTY"),
    ("has_acetone_boil_gain_", "HAS_PROPERTY"),
    ("has_hdt_at_", "HAS_PROPERTY"),
    ("has_tg_at_", "HAS_PROPERTY"),
    ("has_viscosity_", "HAS_PROPERTY"),
    ("has_specific_gravity_", "HAS_PROPERTY"),
    ("has_vapor_pressure_", "HAS_PROPERTY"),
    ("has_", "HAS_PROPERTY"),  # catch-all for remaining has_* predicates
]

#: Relationship types that target the subject itself (self-referencing)
#: when the triple object is a plain string rather than an entity reference.
SELF_REF_RELATIONSHIPS: frozenset[str] = frozenset({
    "REQUIRES_PPE",
    "HAS_FIRST_AID",
    "HAS_TOXICITY",
    "HAS_STORAGE",
    "HAS_HAZARD",
    "HAS_CURE_DATA",
    "HAS_DOSAGE",
    "COMPARED_TO",
    "MODIFIES",
})

#: Relationship types where a string object should auto-create a typed node.
STRING_CREATES_NODE: dict[str, str] = {
    "HAS_APPLICATION": "Application",
    "HAS_BENEFIT": "Benefit",
    "HAS_HAZARD": "Hazard",
    "COMPATIBLE_WITH": "Chemical",
    "INCOMPATIBLE_WITH": "Chemical",
    "REACTS_WITH": "Chemical",
    "CONTAINS": "Chemical",
    "FORMULATED_WITH": "Chemical",
}


def normalize_predicate(raw: str) -> str:
    """Map a raw YAML predicate to a canonical Neo4j relationship type.

    1. Check the explicit ``PREDICATE_MAP``.
    2. Check ``PREDICATE_PREFIX_RULES`` (first prefix match wins).
    3. Fall back to ``HAS_PROPERTY``.
    """
    # Exact match
    if raw in PREDICATE_MAP:
        return PREDICATE_MAP[raw]

    # Prefix match
    for prefix, rel_type in PREDICATE_PREFIX_RULES:
        if raw.startswith(prefix):
            return rel_type

    # Fallback
    return "HAS_PROPERTY"


def entity_type_to_label(raw_type: str) -> str | None:
    """Map a raw YAML entity type to a Neo4j node label.

    Returns ``None`` for unknown types.
    """
    return ENTITY_TYPE_MAP.get(raw_type)
