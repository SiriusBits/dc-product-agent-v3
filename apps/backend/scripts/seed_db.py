import json
import os
from pathlib import Path
from dc_agent.vector.chroma import ChromaVectorStore
from dc_agent.kg.neo4j import Neo4jKGStore

def seed():
    # Paths
    root_dir = Path(__file__).resolve().parent.parent.parent.parent
    metadata_path = root_dir / "samples" / "sample.metadata.json"
    
    if not metadata_path.exists():
        print(f"Metadata file not found: {metadata_path}")
        return

    with open(metadata_path, "r") as f:
        metadata = json.load(f)

    print(f"Loaded metadata for: {metadata.get('filename', 'unknown')}")

    # Initialize Stores
    vector_store = ChromaVectorStore()
    kg_store = Neo4jKGStore()

    # Seed Vector DB
    print("Seeding Vector DB...")
    # Create a dummy document content since metadata only has metadata
    content = f"Product: {metadata.get('product_name', 'Unknown')}\nDescription: Sample technical bulletin."
    vector_store.add_documents(
        documents=[content],
        metadatas=[{"source": metadata.get("filename", "sample.pdf")}],
        ids=["doc1"]
    )
    print("Vector DB seeded.")

    # Seed Knowledge Graph
    print("Seeding Knowledge Graph...")
    try:
        kg_store.query_graph("MATCH (n) DETACH DELETE n") # Clear existing
        kg_store.query_graph(
            "CREATE (p:Product {name: $name, filename: $filename})",
            {"name": metadata.get("product_name", "Unknown Product"), "filename": metadata.get("filename", "sample.pdf")}
        )
        print("Knowledge Graph seeded.")
    except Exception as e:
        print(f"Failed to seed KG: {e}")
    finally:
        kg_store.close()

if __name__ == "__main__":
    seed()
