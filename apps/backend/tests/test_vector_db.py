import pytest
import shutil
from pathlib import Path
from dc_agent.vector.chroma import ChromaVectorStore
from dc_agent.config import settings

# Use a temporary directory for testing
TEST_CHROMA_DIR = "data/test_chroma"
settings.CHROMA_PERSIST_DIRECTORY = TEST_CHROMA_DIR
settings.CHROMA_COLLECTION_NAME = "test_collection"

@pytest.fixture(scope="module")
def vector_store():
    # Setup
    if Path(TEST_CHROMA_DIR).exists():
        shutil.rmtree(TEST_CHROMA_DIR)
    
    store = ChromaVectorStore()
    yield store
    
    # Teardown
    if Path(TEST_CHROMA_DIR).exists():
        shutil.rmtree(TEST_CHROMA_DIR)

def test_add_and_query(vector_store):
    docs = ["This is a document about chemistry.", "This is a document about physics."]
    metadatas = [{"source": "chem"}, {"source": "phys"}]
    ids = ["doc1", "doc2"]
    
    vector_store.add_documents(docs, metadatas, ids)
    
    results = vector_store.query("chemistry", n_results=1)
    assert len(results["ids"][0]) == 1
    assert results["ids"][0][0] == "doc1"

def test_delete(vector_store):
    vector_store.delete_document("doc1")
    
    results = vector_store.query("chemistry", n_results=1)
    # Should return doc2 or nothing relevant, but definitely not doc1
    if results["ids"][0]:
        assert results["ids"][0][0] != "doc1"
