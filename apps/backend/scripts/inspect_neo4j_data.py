import os
import sys
from neo4j import GraphDatabase

# Add src to path
sys.path.append(os.path.join(os.getcwd(), "apps/backend/src"))
from dc_agent.config import settings

def main():
    uri = settings.NEO4J_URI
    user = settings.NEO4J_USER
    password = settings.NEO4J_PASSWORD
    
    driver = GraphDatabase.driver(uri, auth=(user, password))
    
    with driver.session() as session:
        print("--- Node Counts ---")
        result = session.run("MATCH (n) RETURN labels(n) as label, count(n) as count")
        for record in result:
            print(f"{record['label']}: {record['count']}")
            
        print("\n--- Edge Counts ---")
        result = session.run("MATCH ()-[r]->() RETURN type(r) as type, count(r) as count")
        for record in result:
            print(f"{record['type']}: {record['count']}")
            
        print("\n--- Embedding Check (Any Edge) ---")
        result = session.run("MATCH ()-[r]->() WHERE r.fact_embedding IS NOT NULL RETURN count(r) as count")
        for record in result:
            print(f"Edges with embeddings: {record['count']}")

    driver.close()

if __name__ == "__main__":
    main()
