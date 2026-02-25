#!/usr/bin/env python3
"""
Fix KG entity consistency across all derived_info files.

Features addressed:
- Feature 3: Add PRODUCT_NAME entity where missing
- Feature 4: Complete alias lists on PRODUCT_NAME and primary CHEMICAL entities
- Feature 5: Standardize triple reference format to raw UUID strings
"""

import json
import uuid
import os
import glob
import yaml

ROOT = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "..")
)
BASE_YAML_DIR = os.path.join(ROOT, "data", "extracts", "base_extraction_yaml")
DERIVED_JSON_DIR = os.path.join(ROOT, "data", "extracts", "derived_info")
DERIVED_YAML_DIR = os.path.join(ROOT, "data", "extracts", "derived_info_yaml")


# Product info collected from base_extraction_yaml files
PRODUCT_INFO: dict[str, dict] = {}


def load_product_info() -> None:
    """Load product_info from all base_extraction YAML files."""
    for f in glob.glob(os.path.join(BASE_YAML_DIR, "*_base.yaml")):
        with open(f, "r") as fh:
            data = yaml.safe_load(fh)
        if not data or "product_info" not in data:
            continue
        # Key by short name from filename
        basename = os.path.basename(f)
        # e.g. "DCA_221_Technical_Bulletin_base.yaml"
        pi = data["product_info"]
        doc_id = data.get("doc_id", "")
        short_name = pi.get("product_short_name", "")
        if short_name:
            PRODUCT_INFO[basename] = {
                "doc_id": doc_id,
                "product_name": pi.get("product_name", ""),
                "product_short_name": short_name,
                "chemical_name": pi.get("chemical_name"),
                "cas_number": pi.get("cas_number"),
                "product_family": pi.get("product_family"),
                "synonyms": pi.get("synonyms") or [],
            }


def build_complete_aliases(pi: dict) -> list[str]:
    """Build the complete alias set from product_info."""
    names: set[str] = set()
    names.add(pi["product_short_name"])
    names.add(pi["product_name"])
    if pi["chemical_name"]:
        names.add(pi["chemical_name"])
    for s in pi["synonyms"]:
        names.add(s)
    return sorted(names)


def make_product_name_entity(pi: dict) -> dict:
    """Create a PRODUCT_NAME entity dict from product_info."""
    entity_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"product:{pi['product_short_name']}"))
    return {
        "id": entity_id,
        "text": pi["product_short_name"],
        "type": "PRODUCT_NAME",
        "canonical_name": pi["product_name"],
        "aliases": build_complete_aliases(pi),
        "source_text": f"{pi['product_name']} ({pi['product_short_name']})",
        "provenance": {
            "document_id": pi["doc_id"],
            "page": 1,
        },
        "metadata": {
            "manufacturer": "Dixie Chemical",
            **({"product_family": pi["product_family"]} if pi["product_family"] else {}),
        },
    }


def find_all_kgs(data: dict) -> list[dict]:
    """Find ALL knowledge_graph dicts (may exist at top-level and nested)."""
    results = []
    # Check top-level
    kg = data.get("knowledge_graph")
    if kg and isinstance(kg, dict) and "entities" in kg:
        results.append(kg)
    # Check nested inside derived_info
    di = data.get("derived_info", {})
    if isinstance(di, dict):
        kg = di.get("knowledge_graph")
        if kg and isinstance(kg, dict) and "entities" in kg:
            # Don't add the same object twice
            if not results or kg is not results[0]:
                results.append(kg)
    return results


def fix_json_file(json_path: str, pi: dict) -> bool:
    """Fix a single JSON derived_info file. Returns True if modified."""
    with open(json_path, "r") as fh:
        data = json.load(fh)

    all_kgs = find_all_kgs(data)
    if not all_kgs:
        print(f"  WARNING: No knowledge_graph found in {os.path.basename(json_path)}")
        return False

    changed = False
    complete_aliases = build_complete_aliases(pi)

    for kg in all_kgs:
        entities = kg.get("entities", [])

        # --- Feature 3: Add PRODUCT_NAME if missing ---
        has_product_name = any(e.get("type") == "PRODUCT_NAME" for e in entities)
        if not has_product_name:
            new_entity = make_product_name_entity(pi)
            entities.insert(0, new_entity)
            kg["entities"] = entities
            changed = True
            print(f"  Added PRODUCT_NAME entity: {pi['product_short_name']}")

        # --- Feature 4: Complete aliases ---
        for e in entities:
            if e.get("type") == "PRODUCT_NAME":
                current = set(e.get("aliases", []))
                needed = set(complete_aliases)
                if not needed.issubset(current):
                    e["aliases"] = sorted(current | needed)
                    changed = True
                    print(f"  Updated PRODUCT_NAME aliases: +{sorted(needed - current)}")

            if e.get("type") == "CHEMICAL":
                cn = e.get("canonical_name", "")
                chem_name = pi.get("chemical_name", "")
                if chem_name and cn == chem_name:
                    current = set(e.get("aliases", []))
                    needed = {pi["product_short_name"], pi["product_name"]}
                    if not needed.issubset(current):
                        e["aliases"] = sorted(current | needed)
                        changed = True
                        print(f"  Updated CHEMICAL aliases for {cn}: +{sorted(needed - current)}")

        # --- Feature 5: Standardize triple format ---
        triples = kg.get("kg_triples", [])
        for t in triples:
            for field in ("subject", "object"):
                val = t.get(field)
                if isinstance(val, dict):
                    if "id" in val:
                        t[field] = val["id"]
                        changed = True
                    elif "entity_id" in val:
                        t[field] = val["entity_id"]
                        changed = True

    if changed:
        with open(json_path, "w") as fh:
            json.dump(data, fh, indent=2, ensure_ascii=False)
            fh.write("\n")
    return changed


def fix_yaml_file(yaml_path: str, pi: dict) -> bool:
    """Fix a single YAML derived_info file. Returns True if modified."""
    with open(yaml_path, "r") as fh:
        data = yaml.safe_load(fh)

    if data is None:
        print(f"  WARNING: Empty YAML file {os.path.basename(yaml_path)}")
        return False

    all_kgs = find_all_kgs(data)
    if not all_kgs:
        print(f"  WARNING: No knowledge_graph found in {os.path.basename(yaml_path)}")
        return False

    changed = False
    complete_aliases = build_complete_aliases(pi)

    for kg in all_kgs:
        entities = kg.get("entities", [])

        # --- Feature 3: Add PRODUCT_NAME if missing ---
        has_product_name = any(e.get("type") == "PRODUCT_NAME" for e in entities)
        if not has_product_name:
            new_entity = make_product_name_entity(pi)
            entities.insert(0, new_entity)
            kg["entities"] = entities
            changed = True

        # --- Feature 4: Complete aliases ---
        for e in entities:
            if e.get("type") == "PRODUCT_NAME":
                current = set(e.get("aliases", []))
                needed = set(complete_aliases)
                if not needed.issubset(current):
                    e["aliases"] = sorted(current | needed)
                    changed = True

            if e.get("type") == "CHEMICAL":
                cn = e.get("canonical_name", "")
                chem_name = pi.get("chemical_name", "")
                if chem_name and cn == chem_name:
                    current = set(e.get("aliases", []))
                    needed = {pi["product_short_name"], pi["product_name"]}
                    if not needed.issubset(current):
                        e["aliases"] = sorted(current | needed)
                        changed = True

        # --- Feature 5: Standardize triple format ---
        triples = kg.get("kg_triples", [])
        for t in triples:
            for field in ("subject", "object"):
                val = t.get(field)
                if isinstance(val, dict):
                    if "id" in val:
                        t[field] = val["id"]
                        changed = True
                    elif "entity_id" in val:
                        t[field] = val["entity_id"]
                        changed = True

    if changed:
        with open(yaml_path, "w") as fh:
            yaml.dump(data, fh, default_flow_style=False, allow_unicode=True, sort_keys=False)
    return changed


def base_to_derived_name(base_name: str) -> str:
    """Convert base filename to derived filename."""
    return base_name.replace("_base.", "_derived.")


def main() -> None:
    load_product_info()
    print(f"Loaded product_info for {len(PRODUCT_INFO)} products\n")

    for base_name, pi in sorted(PRODUCT_INFO.items()):
        derived_name = base_to_derived_name(base_name)
        short = pi["product_short_name"]
        print(f"--- {short} ---")

        # JSON
        json_path = os.path.join(
            DERIVED_JSON_DIR, derived_name.replace(".yaml", ".json")
        )
        if os.path.exists(json_path):
            if fix_json_file(json_path, pi):
                print(f"  JSON: modified")
            else:
                print(f"  JSON: no changes needed")
        else:
            print(f"  JSON: file not found ({os.path.basename(json_path)})")

        # YAML
        yaml_path = os.path.join(DERIVED_YAML_DIR, derived_name)
        if os.path.exists(yaml_path):
            if fix_yaml_file(yaml_path, pi):
                print(f"  YAML: modified")
            else:
                print(f"  YAML: no changes needed")
        else:
            print(f"  YAML: file not found ({os.path.basename(yaml_path)})")

        print()


if __name__ == "__main__":
    main()
