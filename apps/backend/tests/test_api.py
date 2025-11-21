from fastapi.testclient import TestClient
from dc_agent.main import app

client = TestClient(app)

def test_query_endpoint():
    response = client.post(
        "/api/v1/query",
        json={"query": "What is this product?", "top_k": 3}
    )
    assert response.status_code == 200
    data = response.json()
    assert "answer" in data
    assert "sources" in data
    assert len(data["sources"]) > 0

def test_ingest_endpoint():
    response = client.post(
        "/api/v1/ingest",
        json={"source_dir": "/tmp/data"}
    )
    assert response.status_code == 200
    assert response.json()["status"] == "ingestion_started"

def test_list_documents():
    response = client.get("/api/v1/documents")
    assert response.status_code == 200
    assert "documents" in response.json()
