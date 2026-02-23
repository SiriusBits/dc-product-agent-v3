import asyncio
import json
import logging
from pathlib import Path

from dc_agent.vector.chroma import ChromaVectorStore
from dc_agent.kg.neo4j import Neo4jKGStore

logger = logging.getLogger(__name__)


async def seed_async() -> None:
    # Paths
    root_dir = Path(__file__).resolve().parent.parent.parent.parent
    metadata_path = root_dir / "samples" / "sample.metadata.json"

    if not metadata_path.exists():
        logger.error("Metadata file not found: %s", metadata_path)
        return

    with open(metadata_path, "r") as f:
        metadata = json.load(f)

    logger.info("Loaded metadata for: %s", metadata.get("filename", "unknown"))

    # Initialize Stores
    vector_store = ChromaVectorStore()

    # Seed Vector DB
    logger.info("Seeding Vector DB...")
    content = (
        f"Product: {metadata.get('product_name', 'Unknown')}\n"
        "Description: Sample technical bulletin."
    )
    vector_store.add_documents(
        documents=[content],
        metadatas=[{"source": metadata.get("filename", "sample.pdf")}],
        ids=["doc1"],
    )
    logger.info("Vector DB seeded.")

    # Seed Knowledge Graph
    logger.info("Seeding Knowledge Graph...")
    async with Neo4jKGStore() as kg_store:
        try:
            await kg_store.execute("MATCH (n) DETACH DELETE n")
            await kg_store.execute(
                "CREATE (p:Product {name: $name, filename: $filename})",
                {
                    "name": metadata.get("product_name", "Unknown Product"),
                    "filename": metadata.get("filename", "sample.pdf"),
                },
            )
            logger.info("Knowledge Graph seeded.")
        except Exception:
            logger.exception("Failed to seed KG")


def seed() -> None:
    asyncio.run(seed_async())


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    seed()
