// Neo4j Knowledge Graph Initialization Script
// This script sets up the initial schema, constraints, and indexes for the Dixie Chemical Product Agent

// Create constraints for unique entities
CREATE CONSTRAINT chemical_name_unique IF NOT EXISTS FOR (c:Chemical) REQUIRE c.name IS UNIQUE;
CREATE CONSTRAINT product_name_unique IF NOT EXISTS FOR (p:Product) REQUIRE p.name IS UNIQUE;
CREATE CONSTRAINT application_name_unique IF NOT EXISTS FOR (a:Application) REQUIRE a.name IS UNIQUE;
CREATE CONSTRAINT property_name_unique IF NOT EXISTS FOR (pr:Property) REQUIRE pr.name IS UNIQUE;
CREATE CONSTRAINT test_method_name_unique IF NOT EXISTS FOR (tm:TestMethod) REQUIRE tm.name IS UNIQUE;

// Create indexes for frequently queried properties
CREATE INDEX chemical_cas_index IF NOT EXISTS FOR (c:Chemical) ON (c.cas_number);
CREATE INDEX product_family_index IF NOT EXISTS FOR (p:Product) ON (p.family);
CREATE INDEX property_category_index IF NOT EXISTS FOR (pr:Property) ON (pr.category);
CREATE INDEX application_category_index IF NOT EXISTS FOR (a:Application) ON (a.category);

// Create full-text search indexes
CREATE FULLTEXT INDEX chemical_search IF NOT EXISTS FOR (c:Chemical) ON EACH [c.name, c.synonyms, c.description];
CREATE FULLTEXT INDEX product_search IF NOT EXISTS FOR (p:Product) ON EACH [p.name, p.short_name, p.description, p.key_benefits];
CREATE FULLTEXT INDEX application_search IF NOT EXISTS FOR (a:Application) ON EACH [a.name, a.description, a.industry];

// Create sample data structure (will be populated by ingestion pipeline)
// This creates the basic node types that will be used by Graphiti

// Chemical entities
MERGE (chemical_type:EntityType {name: 'Chemical', description: 'Chemical compounds and substances'});
MERGE (product_type:EntityType {name: 'Product', description: 'Commercial chemical products'});
MERGE (application_type:EntityType {name: 'Application', description: 'Use cases and applications'});
MERGE (property_type:EntityType {name: 'Property', description: 'Chemical and physical properties'});
MERGE (test_method_type:EntityType {name: 'TestMethod', description: 'Testing and measurement methods'});

// Relationship types
MERGE (has_property_rel:RelationType {name: 'HAS_PROPERTY', description: 'Product has a specific property value'});
MERGE (used_in_rel:RelationType {name: 'USED_IN', description: 'Product is used in application'});
MERGE (similar_to_rel:RelationType {name: 'SIMILAR_TO', description: 'Products with similar properties or applications'});
MERGE (tested_by_rel:RelationType {name: 'TESTED_BY', description: 'Property measured using test method'});
MERGE (belongs_to_rel:RelationType {name: 'BELONGS_TO', description: 'Product belongs to family'});

// Create initial admin user for Graphiti (if needed)
MERGE (admin:User {username: 'admin', role: 'administrator', created_at: datetime()});

RETURN 'Neo4j knowledge graph initialized successfully' AS status;