
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Search, BookOpen, Database, Network, Zap } from "lucide-react";

export default function WelcomeSection() {
  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold tracking-tight">
          Dixie Chemical Product Agent
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Intelligent search and question-answering for chemical product information using advanced RAG technology
        </p>
        <div className="flex justify-center">
          <Badge variant="secondary" className="text-sm">
            Version 3.0.0 - Development Mode
          </Badge>
        </div>
      </div>

      {/* Feature Cards */}
      <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
        <Card className="text-center">
          <CardHeader>
            <div className="mx-auto h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
              <MessageSquare className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="text-lg">Chat Interface</CardTitle>
            <CardDescription>
              Natural language conversations about chemical products and their properties
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" disabled>
              Start Chatting
              <span className="ml-2 text-xs opacity-70">(Coming Soon)</span>
            </Button>
          </CardContent>
        </Card>

        <Card className="text-center">
          <CardHeader>
            <div className="mx-auto h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
              <Search className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="text-lg">Product Browser</CardTitle>
            <CardDescription>
              Browse and search through our comprehensive chemical product catalog
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full" disabled>
              Browse Products
              <span className="ml-2 text-xs opacity-70">(Coming Soon)</span>
            </Button>
          </CardContent>
        </Card>

        <Card className="text-center">
          <CardHeader>
            <div className="mx-auto h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
              <BookOpen className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="text-lg">Knowledge Graph</CardTitle>
            <CardDescription>
              Explore relationships between products, properties, and applications
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full" disabled>
              Explore Graph
              <span className="ml-2 text-xs opacity-70">(Coming Soon)</span>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Technology Stack */}
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="text-center">Powered by Advanced Technology</CardTitle>
            <CardDescription className="text-center">
              Built with modern web technologies and AI-powered search capabilities
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-4 text-center">
              <div className="space-y-2">
                <div className="mx-auto h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
                  <Database className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="font-semibold">Vector Search</h3>
                <p className="text-sm text-muted-foreground">
                  Semantic search using Chroma vector database
                </p>
              </div>
              <div className="space-y-2">
                <div className="mx-auto h-10 w-10 rounded-lg bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
                  <Network className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="font-semibold">Knowledge Graph</h3>
                <p className="text-sm text-muted-foreground">
                  Neo4j + Graphiti for relationship modeling
                </p>
              </div>
              <div className="space-y-2">
                <div className="mx-auto h-10 w-10 rounded-lg bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center">
                  <Zap className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
                <h3 className="font-semibold">Hybrid RAG</h3>
                <p className="text-sm text-muted-foreground">
                  Combined retrieval for comprehensive answers
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Status Information */}
      <div className="text-center space-y-2">
        <p className="text-sm text-muted-foreground">
          Frontend application successfully configured with Astro + React + Tailwind CSS 4
        </p>
        <div className="flex justify-center space-x-2">
          <Badge variant="outline">Astro 5.14.1</Badge>
          <Badge variant="outline">React 19.2.0</Badge>
          <Badge variant="outline">Tailwind CSS 4.1.14</Badge>
          <Badge variant="outline">TypeScript</Badge>
        </div>
      </div>
    </div>
  );
}