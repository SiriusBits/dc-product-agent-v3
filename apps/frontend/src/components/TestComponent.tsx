import React from 'react';

interface TestComponentProps {
  message?: string;
}

export default function TestComponent({
  message = 'React 19 is working!',
}: TestComponentProps) {
  const [count, setCount] = React.useState(0);

  return (
    <div className="p-4 border border-border rounded-lg bg-card text-card-foreground">
      <h2 className="text-lg font-semibold mb-2">{message}</h2>
      <p className="text-muted-foreground mb-4">
        This is a React component running in Astro with Tailwind CSS v4.
      </p>
      <div className="flex items-center gap-4">
        <button
          onClick={() => setCount(count - 1)}
          className="px-3 py-1 bg-secondary text-secondary-foreground rounded hover:bg-secondary/80 transition-colors"
        >
          -
        </button>
        <span className="font-mono text-lg">{count}</span>
        <button
          onClick={() => setCount(count + 1)}
          className="px-3 py-1 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
        >
          +
        </button>
      </div>
    </div>
  );
}
