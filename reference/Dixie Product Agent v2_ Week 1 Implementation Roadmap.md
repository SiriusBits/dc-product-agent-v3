# Dixie Product Agent v2: Week 1 Implementation Roadmap

## Overview
This roadmap details the specific steps to augment your existing v2 architecture with Neo4j + Graphiti knowledge graphs and n8n workflow automation within 1 week.

## Prerequisites Checklist
- [ ] MacBook Pro M2 with 64GB RAM ready
- [ ] Ollama installed and running locally (not in Docker)
- [ ] Docker Desktop with sufficient resources allocated
- [ ] Your existing v2 codebase accessible
- [ ] Validated JSON extracts from your validator application

---

## Day 1: Infrastructure Foundation

### Morning (2-3 hours): Neo4j Integration

#### 1. Update docker-compose.yml
```yaml
# Add to your existing docker-compose.yml
services:
  # ... your existing services ...
  
  neo4j:
    image: neo4j:5.15-community
    container_name: dc-docvec-neo4j
    environment:
      NEO4J_AUTH: neo4j/dixiechemical123
      NEO4J_PLUGINS: '["apoc", "graph-data-science"]'
      NEO4J_dbms_security_procedures_unrestricted: "apoc.*,gds.*"
      NEO4J_dbms_memory_heap_initial_size: 1G
      NEO4J_dbms_memory_heap_max_size: 2G
    ports:
      - "7474:7474"  # Browser interface
      - "7687:7687"  # Bolt protocol
    volumes:
      - neo4j_data:/data
      - neo4j_logs:/logs
    networks:
      - dc-docvec-net

volumes:
  neo4j_data:
  neo4j_logs:
```

#### 2. Test Neo4j Setup
```bash
# Start Neo4j
docker-compose up neo4j -d

# Wait for startup (check logs)
docker-compose logs -f neo4j

# Access browser at http://localhost:7474
# Login: neo4j / dixiechemical123
```

#### 3. Install Graphiti in Backend
```bash
cd backend
# Add to pyproject.toml dependencies
echo 'graphiti-core>=0.3.0' >> requirements.txt
uv sync

# Test connection
uv run python -c "
from neo4j import GraphDatabase
driver = GraphDatabase.driver('bolt://localhost:7687', auth=('neo4j', 'dixiechemical123'))
with driver.session() as session:
    result = session.run('RETURN 1 as test')
    print('Neo4j connected:', result.single()['test'])
driver.close()
"
```

### Afternoon (2-3 hours): n8n Setup

#### 1. Add n8n to docker-compose.yml
```yaml
  n8n:
    image: n8nio/n8n:latest
    container_name: dc-docvec-n8n
    environment:
      N8N_BASIC_AUTH_ACTIVE: true
      N8N_BASIC_AUTH_USER: admin
      N8N_BASIC_AUTH_PASSWORD: dixiechemical123
      N8N_HOST: localhost
      N8N_PORT: 5678
      N8N_PROTOCOL: http
      WEBHOOK_URL: http://localhost:5678/
    ports:
      - "5678:5678"
    volumes:
      - n8n_data:/home/node/.n8n
    networks:
      - dc-docvec-net

volumes:
  n8n_data:
```

#### 2. Test n8n Setup
```bash
# Start n8n
docker-compose up n8n -d

# Access at http://localhost:5678
# Login: admin / dixiechemical123
```

#### 3. Create Basic Workflow
- Create simple "Hello World" workflow
- Test webhook endpoint
- Verify connection to your FastAPI backend

### Evening: Environment Configuration

#### Update backend environment variables
```env
# Add to .env.backend.local
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=dixiechemical123
N8N_WEBHOOK_URL=http://localhost:5678/webhook
GRAPHITI_ENABLED=true
```

---

## Day 2: Knowledge Graph Foundation

### Morning (3-4 hours): Graphiti Integration

#### 1. Create KG Service Module
```python
# backend/src/dc_docvec/kg/graphiti_service.py
from graphiti import Graphiti
from neo4j import GraphDatabase
import asyncio
from typing import List, Dict, Any

class GraphitiKGService:
    def __init__(self, neo4j_uri: str, neo4j_user: str, neo4j_password: str):
        self.driver = GraphDatabase.driver(neo4j_uri, auth=(neo4j_user, neo4j_password))
        self.graphiti = Graphiti(self.driver)
    
    async def add_entities(self, entities: List[Dict[str, Any]]):
        """Add entities from your JSON extracts"""
        for entity in entities:
            await self.graphiti.add_entity(
                name=entity['canonical_name'],
                entity_type=entity['type'],
                properties=entity.get('properties', {}),
                source_id=entity.get('source_text', '')
            )
    
    async def add_relationships(self, triples: List[Dict[str, Any]]):
        """Add relationships from your kg_triples"""
        for triple in triples:
            await self.graphiti.add_relationship(
                source_name=triple['subject']['entity_id'],
                target_name=triple['object']['entity_id'] if isinstance(triple['object'], dict) else str(triple['object']),
                relationship_type=triple['predicate'],
                properties={'source_text': triple.get('source_text', '')}
            )
    
    def query_neighbors(self, entity_name: str, max_depth: int = 2):
        """Find related entities"""
        with self.driver.session() as session:
            query = """
            MATCH (n {name: $entity_name})-[r*1..$max_depth]-(related)
            RETURN related.name as name, related.type as type, r
            LIMIT 20
            """
            return session.run(query, entity_name=entity_name, max_depth=max_depth)
```

#### 2. Migrate Existing KG Data
```python
# backend/scripts/migrate_kg_to_neo4j.py
import asyncio
import json
from pathlib import Path
from dc_docvec.kg.graphiti_service import GraphitiKGService

async def migrate_existing_kg():
    kg_service = GraphitiKGService(
        "bolt://localhost:7687", 
        "neo4j", 
        "dixiechemical123"
    )
    
    # Load your existing derived JSON files
    extracts_dir = Path("data/pdf_extracts/v1")
    
    for product_dir in extracts_dir.iterdir():
        if product_dir.is_dir():
            derived_file = product_dir / "derived.json"
            if derived_file.exists():
                with open(derived_file) as f:
                    data = json.load(f)
                
                # Extract entities and relationships
                kg_data = data.get('knowledge_graph', {})
                entities = kg_data.get('entities', [])
                triples = kg_data.get('kg_triples', [])
                
                await kg_service.add_entities(entities)
                await kg_service.add_relationships(triples)
                
                print(f"Migrated {len(entities)} entities and {len(triples)} relationships from {product_dir.name}")

if __name__ == "__main__":
    asyncio.run(migrate_existing_kg())
```

### Afternoon (2-3 hours): Test KG Functionality

#### 1. Run Migration Script
```bash
cd backend
uv run python scripts/migrate_kg_to_neo4j.py
```

#### 2. Verify in Neo4j Browser
```cypher
// Check entity count
MATCH (n) RETURN count(n) as total_entities

// Check relationship count  
MATCH ()-[r]->() RETURN count(r) as total_relationships

// Sample entities by type
MATCH (n) RETURN n.type as entity_type, count(n) as count ORDER BY count DESC

// Sample relationships
MATCH (a)-[r]->(b) RETURN a.name, type(r), b.name LIMIT 10
```

#### 3. Create Basic KG Query Functions
```python
# backend/src/dc_docvec/kg/queries.py
from typing import List, Dict, Any
from .graphiti_service import GraphitiKGService

class KGQueryService:
    def __init__(self, kg_service: GraphitiKGService):
        self.kg_service = kg_service
    
    def find_related_products(self, product_name: str) -> List[Dict[str, Any]]:
        """Find products related by application, chemical family, etc."""
        with self.kg_service.driver.session() as session:
            query = """
            MATCH (p:CHEMICAL {name: $product_name})-[:used_in|:is_a|:contains]-(related:CHEMICAL)
            RETURN DISTINCT related.name as product, related.type as type
            LIMIT 10
            """
            return [record.data() for record in session.run(query, product_name=product_name)]
    
    def find_by_application(self, application: str) -> List[Dict[str, Any]]:
        """Find products suitable for specific application"""
        with self.kg_service.driver.session() as session:
            query = """
            MATCH (app:APPLICATION {name: $application})<-[:used_as]-(product:CHEMICAL)
            RETURN product.name as product, product.canonical_name as canonical_name
            """
            return [record.data() for record in session.run(query, application=application)]
```

---

## Day 3: Enhanced RAG Pipeline

### Morning (3-4 hours): Hybrid Retrieval Implementation

#### 1. Create Hybrid Retrieval Service
```python
# backend/src/dc_docvec/retrieval/hybrid_service.py
from typing import List, Dict, Any, Optional
from dataclasses import dataclass
import asyncio

@dataclass
class RetrievalResult:
    content: str
    score: float
    source: str  # 'vector', 'kg', 'hybrid'
    metadata: Dict[str, Any]

class HybridRetrievalService:
    def __init__(self, vector_store, kg_service, reranker=None):
        self.vector_store = vector_store
        self.kg_service = kg_service
        self.reranker = reranker
    
    async def search(self, query: str, k: int = 10) -> List[RetrievalResult]:
        """Hybrid search combining vector and KG results"""
        
        # 1. Vector search
        vector_results = await self._vector_search(query, k=k//2)
        
        # 2. KG-enhanced search
        kg_results = await self._kg_enhanced_search(query, k=k//2)
        
        # 3. Combine and deduplicate
        combined_results = self._combine_results(vector_results, kg_results)
        
        # 4. Re-rank if available
        if self.reranker:
            combined_results = await self._rerank(query, combined_results)
        
        return combined_results[:k]
    
    async def _vector_search(self, query: str, k: int) -> List[RetrievalResult]:
        """Traditional vector similarity search"""
        # Use your existing ChromaDB search
        results = self.vector_store.similarity_search_with_score(query, k=k)
        
        return [
            RetrievalResult(
                content=doc.page_content,
                score=score,
                source='vector',
                metadata=doc.metadata
            )
            for doc, score in results
        ]
    
    async def _kg_enhanced_search(self, query: str, k: int) -> List[RetrievalResult]:
        """KG-enhanced search for related entities"""
        # Extract entities from query (simple keyword matching for now)
        potential_entities = self._extract_entities_from_query(query)
        
        kg_results = []
        for entity in potential_entities:
            neighbors = self.kg_service.query_neighbors(entity, max_depth=2)
            for neighbor in neighbors:
                # Convert KG results to retrieval format
                kg_results.append(
                    RetrievalResult(
                        content=f"Related to {entity}: {neighbor['name']}",
                        score=0.8,  # Fixed score for now
                        source='kg',
                        metadata={'entity': entity, 'neighbor': neighbor['name']}
                    )
                )
        
        return kg_results[:k]
    
    def _extract_entities_from_query(self, query: str) -> List[str]:
        """Simple entity extraction - can be enhanced with NER"""
        # For now, match against known product names
        known_products = ["ASA 150", "DCA 467", "ASA 120", "ASA 140"]  # Load from KG
        return [product for product in known_products if product.lower() in query.lower()]
```

#### 2. Update FastAPI Endpoints
```python
# backend/src/dc_docvec/api/chat.py
from ..retrieval.hybrid_service import HybridRetrievalService

@app.post("/api/chat")
async def chat_endpoint(request: ChatRequest):
    # Use hybrid retrieval instead of just vector search
    retrieval_results = await hybrid_service.search(request.query, k=8)
    
    # Enhanced context with KG information
    context = []
    for result in retrieval_results:
        context.append({
            'content': result.content,
            'source': result.source,
            'metadata': result.metadata,
            'score': result.score
        })
    
    # Generate response with enhanced context
    response = await llm_service.generate_response(request.query, context)
    
    return {
        'answer': response,
        'sources': context,
        'kg_enhanced': any(r.source == 'kg' for r in retrieval_results)
    }
```

### Afternoon (2-3 hours): Query Routing Logic

#### 1. Implement Query Classification
```python
# backend/src/dc_docvec/retrieval/query_router.py
from enum import Enum
from typing import Dict, Any
import re

class QueryType(Enum):
    SPECIFICATION = "specification"  # "What's the viscosity of..."
    APPLICATION = "application"     # "What products work for..."
    COMPARISON = "comparison"       # "Compare ASA 150 and ASA 140"
    RELATIONSHIP = "relationship"   # "What's related to..."
    GENERAL = "general"            # Everything else

class QueryRouter:
    def __init__(self):
        self.patterns = {
            QueryType.SPECIFICATION: [
                r"what.*(viscosity|temperature|density|properties)",
                r"(viscosity|temperature|density) of",
                r"specifications? for"
            ],
            QueryType.APPLICATION: [
                r"what products?.*(for|work|suitable)",
                r"(applications?|uses?) for",
                r"products? that"
            ],
            QueryType.COMPARISON: [
                r"compare.*and",
                r"difference between",
                r"vs\.|versus"
            ],
            QueryType.RELATIONSHIP: [
                r"related to",
                r"similar to",
                r"alternatives? to"
            ]
        }
    
    def classify_query(self, query: str) -> QueryType:
        """Classify query to determine optimal retrieval strategy"""
        query_lower = query.lower()
        
        for query_type, patterns in self.patterns.items():
            for pattern in patterns:
                if re.search(pattern, query_lower):
                    return query_type
        
        return QueryType.GENERAL
    
    def get_retrieval_strategy(self, query_type: QueryType) -> Dict[str, Any]:
        """Return optimal retrieval parameters for query type"""
        strategies = {
            QueryType.SPECIFICATION: {
                'vector_weight': 0.7,
                'kg_weight': 0.3,
                'focus_metadata': ['properties', 'specifications']
            },
            QueryType.APPLICATION: {
                'vector_weight': 0.5,
                'kg_weight': 0.5,
                'focus_metadata': ['applications', 'uses']
            },
            QueryType.COMPARISON: {
                'vector_weight': 0.4,
                'kg_weight': 0.6,
                'focus_metadata': ['properties', 'specifications']
            },
            QueryType.RELATIONSHIP: {
                'vector_weight': 0.3,
                'kg_weight': 0.7,
                'focus_metadata': ['relationships', 'similar_products']
            },
            QueryType.GENERAL: {
                'vector_weight': 0.6,
                'kg_weight': 0.4,
                'focus_metadata': []
            }
        }
        
        return strategies.get(query_type, strategies[QueryType.GENERAL])
```

---

## Day 4: n8n Workflow Integration

### Morning (3-4 hours): Basic Workflows

#### 1. Create Data Refresh Workflow
In n8n interface (http://localhost:5678):

**Workflow: "Daily Data Refresh"**
1. **Schedule Trigger**: Daily at 2 AM
2. **HTTP Request**: Call validator export API
3. **HTTP Request**: Call v2 refresh endpoint
4. **Condition**: Check if successful
5. **Slack/Email**: Send notification (optional)

#### 2. Create Query Enhancement Workflow
**Workflow: "Complex Query Handler"**
1. **Webhook Trigger**: Receive complex queries
2. **Code Node**: Classify query complexity
3. **Switch Node**: Route based on complexity
4. **HTTP Request**: Call appropriate LLM service
5. **HTTP Request**: Return enhanced response

#### 3. Test Workflows
```python
# Test webhook from your FastAPI app
import httpx

async def test_n8n_webhook():
    webhook_url = "http://localhost:5678/webhook/complex-query"
    data = {
        "query": "Compare viscosity of ASA 150 vs ASA 140 at different temperatures",
        "complexity": "high"
    }
    
    async with httpx.AsyncClient() as client:
        response = await client.post(webhook_url, json=data)
        print(f"n8n response: {response.json()}")
```

### Afternoon (2-3 hours): Integration Testing

#### 1. End-to-End Testing
```python
# backend/tests/test_hybrid_retrieval.py
import pytest
from dc_docvec.retrieval.hybrid_service import HybridRetrievalService

@pytest.mark.asyncio
async def test_hybrid_search():
    # Test vector + KG search
    results = await hybrid_service.search("viscosity of ASA 150", k=5)
    
    assert len(results) > 0
    assert any(r.source == 'vector' for r in results)
    # KG results depend on data migration success
    
@pytest.mark.asyncio 
async def test_query_routing():
    router = QueryRouter()
    
    spec_query = "What's the viscosity of DCA 467?"
    assert router.classify_query(spec_query) == QueryType.SPECIFICATION
    
    app_query = "What products work for polyurethane coatings?"
    assert router.classify_query(app_query) == QueryType.APPLICATION
```

#### 2. Performance Testing
```python
# Simple performance test
import time
import asyncio

async def test_response_times():
    queries = [
        "viscosity of ASA 150",
        "products for high temperature applications", 
        "compare ASA 150 and ASA 140",
        "alternatives to DCA 467"
    ]
    
    for query in queries:
        start = time.time()
        results = await hybrid_service.search(query)
        end = time.time()
        
        print(f"Query: {query}")
        print(f"Time: {end - start:.2f}s")
        print(f"Results: {len(results)}")
        print("---")
```

---

## Day 5: Frontend Enhancements

### Morning (3-4 hours): KG Visualization Integration

#### 1. Add Neo4j Visualization Component
```typescript
// frontend/src/components/KnowledgeGraphViewer.tsx
import React, { useEffect, useRef } from 'react';

interface KGViewerProps {
  productName: string;
}

export const KnowledgeGraphViewer: React.FC<KGViewerProps> = ({ productName }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    // Simple D3.js or vis.js integration for KG visualization
    // For MVP, can be a simple network diagram
    loadKnowledgeGraph(productName);
  }, [productName]);
  
  const loadKnowledgeGraph = async (product: string) => {
    try {
      const response = await fetch(`/api/kg/neighbors/${product}`);
      const data = await response.json();
      
      // Render simple network visualization
      renderGraph(data);
    } catch (error) {
      console.error('Failed to load knowledge graph:', error);
    }
  };
  
  return (
    <div className="kg-viewer">
      <h3>Related Products & Concepts</h3>
      <div ref={containerRef} className="graph-container" />
    </div>
  );
};
```

#### 2. Enhanced Search Results
```typescript
// frontend/src/components/SearchResults.tsx
interface SearchResult {
  content: string;
  score: number;
  source: 'vector' | 'kg' | 'hybrid';
  metadata: Record<string, any>;
}

export const SearchResults: React.FC<{results: SearchResult[]}> = ({ results }) => {
  return (
    <div className="search-results">
      {results.map((result, index) => (
        <div key={index} className={`result-card ${result.source}`}>
          <div className="result-header">
            <span className="source-badge">{result.source}</span>
            <span className="score">Score: {result.score.toFixed(2)}</span>
          </div>
          <div className="result-content">{result.content}</div>
          {result.source === 'kg' && (
            <div className="kg-context">
              <small>From knowledge graph: {result.metadata.entity}</small>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
```

### Afternoon (2-3 hours): Demo Scenarios Implementation

#### 1. Create Demo Page
```typescript
// frontend/src/pages/demo.astro
---
import Layout from '../layouts/Layout.astro';
import DemoScenarios from '../components/DemoScenarios.tsx';
---

<Layout title="Dixie Chemical Product Agent Demo">
  <main>
    <h1>Dixie Chemical Technical Data Assistant</h1>
    <p>Intelligent search across 60+ technical bulletins with knowledge graph insights</p>
    
    <DemoScenarios client:load />
  </main>
</Layout>
```

#### 2. Demo Scenarios Component
```typescript
// frontend/src/components/DemoScenarios.tsx
const DEMO_SCENARIOS = [
  {
    title: "Product Discovery",
    query: "What products work for high-temperature polyurethane coatings?",
    description: "Find products by application and performance requirements"
  },
  {
    title: "Specification Lookup", 
    query: "What's the viscosity of DCA 467 at 25°C?",
    description: "Get specific technical properties with citations"
  },
  {
    title: "Application Guidance",
    query: "Show me products suitable for food-contact applications",
    description: "Filter by regulatory and safety requirements"
  },
  {
    title: "Relationship Exploration",
    query: "What other products are similar to ASA 150?",
    description: "Discover related products through knowledge graph"
  }
];

export const DemoScenarios: React.FC = () => {
  const [selectedScenario, setSelectedScenario] = useState(null);
  const [results, setResults] = useState(null);
  
  const runScenario = async (scenario) => {
    setSelectedScenario(scenario);
    
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: scenario.query })
    });
    
    const data = await response.json();
    setResults(data);
  };
  
  return (
    <div className="demo-scenarios">
      <div className="scenario-buttons">
        {DEMO_SCENARIOS.map((scenario, index) => (
          <button 
            key={index}
            onClick={() => runScenario(scenario)}
            className="scenario-btn"
          >
            {scenario.title}
          </button>
        ))}
      </div>
      
      {selectedScenario && (
        <div className="scenario-results">
          <h3>{selectedScenario.title}</h3>
          <p><strong>Query:</strong> {selectedScenario.query}</p>
          
          {results && (
            <>
              <div className="answer">
                <h4>Answer:</h4>
                <p>{results.answer}</p>
              </div>
              
              <SearchResults results={results.sources} />
              
              {results.kg_enhanced && (
                <div className="kg-indicator">
                  ✨ Enhanced with knowledge graph insights
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};
```

---

## Day 6: Testing & Optimization

### Morning (3-4 hours): Comprehensive Testing

#### 1. Integration Tests
```python
# backend/tests/test_integration.py
import pytest
import asyncio
from httpx import AsyncClient
from dc_docvec.api import app

@pytest.mark.asyncio
async def test_chat_endpoint_with_kg():
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.post("/api/chat", json={
            "query": "What products are similar to ASA 150?"
        })
        
        assert response.status_code == 200
        data = response.json()
        
        assert "answer" in data
        assert "sources" in data
        assert len(data["sources"]) > 0
        
        # Check if KG was used
        kg_sources = [s for s in data["sources"] if s["source"] == "kg"]
        assert len(kg_sources) > 0  # Should have KG results for similarity query

@pytest.mark.asyncio
async def test_kg_neighbors_endpoint():
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.get("/api/kg/neighbors/ASA%20150")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "neighbors" in data
        assert len(data["neighbors"]) > 0
```

#### 2. Performance Optimization
```python
# backend/src/dc_docvec/retrieval/optimized_hybrid.py
import asyncio
from concurrent.futures import ThreadPoolExecutor

class OptimizedHybridService(HybridRetrievalService):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.executor = ThreadPoolExecutor(max_workers=4)
    
    async def search(self, query: str, k: int = 10) -> List[RetrievalResult]:
        """Optimized parallel search"""
        
        # Run vector and KG searches in parallel
        vector_task = asyncio.create_task(self._vector_search(query, k//2))
        kg_task = asyncio.create_task(self._kg_enhanced_search(query, k//2))
        
        vector_results, kg_results = await asyncio.gather(vector_task, kg_task)
        
        # Rest of the method remains the same
        combined_results = self._combine_results(vector_results, kg_results)
        
        if self.reranker:
            combined_results = await self._rerank(query, combined_results)
        
        return combined_results[:k]
```

### Afternoon (2-3 hours): Demo Preparation

#### 1. Create Demo Data Validation
```python
# backend/scripts/validate_demo_data.py
import asyncio
from dc_docvec.kg.graphiti_service import GraphitiKGService

async def validate_demo_readiness():
    """Ensure all demo scenarios will work"""
    
    kg_service = GraphitiKGService("bolt://localhost:7687", "neo4j", "dixiechemical123")
    
    # Check key entities exist
    key_products = ["ASA 150", "DCA 467", "ASA 120", "ASA 140"]
    
    with kg_service.driver.session() as session:
        for product in key_products:
            result = session.run("MATCH (n {name: $name}) RETURN count(n) as count", name=product)
            count = result.single()["count"]
            print(f"{product}: {count} entities found")
            
            if count == 0:
                print(f"WARNING: {product} not found in knowledge graph!")
        
        # Check relationship diversity
        rel_query = "MATCH ()-[r]->() RETURN type(r) as rel_type, count(r) as count ORDER BY count DESC LIMIT 10"
        relationships = session.run(rel_query)
        
        print("\nTop relationship types:")
        for record in relationships:
            print(f"  {record['rel_type']}: {record['count']}")

if __name__ == "__main__":
    asyncio.run(validate_demo_readiness())
```

#### 2. Performance Benchmarking
```python
# backend/scripts/benchmark_queries.py
import time
import asyncio
from dc_docvec.retrieval.hybrid_service import HybridRetrievalService

BENCHMARK_QUERIES = [
    "What's the viscosity of ASA 150?",
    "Products for polyurethane coatings",
    "Compare ASA 150 and ASA 140", 
    "Alternatives to DCA 467",
    "High temperature applications",
    "Food contact safe products",
    "Corrosion inhibitors",
    "Low viscosity products"
]

async def benchmark_performance():
    """Benchmark query performance for demo"""
    
    results = []
    
    for query in BENCHMARK_QUERIES:
        start_time = time.time()
        
        try:
            search_results = await hybrid_service.search(query, k=5)
            end_time = time.time()
            
            results.append({
                'query': query,
                'time': end_time - start_time,
                'results_count': len(search_results),
                'kg_enhanced': any(r.source == 'kg' for r in search_results),
                'status': 'success'
            })
            
        except Exception as e:
            results.append({
                'query': query,
                'time': 0,
                'results_count': 0,
                'kg_enhanced': False,
                'status': f'error: {str(e)}'
            })
    
    # Print benchmark report
    print("Performance Benchmark Results:")
    print("=" * 50)
    
    total_time = sum(r['time'] for r in results if r['status'] == 'success')
    success_count = len([r for r in results if r['status'] == 'success'])
    
    for result in results:
        status_icon = "✅" if result['status'] == 'success' else "❌"
        kg_icon = "🔗" if result['kg_enhanced'] else "📊"
        
        print(f"{status_icon} {kg_icon} {result['query'][:40]:<40} {result['time']:.2f}s ({result['results_count']} results)")
    
    print("=" * 50)
    print(f"Average response time: {total_time/success_count:.2f}s")
    print(f"Success rate: {success_count}/{len(BENCHMARK_QUERIES)} ({success_count/len(BENCHMARK_QUERIES)*100:.1f}%)")

if __name__ == "__main__":
    asyncio.run(benchmark_performance())
```

---

## Day 7: Deployment & Demo Polish

### Morning (3-4 hours): DigitalOcean Deployment

#### 1. Prepare Production Configuration
```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    environment:
      - ENVIRONMENT=production
      - NEO4J_URI=bolt://neo4j:7687
      - OLLAMA_BASE_URL=http://host.docker.internal:11434  # External Ollama
    depends_on:
      - neo4j
      - qdrant
    
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    environment:
      - API_BASE_URL=https://your-domain.com/api
    
  neo4j:
    image: neo4j:5.15-community
    environment:
      - NEO4J_AUTH=neo4j/your_secure_password
    volumes:
      - neo4j_data:/data
    
  n8n:
    image: n8nio/n8n:latest
    environment:
      - N8N_BASIC_AUTH_ACTIVE=true
      - N8N_BASIC_AUTH_USER=admin
      - N8N_BASIC_AUTH_PASSWORD=your_secure_password
    volumes:
      - n8n_data:/home/node/.n8n

volumes:
  neo4j_data:
  n8n_data:
```

#### 2. Deploy to DigitalOcean
```bash
# Create droplet and setup
doctl compute droplet create dixie-product-agent \
  --size s-4vcpu-8gb \
  --image docker-20-04 \
  --region nyc1 \
  --ssh-keys your_ssh_key_id

# SSH to droplet and setup
ssh root@your_droplet_ip

# Install docker-compose
curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Clone your repo and deploy
git clone your_repo_url
cd dixie-product-agent-v2
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### Afternoon (2-3 hours): Final Demo Polish

#### 1. Create Demo Landing Page
```typescript
// frontend/src/pages/index.astro
---
import Layout from '../layouts/Layout.astro';
---

<Layout title="Dixie Chemical Technical Data Assistant">
  <main class="demo-landing">
    <header class="hero">
      <h1>Dixie Chemical Technical Data Assistant</h1>
      <p class="subtitle">AI-powered search across 60+ technical bulletins with knowledge graph insights</p>
      
      <div class="demo-stats">
        <div class="stat">
          <span class="number">60+</span>
          <span class="label">Technical Bulletins</span>
        </div>
        <div class="stat">
          <span class="number">1,200+</span>
          <span class="label">Data Points</span>
        </div>
        <div class="stat">
          <span class="number">500+</span>
          <span class="label">Knowledge Graph Entities</span>
        </div>
      </div>
      
      <a href="/demo" class="cta-button">Start Demo</a>
    </header>
    
    <section class="features">
      <div class="feature">
        <h3>🔍 Intelligent Search</h3>
        <p>Vector similarity search combined with knowledge graph traversal</p>
      </div>
      <div class="feature">
        <h3>🔗 Relationship Discovery</h3>
        <p>Find related products, applications, and technical specifications</p>
      </div>
      <div class="feature">
        <h3>📊 Verified Citations</h3>
        <p>Every answer includes page references and source documentation</p>
      </div>
    </section>
  </main>
</Layout>
```

#### 2. Final Testing Checklist
```markdown
## Demo Readiness Checklist

### Infrastructure
- [ ] Neo4j accessible and populated
- [ ] n8n workflows functional
- [ ] FastAPI backend responding
- [ ] Astro frontend loading
- [ ] All services healthy

### Data Quality
- [ ] All 60+ products in knowledge graph
- [ ] Vector embeddings generated
- [ ] Relationships properly connected
- [ ] Demo queries return results

### Performance
- [ ] Query response time < 3 seconds
- [ ] No timeout errors
- [ ] Graceful error handling
- [ ] Mobile responsive design

### Demo Scenarios
- [ ] Product discovery works
- [ ] Specification lookup accurate
- [ ] Application guidance relevant
- [ ] Relationship exploration functional

### Business Requirements
- [ ] Non-technical friendly interface
- [ ] Clear value proposition visible
- [ ] Professional appearance
- [ ] Stable and reliable
```

---

## Success Metrics & Validation

### Technical Validation
- [ ] All services start without errors
- [ ] Knowledge graph contains 500+ entities
- [ ] Vector search returns relevant results
- [ ] Hybrid search shows KG enhancement
- [ ] Response times under 3 seconds

### Business Validation
- [ ] Demo scenarios work end-to-end
- [ ] Results are accurate and relevant
- [ ] Interface is intuitive for non-technical users
- [ ] Value proposition is clear
- [ ] System appears professional and reliable

### Demo Day Preparation
- [ ] Backup deployment ready
- [ ] Demo script prepared
- [ ] Fallback scenarios identified
- [ ] Performance monitoring active
- [ ] Support contact information ready

---

## Troubleshooting Guide

### Common Issues

**Neo4j Connection Errors:**
```bash
# Check Neo4j logs
docker-compose logs neo4j

# Verify connection
docker exec -it dc-docvec-neo4j cypher-shell -u neo4j -p dixiechemical123
```

**Slow Query Performance:**
```python
# Add query timing
import time
start = time.time()
results = await hybrid_service.search(query)
print(f"Query took {time.time() - start:.2f}s")
```

**Missing Knowledge Graph Data:**
```bash
# Re-run migration
cd backend
uv run python scripts/migrate_kg_to_neo4j.py
```

**n8n Workflow Failures:**
- Check n8n logs in interface
- Verify webhook URLs
- Test individual nodes

This roadmap provides a concrete path to enhance your existing v2 architecture with knowledge graphs and workflow automation within your 1-week timeline and budget constraints.

