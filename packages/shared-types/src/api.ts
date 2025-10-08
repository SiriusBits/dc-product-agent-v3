// API-related types for Dixie Chemical Product Agent

import type { KGEntity, ProductInfo, PropertySpecification } from "./models";

// Base API response structure
export interface ApiResponse<T = any> {
  data: T;
  success: boolean;
  message?: string;
  timestamp: string;
  request_id?: string;
}

export interface ApiError {
  error_code: string;
  message: string;
  details?: Record<string, any>;
  timestamp: string;
  request_id: string;
}

// Query and retrieval types
export enum QueryType {
  SPECIFICATION = "specification",
  APPLICATION = "application",
  COMPARISON = "comparison",
  RELATIONSHIP = "relationship",
  GENERAL = "general",
}

export interface QueryAnalysis {
  query_type: QueryType;
  entities: string[];
  intent_confidence: number;
  suggested_strategy: Record<string, any>;
}

export interface RetrievalResult {
  content: string;
  score: number;
  source: "vector" | "kg" | "hybrid";
  metadata: Record<string, any>;
  provenance: Record<string, any>;
}

// Chat API types
export interface ChatRequest {
  query: string;
  conversation_id?: string;
  max_results?: number;
  include_sources?: boolean;
  query_options?: QueryOptions;
}

export interface QueryOptions {
  vector_weight?: number;
  kg_weight?: number;
  min_confidence?: number;
  max_depth?: number;
  include_images?: boolean;
}

export interface ChatResponse {
  answer: string;
  sources: RetrievalResult[];
  conversation_id: string;
  query_analysis: QueryAnalysis;
  response_time_ms: number;
  kg_enhanced: boolean;
}

export interface ChatMessage {
  id: string;
  content: string;
  role: "user" | "assistant";
  sources?: RetrievalResult[];
  timestamp: Date;
  conversation_id: string;
}

export interface Conversation {
  id: string;
  messages: ChatMessage[];
  created_at: Date;
  updated_at: Date;
  title?: string;
  metadata?: Record<string, any>;
}

// Product API types
export interface ProductSummary {
  id: string;
  name: string;
  short_name: string | null;
  family: string | null;
  cas_number: string | null;
  applications: string[];
  key_properties: string[];
  document_count: number;
}

export interface ProductDetail extends ProductSummary {
  product_info: ProductInfo;
  properties: PropertySpecification[];
  related_products: ProductSummary[];
  knowledge_graph_entities: KGEntity[];
  documents: DocumentSummary[];
}

export interface DocumentSummary {
  doc_id: string;
  filename: string;
  document_type: string;
  manufacturer: string;
  extraction_date: string;
  page_count: number;
  has_images: boolean;
}

export interface ProductSearchRequest {
  query?: string;
  family?: string;
  applications?: string[];
  properties?: PropertyFilter[];
  limit?: number;
  offset?: number;
  sort_by?: "name" | "family" | "relevance";
  sort_order?: "asc" | "desc";
}

export interface PropertyFilter {
  name: string;
  operator: "eq" | "gt" | "lt" | "gte" | "lte" | "range";
  value: number | string;
  max_value?: number; // for range operator
}

export interface ProductSearchResponse {
  products: ProductSummary[];
  total_count: number;
  facets: SearchFacets;
  query_info: {
    processed_query: string;
    filters_applied: PropertyFilter[];
    search_time_ms: number;
  };
}

export interface SearchFacets {
  families: FacetCount[];
  applications: FacetCount[];
  manufacturers: FacetCount[];
  properties: PropertyFacet[];
}

export interface FacetCount {
  value: string;
  count: number;
}

export interface PropertyFacet {
  name: string;
  min_value: number;
  max_value: number;
  unit: string | null;
  count: number;
}

// Knowledge Graph API types
export interface KGQueryRequest {
  entity_name: string;
  relationship_types?: string[];
  max_depth?: number;
  limit?: number;
  include_properties?: boolean;
}

export interface KGQueryResponse {
  central_entity: KGEntity;
  related_entities: KGEntity[];
  relationships: KGRelationship[];
  graph_data: GraphVisualizationData;
}

export interface KGRelationship {
  id: string;
  source_entity_id: string;
  target_entity_id: string;
  relationship_type: string;
  confidence: number;
  source_text?: string;
  provenance: Record<string, any>;
}

export interface GraphVisualizationData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  layout_hints?: Record<string, any>;
}

export interface GraphNode {
  id: string;
  label: string;
  type: string;
  properties: Record<string, any>;
  size?: number;
  color?: string;
  position?: { x: number; y: number };
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  type: string;
  weight?: number;
  color?: string;
}

// Comparison API types
export interface ProductComparisonRequest {
  product_ids: string[];
  comparison_aspects?: ComparisonAspect[];
  include_recommendations?: boolean;
}

export enum ComparisonAspect {
  PROPERTIES = "properties",
  APPLICATIONS = "applications",
  PERFORMANCE = "performance",
  COST = "cost",
  AVAILABILITY = "availability",
}

export interface ProductComparisonResponse {
  products: ProductDetail[];
  comparison_matrix: ComparisonMatrix;
  recommendations: ComparisonRecommendation[];
  analysis_summary: string;
}

export interface ComparisonMatrix {
  aspects: ComparisonAspect[];
  data: ComparisonRow[];
}

export interface ComparisonRow {
  aspect: string;
  property_name?: string;
  values: ComparisonValue[];
  winner?: string; // product_id of best performer
  notes?: string;
}

export interface ComparisonValue {
  product_id: string;
  value: string | number | null;
  unit?: string;
  confidence?: number;
  source?: string;
}

export interface ComparisonRecommendation {
  scenario: string;
  recommended_product_id: string;
  reasoning: string;
  confidence: number;
  trade_offs: string[];
}

// Data ingestion API types
export interface IngestionRequest {
  file_path: string;
  document_type?: string;
  processing_options?: ProcessingOptions;
  force_reprocess?: boolean;
}

export interface ProcessingOptions {
  extract_images?: boolean;
  generate_kg_data?: boolean;
  validate_extraction?: boolean;
  chunk_strategy?: "semantic" | "fixed" | "adaptive";
  embedding_model?: string;
}

export interface IngestionResponse {
  job_id: string;
  status: IngestionStatus;
  document_id?: string;
  processing_time_ms?: number;
  validation_results?: ValidationResult[];
  errors?: string[];
}

export enum IngestionStatus {
  QUEUED = "queued",
  PROCESSING = "processing",
  COMPLETED = "completed",
  FAILED = "failed",
  CANCELLED = "cancelled",
}

export interface ValidationResult {
  field: string;
  status: "valid" | "warning" | "error";
  message: string;
  confidence?: number;
}

// System status and health types
export interface SystemStatus {
  status: "healthy" | "degraded" | "unhealthy";
  services: ServiceStatus[];
  version: string;
  uptime_seconds: number;
  last_updated: string;
}

export interface ServiceStatus {
  name: string;
  status: "up" | "down" | "degraded";
  response_time_ms?: number;
  last_check: string;
  details?: Record<string, any>;
}

// Authentication types
export interface AuthRequest {
  username: string;
  password: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  user_info: UserInfo;
}

export interface UserInfo {
  id: string;
  username: string;
  email?: string;
  roles: string[];
  permissions: string[];
}

export interface TokenRefreshRequest {
  refresh_token: string;
}

// Batch operation types
export interface BatchRequest<T> {
  operations: T[];
  batch_id?: string;
  parallel?: boolean;
}

export interface BatchResponse<T> {
  batch_id: string;
  results: BatchResult<T>[];
  summary: BatchSummary;
}

export interface BatchResult<T> {
  index: number;
  success: boolean;
  data?: T;
  error?: ApiError;
}

export interface BatchSummary {
  total: number;
  successful: number;
  failed: number;
  processing_time_ms: number;
}
