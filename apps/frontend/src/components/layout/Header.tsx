
import { Button } from "@/components/ui/button";
import { MessageSquare, Search, BookOpen } from "lucide-react";

interface HeaderProps {
  currentPage?: "chat" | "browse" | "docs";
}

export default function Header({ currentPage = "chat" }: HeaderProps) {
  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-2">
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-sm">DC</span>
              </div>
              <div>
                <h1 className="text-lg font-semibold">Dixie Chemical</h1>
                <p className="text-xs text-muted-foreground">Product Agent v3</p>
              </div>
            </div>
          </div>

          <nav className="flex items-center space-x-2">
            <a href="/chat">
              <Button
                variant={currentPage === "chat" ? "default" : "ghost"}
                size="sm"
                className="flex items-center space-x-2"
              >
                <MessageSquare className="h-4 w-4" />
                <span>Chat</span>
              </Button>
            </a>
            <a href="/browse">
              <Button
                variant={currentPage === "browse" ? "default" : "ghost"}
                size="sm"
                className="flex items-center space-x-2"
              >
                <Search className="h-4 w-4" />
                <span>Browse</span>
              </Button>
            </a>
            <a href="/">
              <Button
                variant={currentPage === "docs" ? "default" : "ghost"}
                size="sm"
                className="flex items-center space-x-2"
              >
                <BookOpen className="h-4 w-4" />
                <span>Home</span>
              </Button>
            </a>
          </nav>
        </div>
      </div>
    </header>
  );
}