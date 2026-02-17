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
        print("Wiping Neo4j database...")
        session.run("MATCH (n) DETACH DELETE n")
        print("Database wiped.")

    driver.close()

if __name__ == "__main__":
    main()
