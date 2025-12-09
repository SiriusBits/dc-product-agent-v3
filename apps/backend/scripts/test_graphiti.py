import asyncio
import os
from dc_agent.kg.graphiti_store import GraphitiKGStore

async def test_graphiti():
    print("Testing Graphiti Integration...")
    
    # Initialize store
    try:
        store = GraphitiKGStore()
        print("✅ GraphitiKGStore initialized.")
    except Exception as e:
        print(f"❌ Failed to initialize GraphitiKGStore: {e}")
        return

    # Test Ingestion
    test_name = "Test Product MHHPA"
    test_text = (
        "MHHPA (Methyl Hexahydrophthalic Anhydride) is a curing agent for epoxy resins. "
        "It provides excellent electrical properties and high temperature resistance. "
        "Dixie Chemical is a leading supplier of MHHPA."
    )
    
    print(f"\nIngesting episode: '{test_name}'...")
    try:
        await store.add_episode(name=test_name, text=test_text, source_url="test_script")
        print("✅ Episode added successfully.")
    except Exception as e:
        print(f"❌ Failed to add episode: {e}")
        # If this fails (e.g. connection refused), likely Neo4j is down or credentials wrong.
    
    # Test Search
    query = "What is MHHPA?"
    print(f"\nSearching for: '{query}'...")
    try:
        results = await store.search(query)
        print(f"✅ Search successful. Results:\n{results}")
    except Exception as e:
        print(f"❌ Search failed: {e}")

    store.close()

if __name__ == "__main__":
    asyncio.run(test_graphiti())
