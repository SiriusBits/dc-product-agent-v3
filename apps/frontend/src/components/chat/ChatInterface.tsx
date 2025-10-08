
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageSquare } from "lucide-react";

export default function ChatInterface() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-bold">Chat Interface</h1>
        <p className="text-muted-foreground">
          Conversational AI for chemical product information
        </p>
        <Badge variant="secondary">Coming in Task 9.3</Badge>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center space-x-2">
            <MessageSquare className="h-5 w-5" />
            <CardTitle>Chat Features (Planned)</CardTitle>
          </div>
          <CardDescription>
            Features that will be implemented in the chat interface
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            <li>• Natural language query processing</li>
            <li>• Real-time response generation</li>
            <li>• Message history and conversation management</li>
            <li>• Source attribution and provenance tracking</li>
            <li>• Multi-modal result visualization</li>
            <li>• Query suggestions and auto-completion</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}