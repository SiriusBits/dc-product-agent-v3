import { useState, useEffect, useCallback } from 'react';
import { Network, Zap, Search, X } from 'lucide-react';
import { 
  Card, 
  CardHeader, 
  CardTitle, 
  CardDescription, 
  CardContent,
  Button,
  Input,
  Badge,
  Loading
} from '../ui';
import { useKnowledgeGraph } from '../../hooks/useKnowledgeGraph';
import type { GraphNode, KGEntity } from '@repo/shared-types';

export interface KnowledgeGraphViewerProps {
  productName?: string;
  onEntityClick?: (entity: KGEntity) => void;
  className?: string;
}

export function KnowledgeGraphViewer({ 
  productName, 
  onEntityClick,
  className 
}: KnowledgeGraphViewerProps) {
  const { 
    graphData, 
    centralEntity, 
    relatedEntities, 
    loading, 
    error, 
    getEntityNeighbors,
    clearGraph 
  } = useKnowledgeGraph();

  const [searchEntity, setSearchEntity] = useState(productName || '');
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);

  const handleSearch = useCallback(async (entityName?: string) => {
    const searchTerm = entityName || searchEntity.trim();
    if (!searchTerm) return;

    await getEntityNeighbors(searchTerm, 2, 20);
  }, [searchEntity, getEntityNeighbors]);

  useEffect(() => {
    if (productName) {
      setSearchEntity(productName);
      handleSearch(productName);
    }
  }, [productName, handleSearch]);

  const handleNodeClick = (node: GraphNode) => {
    setSelectedNode(node);
    const entity = relatedEntities.find(e => e.id === node.id) || centralEntity;
    if (entity && onEntityClick) {
      onEntityClick(entity);
    }
  };

  const handleClear = () => {
    clearGraph();
    setSearchEntity('');
    setSelectedNode(null);
  };

  const renderSimpleGraph = () => {
    if (!graphData || !graphData.nodes || graphData.nodes.length === 0) {
      return (
        <div className="text-center text-muted-foreground py-8">
          No graph data available
        </div>
      );
    }

    // Simple grid layout for nodes
    const nodes = graphData.nodes;
    const edges = graphData.edges || [];
    
    // Find central node (usually the searched entity)
    const centralNode = nodes.find(n => n.id === centralEntity?.id) || nodes[0];
    const otherNodes = nodes.filter(n => n.id !== centralNode.id);

    return (
      <div className="relative p-6 bg-muted/20 rounded-lg min-h-[400px]">
        {/* Central Node */}
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
          <div
            className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
              selectedNode?.id === centralNode.id
                ? 'border-primary bg-primary/10'
                : 'border-border bg-background hover:border-primary/50'
            }`}
            onClick={() => handleNodeClick(centralNode)}
          >
            <div className="text-sm font-medium text-center max-w-[120px] truncate">
              {centralNode.label}
            </div>
            <div className="text-xs text-muted-foreground text-center">
              {centralNode.type}
            </div>
          </div>
        </div>

        {/* Related Nodes in a circle around central node */}
        {otherNodes.map((node, index) => {
          const angle = (index * 2 * Math.PI) / otherNodes.length;
          const radius = 150;
          const x = Math.cos(angle) * radius;
          const y = Math.sin(angle) * radius;

          return (
            <div
              key={node.id}
              className="absolute transform -translate-x-1/2 -translate-y-1/2"
              style={{
                left: `calc(50% + ${x}px)`,
                top: `calc(50% + ${y}px)`,
              }}
            >
              <div
                className={`p-2 rounded border cursor-pointer transition-all text-center ${
                  selectedNode?.id === node.id
                    ? 'border-primary bg-primary/10'
                    : 'border-border bg-background hover:border-primary/50'
                }`}
                onClick={() => handleNodeClick(node)}
              >
                <div className="text-xs font-medium max-w-[100px] truncate">
                  {node.label}
                </div>
                <div className="text-xs text-muted-foreground">
                  {node.type}
                </div>
              </div>

              {/* Simple line to central node */}
              <svg
                className="absolute top-1/2 left-1/2 pointer-events-none"
                style={{
          width: Math.abs(x) + 60,
          height: Math.abs(y) + 60,
          transform: `translate(-50%, -50%)`,
        }}
              >
                <line
                  x1={x > 0 ? 0 : Math.abs(x)}
                  y1={y > 0 ? 0 : Math.abs(y)}
                  x2={x > 0 ? Math.abs(x) : 0}
                  y2={y > 0 ? Math.abs(y) : 0}
                  stroke="currentColor"
                  strokeWidth="1"
                  className="text-muted-foreground/30"
                />
              </svg>
            </div>
          );
        })}

        {/* Legend */}
        <div className="absolute bottom-4 left-4">
          <div className="text-xs text-muted-foreground">
            Click nodes to explore • {nodes.length} entities • {edges.length} relationships
          </div>
        </div>
      </div>
    );
  };

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center space-x-2">
              <Network className="h-5 w-5" />
              <span>Knowledge Graph</span>
            </CardTitle>
            <CardDescription>
              Explore relationships between products, properties, and applications
            </CardDescription>
          </div>
          {(graphData || error) && (
            <Button variant="outline" size="sm" onClick={handleClear}>
              <X className="h-4 w-4 mr-1" />
              Clear
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search Input */}
        <div className="flex space-x-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search for a product, property, or application..."
              value={searchEntity}
              onChange={(e) => setSearchEntity(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="pl-10"
              disabled={loading}
            />
          </div>
          <Button 
            onClick={() => handleSearch()} 
            disabled={loading || !searchEntity.trim()}
          >
            {loading ? <Loading size="sm" /> : <Zap className="h-4 w-4" />}
          </Button>
        </div>

        {/* Error Display */}
        {error && (
          <div className="p-3 border border-red-200 bg-red-50 rounded-lg">
            <div className="text-sm text-red-600">{error?.message || 'An error occurred'}</div>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="py-8">
            <Loading message="Loading knowledge graph..." />
          </div>
        )}

        {/* Graph Visualization */}
        {!loading && !error && (graphData || centralEntity) && (
          <div className="space-y-4">
            {/* Central Entity Info */}
            {centralEntity && (
              <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{centralEntity.canonical_name || centralEntity.text}</div>
                    <div className="text-sm text-muted-foreground">
                      {centralEntity.type} • {relatedEntities.length} related entities
                    </div>
                  </div>
                  <Badge variant="outline">{centralEntity.type}</Badge>
                </div>
                {centralEntity.aliases && centralEntity.aliases.length > 0 && (
                  <div className="mt-2">
                    <div className="text-xs text-muted-foreground mb-1">Aliases:</div>
                    <div className="flex flex-wrap gap-1">
                      {centralEntity.aliases.slice(0, 3).map((alias, index) => (
                        <Badge key={index} variant="secondary" className="text-xs">
                          {alias}
                        </Badge>
                      ))}
                      {centralEntity.aliases.length > 3 && (
                        <Badge variant="secondary" className="text-xs">
                          +{centralEntity.aliases.length - 3} more
                        </Badge>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Simple Graph Visualization */}
            {renderSimpleGraph()}

            {/* Selected Node Details */}
            {selectedNode && (
              <div className="p-3 border rounded-lg bg-muted/20">
                <div className="font-medium mb-2">Selected: {selectedNode.label}</div>
                <div className="text-sm text-muted-foreground space-y-1">
                  <div>Type: {selectedNode.type}</div>
                  {selectedNode.properties && Object.keys(selectedNode.properties).length > 0 && (
                    <div>
                      Properties: {Object.entries(selectedNode.properties)
                        .slice(0, 3)
                        .map(([key, value]) => `${key}: ${value}`)
                        .join(', ')}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Related Entities List */}
            {relatedEntities && relatedEntities.length > 0 && (
              <div>
                <h4 className="font-medium mb-2">Related Entities</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                  {relatedEntities.map((entity) => (
                    <div
                      key={entity.id}
                      className="flex items-center justify-between p-2 border rounded cursor-pointer hover:bg-muted/50"
                      onClick={() => onEntityClick?.(entity)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">
                          {entity.canonical_name || entity.text}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {entity.type}
                        </div>
                      </div>
                      <Badge variant="outline" className="text-xs ml-2">
                        {entity.type}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && !graphData && !centralEntity && (
          <div className="text-center text-muted-foreground py-8">
            <Network className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <div className="font-medium mb-1">Explore the Knowledge Graph</div>
            <div className="text-sm">
              Search for a product, property, or application to see related entities
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}