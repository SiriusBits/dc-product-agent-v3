import { useState, useCallback } from 'react';
import { apiClient } from '../lib/api-client';
import type {
  KGQueryRequest,
  KGQueryResponse,
  KGEntity,
  GraphVisualizationData,
} from '@repo/shared-types';

export interface UseKnowledgeGraphResult {
  graphData: GraphVisualizationData | null;
  centralEntity: KGEntity | null;
  relatedEntities: KGEntity[];
  loading: boolean;
  error: string | null;
  queryGraph: (request: KGQueryRequest) => Promise<void>;
  getEntityNeighbors: (
    entityName: string,
    maxDepth?: number,
    limit?: number
  ) => Promise<void>;
  clearGraph: () => void;
}

export function useKnowledgeGraph(): UseKnowledgeGraphResult {
  const [graphData, setGraphData] = useState<GraphVisualizationData | null>(
    null
  );
  const [centralEntity, setCentralEntity] = useState<KGEntity | null>(null);
  const [relatedEntities, setRelatedEntities] = useState<KGEntity[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const queryGraph = useCallback(async (request: KGQueryRequest) => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.queryKnowledgeGraph(request);

      setGraphData(response.graph_data);
      setCentralEntity(response.central_entity);
      setRelatedEntities(response.related_entities);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to query knowledge graph'
      );
      setGraphData(null);
      setCentralEntity(null);
      setRelatedEntities([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const getEntityNeighbors = useCallback(
    async (entityName: string, maxDepth = 2, limit = 20) => {
      setLoading(true);
      setError(null);

      try {
        const response = await apiClient.getEntityNeighbors(
          entityName,
          maxDepth,
          limit
        );

        setGraphData(response.graph_data);
        setCentralEntity(response.central_entity);
        setRelatedEntities(response.related_entities);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to get entity neighbors'
        );
        setGraphData(null);
        setCentralEntity(null);
        setRelatedEntities([]);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const clearGraph = useCallback(() => {
    setGraphData(null);
    setCentralEntity(null);
    setRelatedEntities([]);
    setError(null);
  }, []);

  return {
    graphData,
    centralEntity,
    relatedEntities,
    loading,
    error,
    queryGraph,
    getEntityNeighbors,
    clearGraph,
  };
}
