// Shared TypeScript types for Dixie Chemical Product Agent

// Export all API types
export * from './api';

// Export all model types  
export * from './models';

// Re-export commonly used types for convenience
export type {
  // Core API types
  ApiResponse,
  ApiError,
  ChatRequest,
  ChatResponse,
  RetrievalResult,
  QueryType,
  QueryAnalysis,
  ProductSummary,
  ProductDetail,
  ProductSearchRequest,
  ProductSearchResponse,
  KGQueryRequest,
  KGQueryResponse,
  SystemStatus,
  ServiceStatus,
  IngestionRequest,
  IngestionResponse,
  IngestionStatus
} from './api';

export type {
  // Core model types
  ProductInfo,
  BaseExtractionDocument,
  DocumentMetadata,
  DocumentSection,
  PropertySpecification,
  KGEntity,
  KGTriple,
  KnowledgeGraph,
  DocumentFileMetadata,
  ExtractionMetadata,
  TypicalPropertiesTable,
  EpoxyResinProperties,
  FormulationRow,
  ToxicityRecord,
  DerivedInfo,
  EnhancedApplication,
  PropertyRelationship,
  CompetitiveAnalysis,
  UsageRecommendation
} from './models';