"""Data Ingestion Script for Dixie Chemical Product Agent.

This script loads both base extraction and derived info JSON files from the
data/extracts directory and ingests them into ChromaDB with comprehensive
chunking and metadata for optimal retrieval.

Usage:
    # From apps/backend directory:
    uv run python scripts/ingest_reference_data.py
    
    # With options:
    uv run python scripts/ingest_reference_data.py --clear  # Clear existing data first
    uv run python scripts/ingest_reference_data.py --verify  # Run verification after ingestion
"""

import argparse
import json
import glob
import sys
from pathlib import Path
from typing import List, Dict, Any, Tuple, Optional

# Add src to path for imports
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

from dc_agent.vector.chroma import ChromaVectorStore


def extract_product_id(filename: str) -> str:
    """Extract product ID from filename.
    
    Args:
        filename: The PDF filename (e.g., "MHHPA_301_Technical_Bulletin.pdf")
        
    Returns:
        Product ID (e.g., "MHHPA_301")
    """
    # Remove .pdf extension and _Technical_Bulletin suffix
    name = filename.replace(".pdf", "").replace("_Technical_Bulletin", "")
    return name


def create_chunk(
    content: str,
    product_id: str,
    product_name: str,
    product_short_name: str,
    chunk_type: str,
    section: str,
    doc_id: str,
    filename: str,
    page: Optional[int] = None,
) -> Tuple[str, Dict[str, Any], str]:
    """Create a document chunk with metadata.
    
    Args:
        content: The text content of the chunk
        product_id: Short product identifier (e.g., "MHHPA_301")
        product_name: Full product name (e.g., "Hexadecenylsuccinic Anhydride")
        product_short_name: Short product name (e.g., "ASA 100")
        chunk_type: Type of chunk (summary, section, properties, etc.)
        section: Section name within the document
        doc_id: Document ID from the source file
        filename: Original PDF filename
        page: Page number if available
        
    Returns:
        Tuple of (document_text, metadata_dict, chunk_id)
    """
    # Create display name that includes both names if different
    if product_name != product_short_name:
        display_name = f"{product_name} ({product_short_name})"
    else:
        display_name = product_name
    
    # Create structured document text for embedding
    doc_text = f"Product: {display_name}\nSection: {section}\n\n{content}"
    
    # Use short name for metadata (more recognizable)
    metadata = {
        "product_id": product_id,
        "product_name": product_short_name,  # Use short name for display
        "product_full_name": product_name,   # Keep full name too
        "chunk_type": chunk_type,
        "section": section,
        "doc_id": doc_id,
        "filename": filename,
        "product": product_id,  # Keep for backward compatibility
    }
    
    if page is not None:
        metadata["page"] = page
    
    # Create unique chunk ID
    chunk_id = f"{product_id}_{chunk_type}_{section}".replace(" ", "_").lower()
    
    return doc_text, metadata, chunk_id


def process_base_extraction(base_data: Dict[str, Any]) -> List[Tuple[str, Dict[str, Any], str]]:
    """Process base extraction data into chunks.
    
    Args:
        base_data: Parsed JSON from base extraction file
        
    Returns:
        List of (document, metadata, id) tuples
    """
    chunks = []
    
    filename = base_data.get("filename", "unknown")
    doc_id = base_data.get("doc_id", "unknown")
    product_id = extract_product_id(filename)
    
    # Get product info
    product_info = base_data.get("product_info", {})
    product_name = product_info.get("product_name", product_id)
    product_short_name = product_info.get("product_short_name", product_id)
    
    # 1. Product Overview Chunk
    overview_parts = []
    if product_info.get("chemical_name"):
        overview_parts.append(f"Chemical Name: {product_info['chemical_name']}")
    if product_info.get("product_family"):
        overview_parts.append(f"Product Family: {product_info['product_family']}")
    if product_info.get("cas_number"):
        overview_parts.append(f"CAS Number: {product_info['cas_number']}")
    if product_info.get("synonyms"):
        overview_parts.append(f"Synonyms: {', '.join(product_info['synonyms'])}")
    
    if overview_parts:
        overview_text = f"{product_name} ({product_short_name})\n" + "\n".join(overview_parts)
        chunk = create_chunk(
            content=overview_text,
            product_id=product_id,
            product_name=product_name,
            product_short_name=product_short_name,
            chunk_type="product_info",
            section="Product Overview",
            doc_id=doc_id,
            filename=filename,
        )
        chunks.append(chunk)
    
    # 2. Key Benefits Chunk
    key_benefits = base_data.get("key_benefits", [])
    if key_benefits:
        benefits_text = "Key Benefits:\n" + "\n".join(f"• {b}" for b in key_benefits)
        chunk = create_chunk(
            content=benefits_text,
            product_id=product_id,
            product_name=product_name,
            product_short_name=product_short_name,
            chunk_type="key_benefits",
            section="Key Benefits",
            doc_id=doc_id,
            filename=filename,
        )
        chunks.append(chunk)
    
    # 3. Applications Chunk
    applications_text = base_data.get("applications_text", "")
    applications_list = base_data.get("applications", [])
    if applications_text or applications_list:
        app_content = ""
        if applications_text:
            app_content = applications_text
        if applications_list:
            app_content += "\n\nApplications:\n" + "\n".join(f"• {a}" for a in applications_list)
        chunk = create_chunk(
            content=app_content.strip(),
            product_id=product_id,
            product_name=product_name,
            product_short_name=product_short_name,
            chunk_type="applications",
            section="Applications",
            doc_id=doc_id,
            filename=filename,
        )
        chunks.append(chunk)
    
    # 4. Properties and Specifications Chunk
    properties = base_data.get("properties_and_specifications", [])
    if properties:
        props_lines = ["Properties and Specifications:"]
        for prop in properties:
            name = prop.get("name", "")
            value = prop.get("value_string", "")
            unit = prop.get("unit", "")
            method = prop.get("test_method", "")
            
            line = f"• {name}: {value}"
            if unit:
                line += f" {unit}"
            if method:
                line += f" (Test Method: {method})"
            props_lines.append(line)
        
        chunk = create_chunk(
            content="\n".join(props_lines),
            product_id=product_id,
            product_name=product_name,
            product_short_name=product_short_name,
            chunk_type="properties",
            section="Properties and Specifications",
            doc_id=doc_id,
            filename=filename,
        )
        chunks.append(chunk)
    
    # 5. Section Chunks
    sections = base_data.get("sections", [])
    for section in sections:
        section_name = section.get("name", "Unknown Section")
        section_text = section.get("text", "")
        section_page = section.get("page")
        
        if section_text:
            chunk = create_chunk(
                content=section_text,
                product_id=product_id,
                product_name=product_name,
                product_short_name=product_short_name,
                chunk_type="section",
                section=section_name,
                doc_id=doc_id,
                filename=filename,
                page=section_page,
            )
            chunks.append(chunk)
    
    # 6. Formulation Data Chunk
    formulation_data = base_data.get("formulation_data", [])
    if formulation_data:
        form_lines = ["Formulation Data:"]
        for form in formulation_data:
            epoxy_type = form.get("epoxy_type", "Unknown")
            line_parts = [f"\n{epoxy_type}:"]
            for key, value in form.items():
                if key != "epoxy_type" and value is not None:
                    # Format key nicely
                    formatted_key = key.replace("_", " ").title()
                    line_parts.append(f"  • {formatted_key}: {value}")
            form_lines.append("\n".join(line_parts))
        
        chunk = create_chunk(
            content="\n".join(form_lines),
            product_id=product_id,
            product_name=product_name,
            product_short_name=product_short_name,
            chunk_type="formulation",
            section="Formulation Data",
            doc_id=doc_id,
            filename=filename,
        )
        chunks.append(chunk)
    
    # 7. Toxicity Data Chunk
    toxicity_data = base_data.get("toxicity_data", [])
    if toxicity_data:
        tox_lines = ["Safety and Toxicity Information:"]
        for tox in toxicity_data:
            source_text = tox.get("source_text", "")
            if source_text:
                tox_lines.append(source_text)
        
        if len(tox_lines) > 1:
            chunk = create_chunk(
                content="\n\n".join(tox_lines),
                product_id=product_id,
                product_name=product_name,
                product_short_name=product_short_name,
                chunk_type="safety",
                section="Safety Information",
                doc_id=doc_id,
                filename=filename,
            )
            chunks.append(chunk)
    
    return chunks


def process_derived_info(
    derived_data: Dict[str, Any],
    product_name_lookup: Optional[Dict[str, Tuple[str, str]]] = None
) -> List[Tuple[str, Dict[str, Any], str]]:
    """Process derived info data into chunks.
    
    Args:
        derived_data: Parsed JSON from derived info file
        product_name_lookup: Optional dict mapping product_id to (product_name, product_short_name)
        
    Returns:
        List of (document, metadata, id) tuples
    """
    chunks = []
    
    filename = derived_data.get("filename", "unknown")
    doc_id = derived_data.get("doc_id", "unknown")
    product_id = extract_product_id(filename)
    
    derived_info = derived_data.get("derived_info", {})
    
    # Get product names from lookup or fall back to product_id
    product_name = product_id  # Default fallback
    product_short_name = product_id  # Default fallback
    if product_name_lookup and product_id in product_name_lookup:
        product_name, product_short_name = product_name_lookup[product_id]
    
    # 1. Summary Chunk
    summary = derived_info.get("summary", "")
    if summary:
        chunk = create_chunk(
            content=summary,
            product_id=product_id,
            product_name=product_name,
            product_short_name=product_short_name,
            chunk_type="summary",
            section="Summary",
            doc_id=doc_id,
            filename=filename,
        )
        chunks.append(chunk)
    
    # 2. Personas Chunks
    personas = derived_info.get("personas", {})
    for persona_type, persona_text in personas.items():
        if persona_text:
            section_name = persona_type.replace("_", " ").title()
            chunk = create_chunk(
                content=persona_text,
                product_id=product_id,
                product_name=product_name,
                product_short_name=product_short_name,
                chunk_type=f"persona_{persona_type}",
                section=section_name,
                doc_id=doc_id,
                filename=filename,
            )
            chunks.append(chunk)
    
    # 3. Key Applications Chunk
    key_applications = derived_info.get("key_applications", [])
    if key_applications:
        apps_text = "Key Applications:\n" + "\n".join(f"• {app}" for app in key_applications)
        chunk = create_chunk(
            content=apps_text,
            product_id=product_id,
            product_name=product_name,
            product_short_name=product_short_name,
            chunk_type="key_applications",
            section="Key Applications",
            doc_id=doc_id,
            filename=filename,
        )
        chunks.append(chunk)
    
    return chunks


def ingest_reference_data(clear_existing: bool = False, verify_after: bool = False) -> Dict[str, Any]:
    """Ingest reference data from base extraction and derived info files.
    
    Args:
        clear_existing: If True, clear existing data before ingestion
        verify_after: If True, run verification after ingestion
        
    Returns:
        Dictionary with ingestion statistics
    """
    # Paths
    root_dir = Path(__file__).resolve().parent.parent.parent.parent
    base_extraction_dir = root_dir / "data" / "extracts" / "base_extraction"
    derived_info_dir = root_dir / "data" / "extracts" / "derived_info"
    
    # Initialize Vector Store
    vector_store = ChromaVectorStore()
    
    stats = {
        "base_files_processed": 0,
        "derived_files_processed": 0,
        "total_chunks_created": 0,
        "products_indexed": set(),
        "errors": [],
    }
    
    # Clear existing data if requested
    if clear_existing:
        print("Clearing existing ChromaDB data...")
        deleted_count = vector_store.clear_all()
        print(f"  Deleted {deleted_count} existing documents.")
    
    # Collect all chunks
    all_documents = []
    all_metadatas = []
    all_ids = []
    
    # Build product name lookup from base extraction files first
    # Maps product_id -> (product_name, product_short_name)
    product_name_lookup: Dict[str, Tuple[str, str]] = {}
    
    # Process Base Extraction Files
    print(f"\nProcessing base extraction files from: {base_extraction_dir}")
    base_files = glob.glob(str(base_extraction_dir / "*_base.json"))
    print(f"  Found {len(base_files)} base extraction files.")
    
    for json_file in base_files:
        try:
            with open(json_file, "r") as f:
                data = json.load(f)
            
            filename = data.get("filename", Path(json_file).stem)
            product_id = extract_product_id(filename)
            
            # Extract and store product names for lookup
            product_info = data.get("product_info", {})
            product_name = product_info.get("product_name", product_id)
            product_short_name = product_info.get("product_short_name", product_id)
            product_name_lookup[product_id] = (product_name, product_short_name)
            
            print(f"  Processing: {product_id} ({product_short_name})")
            
            chunks = process_base_extraction(data)
            for doc, meta, chunk_id in chunks:
                all_documents.append(doc)
                all_metadatas.append(meta)
                all_ids.append(chunk_id)
            
            stats["base_files_processed"] += 1
            stats["products_indexed"].add(product_id)
            
        except Exception as e:
            error_msg = f"Failed to process {json_file}: {e}"
            print(f"  ERROR: {error_msg}")
            stats["errors"].append(error_msg)
    
    # Process Derived Info Files
    print(f"\nProcessing derived info files from: {derived_info_dir}")
    derived_files = glob.glob(str(derived_info_dir / "*_derived.json"))
    print(f"  Found {len(derived_files)} derived info files.")
    
    for json_file in derived_files:
        try:
            with open(json_file, "r") as f:
                data = json.load(f)
            
            filename = data.get("filename", Path(json_file).stem)
            product_id = extract_product_id(filename)
            print(f"  Processing: {product_id}")
            
            chunks = process_derived_info(data, product_name_lookup)
            for doc, meta, chunk_id in chunks:
                all_documents.append(doc)
                all_metadatas.append(meta)
                all_ids.append(chunk_id)
            
            stats["derived_files_processed"] += 1
            stats["products_indexed"].add(product_id)
            
        except Exception as e:
            error_msg = f"Failed to process {json_file}: {e}"
            print(f"  ERROR: {error_msg}")
            stats["errors"].append(error_msg)
    
    # Ingest all chunks into ChromaDB
    if all_documents:
        print(f"\nIngesting {len(all_documents)} chunks into ChromaDB...")
        try:
            # ChromaDB upserts by ID, so duplicates are handled
            vector_store.add_documents(
                documents=all_documents,
                metadatas=all_metadatas,
                ids=all_ids
            )
            stats["total_chunks_created"] = len(all_documents)
            print(f"  Successfully ingested {len(all_documents)} chunks.")
        except Exception as e:
            error_msg = f"Failed to ingest chunks: {e}"
            print(f"  ERROR: {error_msg}")
            stats["errors"].append(error_msg)
    
    # Convert set to list for JSON serialization
    stats["products_indexed"] = sorted(list(stats["products_indexed"]))
    
    # Print summary
    print("\n" + "=" * 50)
    print("INGESTION SUMMARY")
    print("=" * 50)
    print(f"Base extraction files processed: {stats['base_files_processed']}")
    print(f"Derived info files processed: {stats['derived_files_processed']}")
    print(f"Total chunks created: {stats['total_chunks_created']}")
    print(f"Products indexed: {len(stats['products_indexed'])}")
    print(f"Errors: {len(stats['errors'])}")
    
    if stats["errors"]:
        print("\nErrors encountered:")
        for error in stats["errors"]:
            print(f"  - {error}")
    
    # Run verification if requested
    if verify_after:
        print("\n" + "=" * 50)
        print("VERIFICATION")
        print("=" * 50)
        verify_result = verify_ingestion(vector_store, stats["products_indexed"])
        stats["verification"] = verify_result
    
    return stats


def verify_ingestion(
    vector_store: Optional[ChromaVectorStore] = None,
    expected_products: Optional[List[str]] = None
) -> Dict[str, Any]:
    """Verify that all products have been properly indexed.
    
    Args:
        vector_store: ChromaVectorStore instance (created if not provided)
        expected_products: List of expected product IDs
        
    Returns:
        Dictionary with verification results
    """
    if vector_store is None:
        vector_store = ChromaVectorStore()
    
    result = {
        "success": True,
        "total_documents": 0,
        "products_found": [],
        "missing_products": [],
        "chunk_types_found": set(),
        "sample_queries": [],
    }
    
    # Get document count
    result["total_documents"] = vector_store.count()
    print(f"Total documents in ChromaDB: {result['total_documents']}")
    
    # Get all unique products
    result["products_found"] = vector_store.list_unique_products()
    print(f"Products found: {len(result['products_found'])}")
    for product in result["products_found"]:
        print(f"  ✓ {product}")
    
    # Check for missing products
    if expected_products:
        missing = set(expected_products) - set(result["products_found"])
        result["missing_products"] = sorted(list(missing))
        if result["missing_products"]:
            result["success"] = False
            print(f"\nMissing products: {len(result['missing_products'])}")
            for product in result["missing_products"]:
                print(f"  ✗ {product}")
    
    # Get chunk type distribution
    all_meta = vector_store.get_all_metadata()
    if all_meta["metadatas"]:
        for meta in all_meta["metadatas"]:
            if meta and "chunk_type" in meta:
                result["chunk_types_found"].add(meta["chunk_type"])
    
    result["chunk_types_found"] = sorted(list(result["chunk_types_found"]))
    print(f"\nChunk types found: {result['chunk_types_found']}")
    
    # Run sample queries
    sample_queries = [
        "epoxy curing agent",
        "viscosity properties",
        "chemical anhydride",
    ]
    
    print("\nSample query tests:")
    for query in sample_queries:
        try:
            results = vector_store.query(query, n_results=3)
            if results["ids"] and results["ids"][0]:
                result["sample_queries"].append({
                    "query": query,
                    "success": True,
                    "results_count": len(results["ids"][0]),
                })
                print(f"  ✓ '{query}' - {len(results['ids'][0])} results")
            else:
                result["sample_queries"].append({
                    "query": query,
                    "success": False,
                    "results_count": 0,
                })
                result["success"] = False
                print(f"  ✗ '{query}' - No results")
        except Exception as e:
            result["sample_queries"].append({
                "query": query,
                "success": False,
                "error": str(e),
            })
            result["success"] = False
            print(f"  ✗ '{query}' - Error: {e}")
    
    # Final verdict
    print("\n" + "-" * 50)
    if result["success"]:
        print("✅ VERIFICATION PASSED")
    else:
        print("❌ VERIFICATION FAILED")
    
    return result


def main():
    """Main entry point with CLI argument parsing."""
    parser = argparse.ArgumentParser(
        description="Ingest reference data into ChromaDB"
    )
    parser.add_argument(
        "--clear",
        action="store_true",
        help="Clear existing data before ingestion"
    )
    parser.add_argument(
        "--verify",
        action="store_true",
        help="Run verification after ingestion"
    )
    parser.add_argument(
        "--verify-only",
        action="store_true",
        help="Only run verification (no ingestion)"
    )
    
    args = parser.parse_args()
    
    if args.verify_only:
        print("Running verification only...\n")
        verify_ingestion()
    else:
        ingest_reference_data(
            clear_existing=args.clear,
            verify_after=args.verify
        )


if __name__ == "__main__":
    main()
