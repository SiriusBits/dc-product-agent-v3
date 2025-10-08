import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import WelcomeSection from '../WelcomeSection';

describe('WelcomeSection', () => {
  it('renders the main heading', () => {
    render(<WelcomeSection />);
    expect(screen.getByText('Dixie Chemical Product Agent')).toBeInTheDocument();
  });

  it('displays version badge', () => {
    render(<WelcomeSection />);
    expect(screen.getByText('Version 3.0.0 - Development Mode')).toBeInTheDocument();
  });

  it('shows feature cards', () => {
    render(<WelcomeSection />);
    expect(screen.getByText('Chat Interface')).toBeInTheDocument();
    expect(screen.getByText('Product Browser')).toBeInTheDocument();
    expect(screen.getByText('Natural language conversations about chemical products and their properties')).toBeInTheDocument();
  });

  it('displays technology stack information', () => {
    render(<WelcomeSection />);
    expect(screen.getByText('Vector Search')).toBeInTheDocument();
    expect(screen.getByText('Semantic search using Chroma vector database')).toBeInTheDocument();
    expect(screen.getByText('Hybrid RAG')).toBeInTheDocument();
  });
});