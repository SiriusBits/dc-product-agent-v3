import json
import os
import glob
from pathlib import Path
from typing import List, Dict, Any
from dc_agent.vector.chroma import ChromaVectorStore
from dc_agent.kg.neo4j import Neo4jKGStore

def ingest_reference_data():
    # Paths
    root_dir = Path(__file__).resolve().parent.parent.parent.parent
    derived_info_dir = root_dir / "data" / "extracts" / "derived_info"
    
    if not derived_info_dir.exists():
        print(f"Derived info directory not found: {derived_info_dir}")
        return

    json_files = glob.glob(str(derived_info_dir / "*_derived.json"))
    if not json_files:
        print("No derived info JSON files found.")
        return

    print(f"Found {len(json_files)} files to ingest.")

    # Initialize Stores
    vector_store = ChromaVectorStore()
    kg_store = Neo4jKGStore()

    # Clear existing data (optional, but good for clean state)
    print("Clearing existing data...")
    try:
        kg_store.query_graph("MATCH (n) DETACH DELETE n")
        # Note: Chroma doesn't have a clear all method exposed in our wrapper easily, 
        # but we can overwrite or just add. For now, we append.
    except Exception as e:
        print(f"Error clearing KG: {e}")

    for json_file in json_files:
        try:
            with open(json_file, "r") as f:
                data = json.load(f)
            
            filename = data.get("filename", "unknown")
            print(f"Processing {filename}...")

            # 1. Ingest into Knowledge Graph
            kg_data = data.get("knowledge_graph", {})
            entities = kg_data.get("entities", [])
            triples = kg_data.get("kg_triples", [])

            # 2. Ingest into Vector Store (Extract summary first for KG)
            derived = data.get("derived_info", {})
            summary = derived.get("summary", "")

            # Create Entities
            for entity in entities:
                # Use 'id' as the unique identifier
                props = {
                    "id": entity.get("id"),
                    "name": entity.get("text"), # Use text as name
                    "type": entity.get("type"),
                    "canonical_name": entity.get("canonical_name"),
                    "filename": filename # Track source
                }
                # Add extra metadata if available
                if entity.get("metadata"):
                    props.update(entity.get("metadata"))
                
                # Add summary to PRODUCT_NAME entities
                if entity.get("type") == "PRODUCT_NAME" and summary:
                    props["description"] = summary

                # Create node with label based on type (sanitized)
                label = entity.get("type", "Entity").replace(" ", "_").upper()
                kg_store.add_entity(label, props)

            # Create Relationships
            entity_ids = {e["id"] for e in entities}
            for triple in triples:
                start_id = triple.get("subject")
                end_id = triple.get("object")
                rel_type = triple.get("predicate", "RELATED_TO").replace(" ", "_").upper()
                
                start_props = {"id": start_id}
                
                # Check if end_id is a dictionary (complex value)
                if isinstance(end_id, dict):
                    # Create a Value node for the complex object
                    # We'll use the 'value' key if present, or stringify the whole dict
                    value_content = end_id.get("value", str(end_id))
                    query = (
                        f"MATCH (a {{id: $start_id}}) "
                        f"MERGE (b:Value {{value: $end_value}}) "
                        f"MERGE (a)-[r:{rel_type}]->(b)"
                    )
                    kg_store.query_graph(query, {"start_id": start_id, "end_value": value_content})
                
                # Check if end_id is a known entity ID
                elif isinstance(end_id, str) and end_id in entity_ids:
                    # Both are entities
                    query = (
                        f"MATCH (a {{id: $start_id}}), (b {{id: $end_id}}) "
                        f"MERGE (a)-[r:{rel_type}]->(b)"
                    )
                    kg_store.query_graph(query, {"start_id": start_id, "end_id": end_id})
                
                else:
                    # Object is a literal value string but not an entity ID
                    # Create a Value node
                    query = (
                        f"MATCH (a {{id: $start_id}}) "
                        f"MERGE (b:Value {{value: $end_value}}) "
                        f"MERGE (a)-[r:{rel_type}]->(b)"
                    )
                    kg_store.query_graph(query, {"start_id": start_id, "end_value": str(end_id)})

            # 2. Ingest into Vector Store
            derived = data.get("derived_info", {})
            summary = derived.get("summary", "")
            personas = derived.get("personas", {})
            
            documents = []
            metadatas = []
            ids = []
            
            # Add Summary
            if summary:
                documents.append(f"Product: {filename}\nType: Summary\nContent: {summary}")
                metadatas.append({"source": filename, "type": "summary", "product": filename})
                ids.append(f"{filename}_summary")
            
            # Add Personas
            for persona_type, text in personas.items():
                documents.append(f"Product: {filename}\nType: {persona_type}\nContent: {text}")
                metadatas.append({"source": filename, "type": persona_type, "product": filename})
                ids.append(f"{filename}_{persona_type}")
            
            if documents:
                vector_store.add_documents(documents=documents, metadatas=metadatas, ids=ids)

        except Exception as e:
            print(f"Failed to process {json_file}: {e}")

    print("Ingestion complete.")
    kg_store.close()

if __name__ == "__main__":
    ingest_reference_data()
