

export default function Footer() {
  return (
    <footer className="border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 py-6">
        <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
          <div className="text-sm text-muted-foreground">
            © 2025 Dixie Chemical Product Agent v3. Built with Astro + React.
          </div>
          <div className="flex items-center space-x-4 text-sm text-muted-foreground">
            <span>Powered by Vector Search & Knowledge Graphs</span>
          </div>
        </div>
      </div>
    </footer>
  );
}