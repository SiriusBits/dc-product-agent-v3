import { useState, useCallback } from 'react';
import { apiClient, ApiError } from '../lib/api-client';
import { useApi } from './useApi';
import type {
  KGQueryRequest,
  KGQueryResponse,
  KGEntity,
  KGRelationship,
  GraphVisualizationData,
} from '@repo/shared-types';

export interface UseKnowledgeGraphReturn {
  centralEntity: KGEntity | null;
  relatedEntities: KGEntity[];
  relationships: KGRelationship[];
  graphData: GraphVisualizationData | null;
  loading: boolean;
  error: ApiError | null;
  queryKnowledgeGraph: (request: KGQueryRequest) => Promise<void>;
  getEntityNeighbors: (
    entityName: string,
    maxDepth?: number,
    limit?: number
  ) => Promise<void>;
  clearGraph: () => void;
  retry: () => Promise<void>;
  isRetryable: boolean;
}

/**
 * Hook for knowledge graph operations
 */
export function useKnowledgeGraph(): UseKnowledgeGraphReturn {
  const [centralEntity, setCentralEntity] = useState<KGEntity | null>(null);
  const [relatedEntities, setRelatedEntities] = useState<KGEntity[]>([]);
  const [relationships, setRelationships] = useState<KGRelationship[]>([]);
  const [graphData, setGraphData] = useState<GraphVisualizationData | null>(
    null
  );

  // Use API hook for knowledge graph queries
  const queryApi = useApi(apiClient.queryKnowledgeGraph, {
    onSuccess: (response: KGQueryResponse) => {
      setCentralEntity(response.central_entity);
      setRelatedEntities(response.related_entities);
      setRelationships(response.relationships);
      setGraphData(response.graph_data);
    },
  });

  // Use API hook for entity neighbor queries
  const neighborsApi = useApi(apiClient.getEntityNeighbors, {
    onSuccess: (response: KGQueryResponse) => {
      setCentralEntity(response.central_entity);
      setRelatedEntities(response.related_entities);
      setRelationships(response.relationships);
      setGraphData(response.graph_data);
    },
  });

  const queryKnowledgeGraph = useCallback(
    async (request: KGQueryRequest) => {
      await queryApi.execute(request);
    },
    [queryApi]
  );

  const getEntityNeighbors = useCallback(
    async (entityName: string, maxDepth = 2, limit = 20) => {
      await neighborsApi.execute(entityName, maxDepth, limit);
    },
    [neighborsApi]
  );

  const clearGraph = useCallback(() => {
    setCentralEntity(null);
    setRelatedEntities([]);
    setRelationships([]);
    setGraphData(null);
    queryApi.reset();
    neighborsApi.reset();
  }, [queryApi, neighborsApi]);

  const retry = useCallback(async () => {
    if (queryApi.isRetryable) {
      await queryApi.retry();
    } else if (neighborsApi.isRetryable) {
      await neighborsApi.retry();
    }
  }, [queryApi, neighborsApi]);

  return {
    centralEntity,
    relatedEntities,
    relationships,
    graphData,
    loading: queryApi.loading || neighborsApi.loading,
    error: queryApi.error || neighborsApi.error,
    queryKnowledgeGraph,
    getEntityNeighbors,
    clearGraph,
    retry,
    isRetryable: queryApi.isRetryable || neighborsApi.isRetryable,
  };
}

/**
 * Hook for exploring entity relationships
 */
export function useEntityExplorer(initialEntityName?: string) {
  const kg = useKnowledgeGraph();
  const [selectedEntity, setSelectedEntity] = useState<string | null>(
    initialEntityName || null
  );
  const [explorationHistory, setExplorationHistory] = useState<string[]>([]);

  const exploreEntity = useCallback(
    async (entityName: string, addToHistory = true) => {
      if (addToHistory && selectedEntity) {
        setExplorationHistory((prev) => [...prev, selectedEntity]);
      }

      setSelectedEntity(entityName);
      await kg.getEntityNeighbors(entityName);
    },
    [kg, selectedEntity]
  );

  const goBack = useCallback(() => {
    if (explorationHistory.length > 0) {
      const previousEntity = explorationHistory[explorationHistory.length - 1];
      setExplorationHistory((prev) => prev.slice(0, -1));
      exploreEntity(previousEntity, false);
    }
  }, [explorationHistory, exploreEntity]);

  const resetExploration = useCallback(() => {
    setSelectedEntity(null);
    setExplorationHistory([]);
    kg.clearGraph();
  }, [kg]);

  return {
    ...kg,
    selectedEntity,
    explorationHistory,
    canGoBack: explorationHistory.length > 0,
    exploreEntity,
    goBack,
    resetExploration,
  };
}

/**
 * Hook for managing graph visualization state
 */
export function useGraphVisualization() {
  const [selectedNodes, setSelectedNodes] = useState<Set<string>>(new Set());
  const [selectedEdges, setSelectedEdges] = useState<Set<string>>(new Set());
  const [highlightedNodes, setHighlightedNodes] = useState<Set<string>>(
    new Set()
  );
  const [filteredNodeTypes, setFilteredNodeTypes] = useState<Set<string>>(
    new Set()
  );
  const [filteredEdgeTypes, setFilteredEdgeTypes] = useState<Set<string>>(
    new Set()
  );

  const selectNode = useCallback((nodeId: string, multiSelect = false) => {
    setSelectedNodes((prev) => {
      const newSet = multiSelect ? new Set(prev) : new Set<string>();
      if (prev.has(nodeId) && multiSelect) {
        newSet.delete(nodeId);
      } else {
        newSet.add(nodeId);
      }
      return newSet;
    });
  }, []);

  const selectEdge = useCallback((edgeId: string, multiSelect = false) => {
    setSelectedEdges((prev) => {
      const newSet = multiSelect ? new Set(prev) : new Set<string>();
      if (prev.has(edgeId) && multiSelect) {
        newSet.delete(edgeId);
      } else {
        newSet.add(edgeId);
      }
      return newSet;
    });
  }, []);

  const highlightNode = useCallback((nodeId: string) => {
    setHighlightedNodes((prev) => new Set([...prev, nodeId]));
  }, []);

  const unhighlightNode = useCallback((nodeId: string) => {
    setHighlightedNodes((prev) => {
      const newSet = new Set(prev);
      newSet.delete(nodeId);
      return newSet;
    });
  }, []);

  const toggleNodeTypeFilter = useCallback((nodeType: string) => {
    setFilteredNodeTypes((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(nodeType)) {
        newSet.delete(nodeType);
      } else {
        newSet.add(nodeType);
      }
      return newSet;
    });
  }, []);

  const toggleEdgeTypeFilter = useCallback((edgeType: string) => {
    setFilteredEdgeTypes((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(edgeType)) {
        newSet.delete(edgeType);
      } else {
        newSet.add(edgeType);
      }
      return newSet;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedNodes(new Set());
    setSelectedEdges(new Set());
  }, []);

  const clearHighlights = useCallback(() => {
    setHighlightedNodes(new Set());
  }, []);

  const clearFilters = useCallback(() => {
    setFilteredNodeTypes(new Set());
    setFilteredEdgeTypes(new Set());
  }, []);

  const resetVisualization = useCallback(() => {
    clearSelection();
    clearHighlights();
    clearFilters();
  }, [clearSelection, clearHighlights, clearFilters]);

  return {
    selectedNodes,
    selectedEdges,
    highlightedNodes,
    filteredNodeTypes,
    filteredEdgeTypes,
    selectNode,
    selectEdge,
    highlightNode,
    unhighlightNode,
    toggleNodeTypeFilter,
    toggleEdgeTypeFilter,
    clearSelection,
    clearHighlights,
    clearFilters,
    resetVisualization,
  };
}
