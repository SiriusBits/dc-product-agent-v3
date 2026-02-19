"""Comprehensive Verification Script for ChromaDB Ingestion.

This script verifies that all products have been properly indexed in ChromaDB
with the correct metadata and chunk types.

Usage:
    # From apps/backend directory:
    uv run python scripts/verify_ingestion.py
    
    # Show detailed information:
    uv run python scripts/verify_ingestion.py --detailed
"""

import argparse
import json
import sys
from pathlib import Path
from typing import Dict, Any, List

# Add src to path for imports
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

from dc_agent.vector.chroma import ChromaVectorStore


# Expected 17 products based on the data/extracts directory
EXPECTED_PRODUCTS = [
    "AP-6G",
    "ASA_100",
    "ASA_150",
    "ASA_155",
    "CG",
    "DCA_221",
    "DCA_467",
    "DCE_142",
    "DDSA",
    "ECA_1000L",
    "ECA_100KA1",
    "ECA_608",
    "JP-10",
    "MHHPA_301",
    "MHHPA_NC",
    "NMA_(Achieved)",
    "ODSA",
]

# Expected chunk types based on the ingestion script
EXPECTED_CHUNK_TYPES = [
    "applications",
    "formulation",
    "key_applications",
    "key_benefits",
    "persona_sales_summary",
    "persona_technical_summary",
    "product_info",
    "properties",
    "safety",
    "section",
    "summary",
]


def verify_chromadb(detailed: bool = False) -> Dict[str, Any]:
    """Verify ChromaDB contains all expected products and data.
    
    Args:
        detailed: If True, show detailed information about each product
        
    Returns:
        Dictionary with verification results
    """
    result = {
        "success": True,
        "total_documents": 0,
        "products_found": [],
        "products_missing": [],
        "products_extra": [],
        "chunk_types_found": [],
        "chunk_types_missing": [],
        "product_chunk_counts": {},
        "sample_queries": [],
        "errors": [],
    }
    
    print("=" * 60)
    print("CHROMADB INGESTION VERIFICATION")
    print("=" * 60)
    
    try:
        vector_store = ChromaVectorStore()
    except Exception as e:
        result["success"] = False
        result["errors"].append(f"Failed to connect to ChromaDB: {e}")
        print(f"\n❌ FAILED: Could not connect to ChromaDB: {e}")
        return result
    
    # 1. Document Count
    print("\n1. Document Count")
    print("-" * 40)
    try:
        result["total_documents"] = vector_store.count()
        print(f"   Total documents: {result['total_documents']}")
        
        if result["total_documents"] == 0:
            result["success"] = False
            print("   ❌ No documents found!")
            return result
        else:
            print(f"   ✓ Documents present")
    except Exception as e:
        result["errors"].append(f"Failed to count documents: {e}")
        print(f"   ❌ Error: {e}")
    
    # 2. Product Verification
    print("\n2. Product Verification")
    print("-" * 40)
    print(f"   Expected products: {len(EXPECTED_PRODUCTS)}")
    
    try:
        result["products_found"] = vector_store.list_unique_products()
        print(f"   Found products: {len(result['products_found'])}")
        
        # Check for missing products
        missing = set(EXPECTED_PRODUCTS) - set(result["products_found"])
        result["products_missing"] = sorted(list(missing))
        
        # Check for extra products (unexpected)
        extra = set(result["products_found"]) - set(EXPECTED_PRODUCTS)
        result["products_extra"] = sorted(list(extra))
        
        if result["products_missing"]:
            result["success"] = False
            print(f"\n   ❌ Missing products ({len(result['products_missing'])}):\n")
            for p in result["products_missing"]:
                print(f"      - {p}")
        
        if result["products_extra"]:
            print(f"\n   ⚠ Unexpected products ({len(result['products_extra'])}):\n")
            for p in result["products_extra"]:
                print(f"      - {p}")
        
        if not result["products_missing"]:
            print(f"\n   ✓ All {len(EXPECTED_PRODUCTS)} expected products are indexed")
        
        # Show all products if detailed
        if detailed:
            print("\n   Products indexed:")
            for p in result["products_found"]:
                status = "✓" if p in EXPECTED_PRODUCTS else "?"
                print(f"      {status} {p}")
    
    except Exception as e:
        result["errors"].append(f"Failed to verify products: {e}")
        print(f"   ❌ Error: {e}")
    
    # 3. Chunk Type Verification
    print("\n3. Chunk Type Verification")
    print("-" * 40)
    
    try:
        all_meta = vector_store.get_all_metadata()
        chunk_types = set()
        product_chunks = {}
        
        if all_meta["metadatas"]:
            for meta in all_meta["metadatas"]:
                if meta:
                    chunk_type = meta.get("chunk_type", "unknown")
                    chunk_types.add(chunk_type)
                    
                    product_id = meta.get("product_id", "unknown")
                    if product_id not in product_chunks:
                        product_chunks[product_id] = {}
                    if chunk_type not in product_chunks[product_id]:
                        product_chunks[product_id][chunk_type] = 0
                    product_chunks[product_id][chunk_type] += 1
        
        result["chunk_types_found"] = sorted(list(chunk_types))
        result["product_chunk_counts"] = product_chunks
        
        print(f"   Chunk types found: {result['chunk_types_found']}")
        
        # Check for missing chunk types
        missing_types = set(EXPECTED_CHUNK_TYPES) - chunk_types
        result["chunk_types_missing"] = sorted(list(missing_types))
        
        if result["chunk_types_missing"]:
            print(f"\n   ⚠ Some expected chunk types not found:")
            for ct in result["chunk_types_missing"]:
                print(f"      - {ct}")
        else:
            print(f"   ✓ All expected chunk types present")
        
        if detailed:
            print("\n   Chunk distribution per product:")
            for product in sorted(product_chunks.keys()):
                total = sum(product_chunks[product].values())
                print(f"      {product}: {total} chunks")
                for chunk_type, count in sorted(product_chunks[product].items()):
                    print(f"         - {chunk_type}: {count}")
    
    except Exception as e:
        result["errors"].append(f"Failed to verify chunk types: {e}")
        print(f"   ❌ Error: {e}")
    
    # 4. Query Tests
    print("\n4. Query Tests")
    print("-" * 40)
    
    test_queries = [
        ("MHHPA 301 epoxy curing agent", "MHHPA_301"),
        ("anhydride viscosity", None),
        ("electrical insulation applications", None),
        ("chemical product properties", None),
        ("safety handling hazards", None),
    ]
    
    for query, expected_product in test_queries:
        try:
            results = vector_store.query(query, n_results=3)
            if results["ids"] and results["ids"][0]:
                num_results = len(results["ids"][0])
                first_id = results["ids"][0][0]
                first_meta = results["metadatas"][0][0] if results["metadatas"] else {}
                first_product = first_meta.get("product_id", "unknown")
                
                query_result = {
                    "query": query,
                    "success": True,
                    "num_results": num_results,
                    "top_product": first_product,
                }
                result["sample_queries"].append(query_result)
                
                status = "✓"
                extra_info = ""
                if expected_product and first_product != expected_product:
                    status = "⚠"
                    extra_info = f" (expected {expected_product})"
                
                print(f"   {status} '{query}'")
                print(f"      Results: {num_results}, Top: {first_product}{extra_info}")
            else:
                result["sample_queries"].append({
                    "query": query,
                    "success": False,
                    "num_results": 0,
                })
                result["success"] = False
                print(f"   ❌ '{query}' - No results")
        
        except Exception as e:
            result["sample_queries"].append({
                "query": query,
                "success": False,
                "error": str(e),
            })
            print(f"   ❌ '{query}' - Error: {e}")
    
    # 5. Final Summary
    print("\n" + "=" * 60)
    print("VERIFICATION SUMMARY")
    print("=" * 60)
    
    print(f"\n   Total documents: {result['total_documents']}")
    print(f"   Products indexed: {len(result['products_found'])} / {len(EXPECTED_PRODUCTS)} expected")
    print(f"   Chunk types: {len(result['chunk_types_found'])}")
    print(f"   Query tests passed: {sum(1 for q in result['sample_queries'] if q.get('success', False))} / {len(test_queries)}")
    
    if result["errors"]:
        print(f"\n   Errors encountered: {len(result['errors'])}")
        for err in result["errors"]:
            print(f"      - {err}")
    
    print("\n" + "-" * 60)
    if result["success"]:
        print("✅ VERIFICATION PASSED - All 17 products successfully indexed!")
    else:
        print("❌ VERIFICATION FAILED - See issues above")
    print("-" * 60)
    
    return result


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Verify ChromaDB ingestion completeness"
    )
    parser.add_argument(
        "--detailed",
        action="store_true",
        help="Show detailed information about each product"
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Output results as JSON"
    )
    
    args = parser.parse_args()
    
    result = verify_chromadb(detailed=args.detailed)
    
    if args.json:
        # Convert sets to lists for JSON serialization
        print("\n" + json.dumps(result, indent=2, default=list))
    
    # Return exit code based on success
    sys.exit(0 if result["success"] else 1)


if __name__ == "__main__":
    main()
