import asyncio
import json
import logging
from pathlib import Path
from typing import Any

from dc_agent.vector.chroma import ChromaVectorStore
from dc_agent.kg.graphiti_store import GraphitiKGStore

logger = logging.getLogger(__name__)

async def seed_full_async():
    # Paths
    root_dir = Path(__file__).resolve().parent.parent.parent.parent
    extracts_dir = root_dir / "data" / "extracts"
    derived_dir = extracts_dir / "derived_info"
    base_dir = extracts_dir / "base_extraction"

    if not derived_dir.exists():
        print(f"Derived info directory not found: {derived_dir}")
        return

    # Initialize Stores
    print("Initializing databases...")
    vector_store = ChromaVectorStore()
    kg_store = GraphitiKGStore()

    # Get all derived files
    derived_files = list(derived_dir.glob("*.json"))
    print(f"Found {len(derived_files)} derived info files.")

    for derived_file in derived_files[:1]:
        try:
            # Load Derived Info
            with open(derived_file, "r") as f:
                derived_data = json.load(f)
            
            doc_id = derived_data.get("doc_id")
            filename = derived_data.get("filename")
            
            # Load Base Extraction
            stem = derived_file.stem.replace("_derived", "")
            base_file = base_dir / f"{stem}_base.json"
            
            if not base_file.exists():
                print(f"Warning: Base file not found for {derived_file.name}, skipping.")
                continue
                
            with open(base_file, "r") as f:
                base_data = json.load(f)

            # --- Data Preparation ---
            product_info = base_data.get("product_info", {})
            product_name = product_info.get("product_name", "Unknown Product")
            
            derived_info = derived_data.get("derived_info", {})
            summary = derived_info.get("summary", "")
            personas = derived_info.get("personas", {})
            sales_summary = personas.get("sales_summary", "")
            tech_summary = personas.get("technical_summary", "")
            
            # Construct rich text content
            content_parts = [
                f"Product: {product_name}",
                f"Filename: {filename}",
                f"Summary: {summary}",
                f"Sales Summary: {sales_summary}",
                f"Technical Summary: {tech_summary}",
            ]
            
            if base_data.get("applications_text"):
                content_parts.append(f"Applications: {base_data['applications_text']}")
            
            if base_data.get("key_benefits"):
                benefits = ", ".join(base_data["key_benefits"])
                content_parts.append(f"Key Benefits: {benefits}")

            full_content = "\n\n".join(content_parts)
            
            # --- Vector Store Ingestion ---
            vector_store.add_documents(
                documents=[full_content],
                metadatas=[{
                    "source": filename,
                    "doc_id": doc_id,
                    "product_name": product_name
                }],
                ids=[doc_id]
            )

            # --- Graphiti Ingestion ---
            # We feed the full content as an episode
            print(f"Ingesting {product_name} into Graphiti...")
            # Use a dummy timestamp or current time if not available in data
            # Format: 'YYYY-MM-DDTHH:MM:SS'
            from datetime import datetime
            current_time = datetime.now().isoformat()
            
            await kg_store.add_episode(
                name=product_name,
                text=full_content,
                source_description=f"Technical Bulletin for {product_name} ({filename})",
                reference_time=current_time
            )

        except Exception as e:
            import traceback
            traceback.print_exc()
            print(f"Error processing {derived_file.name}: {e}")

    print("Seeding complete.")
    await kg_store.close()

def seed_full():
    asyncio.run(seed_full_async())

if __name__ == "__main__":
    seed_full()
