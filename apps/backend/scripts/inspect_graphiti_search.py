import asyncio
import os
import sys

# Add src to path
sys.path.append(os.path.join(os.getcwd(), "apps/backend/src"))

from dc_agent.kg.graphiti_store import GraphitiKGStore

async def main():
    store = GraphitiKGStore()
    
    # We need to make sure we don't need to add an episode first? 
    # We already seeded the DB, so search should work if persistence worked.
    # Graphiti persistence depends on Neo4j which is running.
    
    query = "What is the boiling point of JP-10?"
    print(f"Searching for: {query}")
    try:
        results = await store.search(query)
        print(f"Result Type: {type(results)}")
        print(f"Result Str: {str(results)}")
        print(f"Result Dir: {dir(results)}")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        await store.close()

if __name__ == "__main__":
    asyncio.run(main())
