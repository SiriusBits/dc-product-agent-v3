import os
import requests
import sys
from dc_agent.vector.chroma import ChromaVectorStore
from dc_agent.kg.neo4j import Neo4jKGStore
from dc_agent.config import settings

def verify_ingestion():
    print("Starting Verification...")
    
    # 1. Verify Chroma
    print("\n--- Verifying Chroma ---")
    try:
        vector_store = ChromaVectorStore()
        # Query for a known product or generic term
        results = vector_store.query("MHHPA", n_results=1)
        if results and results['ids'] and results['ids'][0]:
            print("✅ Chroma: Data found.")
            print(f"   Sample ID: {results['ids'][0][0]}")
        else:
            print("❌ Chroma: No data found for query 'MHHPA'.")
    except Exception as e:
        print(f"❌ Chroma: Connection failed - {e}")

    # 2. Verify Neo4j
    print("\n--- Verifying Neo4j ---")
    try:
        kg_store = Neo4jKGStore()
        # Simple count query
        data = kg_store.query_graph("MATCH (n:Entity) RETURN count(n) as count")
        if data and data[0]['count'] > 0:
            print(f"✅ Neo4j: {data[0]['count']} Entities found.")
        else:
            print("❌ Neo4j: No Entities found.")
        kg_store.close()
    except Exception as e:
        print(f"❌ Neo4j: Connection failed - {e}")

    # 3. Verify Static Files
    print("\n--- Verifying Static Files ---")
    # Assuming backend is running on localhost:8000
    base_url = "http://localhost:8000"
    
    # Test PDF
    pdf_path = "MHHPA_301_Technical_Bulletin.pdf" # Replace with a known existing file
    pdf_url = f"{base_url}/static/pdfs/{pdf_path}"
    try:
        r = requests.head(pdf_url)
        if r.status_code == 200:
            print(f"✅ PDF Access: {pdf_path} is accessible.")
        else:
            print(f"❌ PDF Access: {pdf_path} not found (Status: {r.status_code}).")
    except Exception as e:
        print(f"❌ PDF Access: Check failed - {e}")

    # Test Image
    # Replace with a known image if you know the exact name, or list directory first
    # For now, we'll try a likely candidate or skip specific check if unknown
    
    print("\nVerification Complete.")

if __name__ == "__main__":
    verify_ingestion()
