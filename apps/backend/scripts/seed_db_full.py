import json
import os
import re
from pathlib import Path
from typing import List, Dict, Any
# from tqdm import tqdm
from dc_agent.vector.chroma import ChromaVectorStore
from dc_agent.kg.neo4j import Neo4jKGStore

def sanitize_relationship_type(rel_type: str) -> str:
    """Sanitize relationship type to be safe for Cypher interpolation."""
    # Replace non-alphanumeric characters with underscores and uppercase
    sanitized = re.sub(r'[^a-zA-Z0-9_]', '_', rel_type).upper()
    return sanitized

def seed_full():
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
    kg_store = Neo4jKGStore()

    # Get all derived files
    derived_files = list(derived_dir.glob("*.json"))
    print(f"Found {len(derived_files)} derived info files.")

    for derived_file in derived_files:
        try:
            # Load Derived Info
            with open(derived_file, "r") as f:
                derived_data = json.load(f)
            
            doc_id = derived_data.get("doc_id")
            filename = derived_data.get("filename")
            
            # Load Base Extraction
            # Try to find base file by convention: {stem}_base.json
            # derived file is {stem}_derived.json
            stem = derived_file.stem.replace("_derived", "")
            base_file = base_dir / f"{stem}_base.json"
            
            if not base_file.exists():
                print(f"Warning: Base file not found for {derived_file.name}, skipping.")
                continue
                
            with open(base_file, "r") as f:
                base_data = json.load(f)

            # --- Vector Store Ingestion ---
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
            
            # Add to Vector Store
            # We use doc_id as the ID to allow for updates/overwrites if supported, 
            # or at least to track it.
            vector_store.add_documents(
                documents=[full_content],
                metadatas=[{
                    "source": filename,
                    "doc_id": doc_id,
                    "product_name": product_name
                }],
                ids=[doc_id]
            )

            # --- Knowledge Graph Ingestion ---
            kg_data = derived_data.get("knowledge_graph", {})
            entities = kg_data.get("entities", [])
            triples = kg_data.get("kg_triples", [])

            # 1. Merge Entities
            for entity in entities:
                entity_id = entity.get("id")
                text = entity.get("text")
                label = entity.get("type", "Entity")
                canonical_name = entity.get("canonical_name", text)
                
                # Sanitize label for Cypher (though usually it's safe from our schema)
                safe_label = sanitize_relationship_type(label)
                
                # Merge node with generic Entity label AND specific type label
                query = (
                    f"MERGE (e:Entity {{id: $id}}) "
                    f"SET e.name = $name, e.text = $text, e.type = $type "
                    f"SET e:{safe_label}"
                )
                kg_store.query_graph(
                    query,
                    {"id": entity_id, "name": canonical_name, "text": text, "type": label}
                )

            # 2. Merge Relationships
            for triple in triples:
                subj_id = triple.get("subject")
                obj_id = triple.get("object")
                predicate = triple.get("predicate")
                
                if not (subj_id and obj_id and predicate):
                    continue
                    
                safe_predicate = sanitize_relationship_type(predicate)
                
                # Merge relationship
                # We match nodes by ID first
                query = (
                    f"MATCH (s:Entity {{id: $subj_id}}), (o:Entity {{id: $obj_id}}) "
                    f"MERGE (s)-[r:{safe_predicate}]->(o) "
                    f"SET r.source_text = $source_text"
                )
                kg_store.query_graph(
                    query,
                    {
                        "subj_id": subj_id, 
                        "obj_id": obj_id, 
                        "source_text": triple.get("source_text", "")
                    }
                )

        except Exception as e:
            print(f"Error processing {derived_file.name}: {e}")

    print("Seeding complete.")
    # Note: We are NOT closing the stores here as they might be used by the app, 
    # but for a script it's good practice if the class supports it.
    # kg_store.close() # Assuming close method exists based on seed_db.py

if __name__ == "__main__":
    seed_full()
