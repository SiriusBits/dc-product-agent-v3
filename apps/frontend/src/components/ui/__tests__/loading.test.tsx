import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { LoadingSpinner, LoadingState } from '../loading';

describe('LoadingSpinner', () => {
  // New tests for test ID functionality (Requirements 4.1, 4.2)
  describe('Test ID functionality', () => {
    it('uses default test ID when none provided', () => {
      render(<LoadingSpinner />);

      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
    });

    it('uses custom test ID when provided', () => {
      render(<LoadingSpinner testId="custom-spinner" />);

      expect(screen.getByTestId('custom-spinner')).toBeInTheDocument();
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
    });

    it('maintains backward compatibility for existing usage', () => {
      // Test that existing code without testId prop still works
      render(<LoadingSpinner size="lg" className="custom-class" />);

      const spinner = screen.getByTestId('loading-spinner');
      expect(spinner).toBeInTheDocument();
      expect(spinner).toHaveClass('h-8', 'w-8', 'custom-class');
    });

    it('supports context-specific test IDs', () => {
      render(
        <div>
          <LoadingSpinner testId="chat-loading-spinner" />
          <LoadingSpinner testId="product-loading-spinner" />
        </div>
      );

      expect(screen.getByTestId('chat-loading-spinner')).toBeInTheDocument();
      expect(screen.getByTestId('product-loading-spinner')).toBeInTheDocument();

      // Should not have any generic loading-spinner elements
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
    });

    it('prevents test ID conflicts when multiple spinners are rendered', () => {
      render(
        <div>
          <LoadingSpinner testId="spinner-1" />
          <LoadingSpinner testId="spinner-2" />
          <LoadingSpinner testId="spinner-3" />
        </div>
      );

      // Each spinner should have its unique test ID
      expect(screen.getByTestId('spinner-1')).toBeInTheDocument();
      expect(screen.getByTestId('spinner-2')).toBeInTheDocument();
      expect(screen.getByTestId('spinner-3')).toBeInTheDocument();

      // Should not find multiple elements with the same test ID
      expect(screen.getAllByTestId(/spinner-/)).toHaveLength(3);
    });
  });

  describe('Size variants', () => {
    it('applies small size classes', () => {
      render(<LoadingSpinner size="sm" testId="small-spinner" />);

      const spinner = screen.getByTestId('small-spinner');
      expect(spinner).toHaveClass('h-4', 'w-4');
    });

    it('applies medium size classes by default', () => {
      render(<LoadingSpinner testId="medium-spinner" />);

      const spinner = screen.getByTestId('medium-spinner');
      expect(spinner).toHaveClass('h-6', 'w-6');
    });

    it('applies large size classes', () => {
      render(<LoadingSpinner size="lg" testId="large-spinner" />);

      const spinner = screen.getByTestId('large-spinner');
      expect(spinner).toHaveClass('h-8', 'w-8');
    });
  });

  describe('Styling', () => {
    it('always includes animate-spin class', () => {
      render(<LoadingSpinner testId="animated-spinner" />);

      const spinner = screen.getByTestId('animated-spinner');
      expect(spinner).toHaveClass('animate-spin');
    });

    it('applies custom className', () => {
      render(
        <LoadingSpinner className="text-blue-500" testId="custom-spinner" />
      );

      const spinner = screen.getByTestId('custom-spinner');
      expect(spinner).toHaveClass('text-blue-500');
    });

    it('combines size, animation, and custom classes', () => {
      render(
        <LoadingSpinner
          size="lg"
          className="text-red-500 opacity-75"
          testId="combined-spinner"
        />
      );

      const spinner = screen.getByTestId('combined-spinner');
      expect(spinner).toHaveClass(
        'animate-spin',
        'h-8',
        'w-8',
        'text-red-500',
        'opacity-75'
      );
    });
  });
});

describe('LoadingState', () => {
  // New tests for LoadingState test ID support (Requirements 4.2, 4.3)
  describe('Test ID support', () => {
    it('passes testId through to LoadingSpinner', () => {
      render(<LoadingState testId="state-loading-spinner" />);

      expect(screen.getByTestId('state-loading-spinner')).toBeInTheDocument();
    });

    it('uses default LoadingSpinner testId when none provided', () => {
      render(<LoadingState />);

      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
    });

    it('supports context-specific test IDs in LoadingState', () => {
      render(
        <div>
          <LoadingState
            testId="product-loading-spinner"
            message="Loading products..."
          />
          <LoadingState
            testId="chat-loading-spinner"
            message="Loading messages..."
          />
        </div>
      );

      expect(screen.getByTestId('product-loading-spinner')).toBeInTheDocument();
      expect(screen.getByTestId('chat-loading-spinner')).toBeInTheDocument();

      // Check that messages are also rendered correctly
      expect(screen.getByText('Loading products...')).toBeInTheDocument();
      expect(screen.getByText('Loading messages...')).toBeInTheDocument();
    });

    it('prevents conflicts when multiple LoadingStates are used', () => {
      render(
        <div>
          <LoadingState testId="first-loader" message="First loading" />
          <LoadingState testId="second-loader" message="Second loading" />
        </div>
      );

      // Each should have unique test IDs
      expect(screen.getByTestId('first-loader')).toBeInTheDocument();
      expect(screen.getByTestId('second-loader')).toBeInTheDocument();

      // Should not have generic loading-spinner
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
    });
  });

  describe('Message display', () => {
    it('shows default loading message', () => {
      render(<LoadingState />);

      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('shows custom loading message', () => {
      render(
        <LoadingState message="Please wait while we process your request" />
      );

      expect(
        screen.getByText('Please wait while we process your request')
      ).toBeInTheDocument();
    });
  });

  describe('Size and styling', () => {
    it('passes size prop to LoadingSpinner', () => {
      render(<LoadingState size="lg" testId="large-state-spinner" />);

      const spinner = screen.getByTestId('large-state-spinner');
      expect(spinner).toHaveClass('h-8', 'w-8');
    });

    it('applies custom className to container', () => {
      render(
        <LoadingState className="bg-gray-100 rounded" testId="styled-spinner" />
      );

      const container = screen.getByTestId('styled-spinner').parentElement;
      expect(container).toHaveClass('bg-gray-100', 'rounded');
    });

    it('maintains proper layout structure', () => {
      render(<LoadingState testId="layout-spinner" />);

      const spinner = screen.getByTestId('layout-spinner');
      const container = spinner.parentElement;

      expect(container).toHaveClass(
        'flex',
        'items-center',
        'justify-center',
        'gap-2',
        'p-4'
      );
    });
  });
});
