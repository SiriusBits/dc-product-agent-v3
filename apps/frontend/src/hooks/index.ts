// Core API hooks
export { useApi, useApiQuery, useApiGroup } from './useApi';
export type { UseApiState, UseApiOptions, UseApiReturn } from './useApi';

// System health hooks
export { useSystemHealth, useServiceHealth } from './useSystemHealth';
export type { UseSystemHealthReturn } from './useSystemHealth';

// Chat hooks
export { useChat } from './useChat';
export { useConversations } from './useConversations';

// Product hooks
export {
  useProducts,
  useProductDetail,
  useProductFilters,
  useProductComparison,
} from './useProducts';
export type {
  ProductSearchParams,
  UseProductsResult,
  UseProductDetailResult,
  UseProductFiltersResult,
  UseProductComparisonResult,
} from './useProducts';

// Knowledge graph hooks
export {
  useKnowledgeGraph,
  useEntityExplorer,
  useGraphVisualization,
} from './useKnowledgeGraph';
export type { UseKnowledgeGraphReturn } from './useKnowledgeGraph';
