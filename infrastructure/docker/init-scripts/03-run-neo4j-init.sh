#!/bin/bash
# Script to initialize Neo4j knowledge graph after container startup

set -e

echo "Waiting for Neo4j to be ready..."

# Wait for Neo4j to be available
until cypher-shell -u neo4j -p password123 "RETURN 1" > /dev/null 2>&1; do
    echo "Neo4j is not ready yet, waiting..."
    sleep 5
done

echo "Neo4j is ready. Running initialization script..."

# Run the initialization script
cypher-shell -u neo4j -p password123 -f /var/lib/neo4j/import/01-neo4j-init.cypher

echo "Neo4j initialization completed successfully!"