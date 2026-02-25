#!/usr/bin/env python3
"""
Validate KG entity consistency across all derived_info YAML files.

Checks:
1. Every derived_info file has at least one PRODUCT_NAME entity
2. All entity types are in the schema enum
3. PRODUCT_NAME entity aliases are a superset of product_info.synonyms
4. Primary CHEMICAL entity aliases include product short name and full name
5. All triple subjects/objects use raw UUID string format (not {id, name} objects)
6. No known chemical name typos

Run: uv run python scripts/validate_kg_consistency.py
"""

import json
import os
import glob
import sys
from dataclasses import dataclass, field

import yaml


ROOT = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "..")
)
BASE_YAML_DIR = os.path.join(ROOT, "data", "extracts", "base_extraction_yaml")
DERIVED_YAML_DIR = os.path.join(ROOT, "data", "extracts", "derived_info_yaml")
SCHEMA_PATH = os.path.join(
    ROOT, "reference", "schema", "common-defs.described.schema.json"
)

# Known typos to check for (misspelling -> correct spelling)
KNOWN_TYPOS: dict[str, str] = {
    "Polyglocoldiamine": "Polyglycoldiamine",
}

ALLOWED_ENTITY_TYPES: set[str] = set()


@dataclass
class Violation:
    check: str
    message: str


@dataclass
class ProductReport:
    product: str
    violations: list[Violation] = field(default_factory=list)


def load_allowed_types() -> None:
    """Load entity type enum from schema."""
    global ALLOWED_ENTITY_TYPES
    with open(SCHEMA_PATH, "r") as fh:
        schema = json.load(fh)
    entity_def = schema.get("$defs", {}).get("entity", {})
    type_prop = entity_def.get("properties", {}).get("type", {})
    ALLOWED_ENTITY_TYPES = set(type_prop.get("enum", []))


def load_product_info(base_yaml: str) -> dict | None:
    """Load product_info from a base extraction YAML file."""
    with open(base_yaml, "r") as fh:
        data = yaml.safe_load(fh)
    if not data or "product_info" not in data:
        return None
    pi = data["product_info"]
    return {
        "product_name": pi.get("product_name", ""),
        "product_short_name": pi.get("product_short_name", ""),
        "chemical_name": pi.get("chemical_name"),
        "synonyms": pi.get("synonyms") or [],
    }


def find_all_kgs(data: dict) -> list[dict]:
    """Find all knowledge_graph dicts in the data."""
    results = []
    kg = data.get("knowledge_graph")
    if kg and isinstance(kg, dict) and "entities" in kg:
        results.append(kg)
    di = data.get("derived_info", {})
    if isinstance(di, dict):
        kg = di.get("knowledge_graph")
        if kg and isinstance(kg, dict) and "entities" in kg:
            if not results or kg is not results[0]:
                results.append(kg)
    return results


def validate_product(
    derived_yaml: str, base_yaml: str | None
) -> ProductReport:
    """Validate a single product's derived_info YAML file."""
    product = os.path.basename(derived_yaml)
    report = ProductReport(product=product)

    with open(derived_yaml, "r") as fh:
        data = yaml.safe_load(fh)

    if data is None:
        report.violations.append(Violation("PARSE", "Empty or invalid YAML file"))
        return report

    all_kgs = find_all_kgs(data)
    if not all_kgs:
        report.violations.append(
            Violation("STRUCTURE", "No knowledge_graph with entities found")
        )
        return report

    # Load base product_info if available
    pi = None
    if base_yaml and os.path.exists(base_yaml):
        pi = load_product_info(base_yaml)

    all_entities: list[dict] = []
    all_triples: list[dict] = []
    for kg in all_kgs:
        all_entities.extend(kg.get("entities", []))
        all_triples.extend(kg.get("kg_triples", []))

    # --- Check 1: PRODUCT_NAME entity exists ---
    product_name_entities = [
        e for e in all_entities if e.get("type") == "PRODUCT_NAME"
    ]
    if not product_name_entities:
        report.violations.append(
            Violation("PRODUCT_NAME_MISSING", "No entity with type PRODUCT_NAME")
        )

    # --- Check 2: All entity types in enum ---
    for e in all_entities:
        etype = e.get("type", "")
        if etype and etype not in ALLOWED_ENTITY_TYPES:
            report.violations.append(
                Violation(
                    "INVALID_TYPE",
                    f"Entity '{e.get('canonical_name', e.get('text', '?'))}' "
                    f"has type '{etype}' not in schema enum",
                )
            )

    # --- Check 3 & 4: Alias completeness ---
    if pi:
        expected_aliases = set()
        expected_aliases.add(pi["product_short_name"])
        expected_aliases.add(pi["product_name"])
        if pi["chemical_name"]:
            expected_aliases.add(pi["chemical_name"])
        for s in pi["synonyms"]:
            expected_aliases.add(s)

        for e in product_name_entities:
            current = set(e.get("aliases", []))
            missing = expected_aliases - current
            if missing:
                report.violations.append(
                    Violation(
                        "INCOMPLETE_ALIASES",
                        f"PRODUCT_NAME entity missing aliases: {sorted(missing)}",
                    )
                )

        # Check 4: CHEMICAL entity aliases
        chem_name = pi.get("chemical_name", "")
        if chem_name:
            for e in all_entities:
                if (
                    e.get("type") == "CHEMICAL"
                    and e.get("canonical_name") == chem_name
                ):
                    current = set(e.get("aliases", []))
                    needed = {pi["product_short_name"], pi["product_name"]}
                    missing = needed - current
                    if missing:
                        report.violations.append(
                            Violation(
                                "CHEMICAL_ALIASES",
                                f"CHEMICAL entity '{chem_name}' missing aliases: "
                                f"{sorted(missing)}",
                            )
                        )

    # --- Check 5: Triple reference format ---
    for i, t in enumerate(all_triples):
        for fld in ("subject", "object"):
            val = t.get(fld)
            if isinstance(val, dict):
                # {property, value} objects are valid for objects
                if fld == "object" and "property" in val:
                    continue
                if "id" in val or "name" in val:
                    report.violations.append(
                        Violation(
                            "TRIPLE_FORMAT",
                            f"Triple #{i} {fld} uses object format "
                            f"instead of raw UUID string: {val}",
                        )
                    )

    # --- Check 6: Known typos ---
    yaml_text = yaml.dump(data, default_flow_style=False)
    for typo, correct in KNOWN_TYPOS.items():
        if typo in yaml_text:
            report.violations.append(
                Violation("TYPO", f"Found known typo '{typo}' (should be '{correct}')")
            )

    return report


def main() -> None:
    load_allowed_types()
    if not ALLOWED_ENTITY_TYPES:
        print(f"ERROR: Could not load entity types from {SCHEMA_PATH}")
        sys.exit(1)

    print(f"Allowed entity types: {sorted(ALLOWED_ENTITY_TYPES)}\n")

    derived_files = sorted(
        glob.glob(os.path.join(DERIVED_YAML_DIR, "*_derived.yaml"))
    )

    total_violations = 0
    clean_products = 0

    for derived_yaml in derived_files:
        # Find matching base file
        base_name = os.path.basename(derived_yaml).replace(
            "_derived.yaml", "_base.yaml"
        )
        base_yaml = os.path.join(BASE_YAML_DIR, base_name)

        report = validate_product(
            derived_yaml, base_yaml if os.path.exists(base_yaml) else None
        )

        if report.violations:
            print(f"FAIL: {report.product}")
            for v in report.violations:
                print(f"  [{v.check}] {v.message}")
            total_violations += len(report.violations)
        else:
            print(f"PASS: {report.product}")
            clean_products += 1
        print()

    print("=" * 60)
    print(
        f"Summary: {clean_products}/{len(derived_files)} products clean, "
        f"{total_violations} total violations"
    )
    sys.exit(1 if total_violations > 0 else 0)


if __name__ == "__main__":
    main()
