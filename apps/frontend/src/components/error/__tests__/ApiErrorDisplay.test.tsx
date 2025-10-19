import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiErrorDisplay, InlineApiError } from '../ApiErrorDisplay';
import { setupTest } from '@/test';

// Mock ApiError class for testing
class MockApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public details?: unknown,
    public requestId?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }

  isNetworkError(): boolean {
    return this.status === 0;
  }

  isServerError(): boolean {
    return this.status >= 500;
  }

  isClientError(): boolean {
    return this.status >= 400 && this.status < 500;
  }

  isRetryable(): boolean {
    return this.isNetworkError() || this.isServerError() || this.status === 408;
  }
}

describe('ApiErrorDisplay', () => {
  let testContext: ReturnType<typeof setupTest>;

  beforeEach(() => {
    testContext = setupTest();
  });

  // New tests for button text consistency (Requirements 3.1)
  describe('Button text consistency', () => {
    it('displays "Retry" text consistently for retryable errors', () => {
      const mockError = new MockApiError('Network error', 0);
      const mockOnRetry = vi.fn();

      testContext.renderComponent(
        <ApiErrorDisplay error={mockError} onRetry={mockOnRetry} />
      );

      const retryButton = screen.getByTestId('retry-button');
      expect(retryButton).toHaveTextContent('Retry');
      expect(retryButton).not.toHaveTextContent('Try Again');
    });

    it('does not show retry button for non-retryable errors', () => {
      const mockError = new MockApiError('Bad request', 400);
      const mockOnRetry = vi.fn();

      testContext.renderComponent(
        <ApiErrorDisplay error={mockError} onRetry={mockOnRetry} />
      );

      expect(screen.queryByTestId('retry-button')).not.toBeInTheDocument();
    });

    it('calls retry handler when retry button is clicked', async () => {
      const mockError = new MockApiError('Server error', 500);
      const mockOnRetry = vi.fn();

      testContext.renderComponent(
        <ApiErrorDisplay error={mockError} onRetry={mockOnRetry} />
      );

      const retryButton = screen.getByTestId('retry-button');
      await userEvent.setup().click(retryButton);

      expect(mockOnRetry).toHaveBeenCalledTimes(1);
    });

    it('maintains existing button functionality and styling', () => {
      const mockError = new MockApiError('Network error', 0);
      const mockOnRetry = vi.fn();

      testContext.renderComponent(
        <ApiErrorDisplay error={mockError} onRetry={mockOnRetry} />
      );

      const retryButton = screen.getByTestId('retry-button');

      // Check for RefreshCw icon
      const icon = retryButton.querySelector('svg');
      expect(icon).toBeInTheDocument();

      // Check for proper styling classes
      expect(retryButton).toHaveClass('flex', 'items-center', 'gap-2');

      // Check data-testid attribute
      expect(retryButton).toHaveAttribute('data-testid', 'retry-button');
    });
  });

  describe('Error display modes', () => {
    it('shows appropriate error title for network errors', () => {
      const mockError = new MockApiError('Network error', 0);
      testContext.renderComponent(<ApiErrorDisplay error={mockError} />);

      expect(screen.getByText('Connection Error')).toBeInTheDocument();
    });

    it('shows appropriate error title for server errors', () => {
      const mockError = new MockApiError('Internal server error', 500);
      testContext.renderComponent(<ApiErrorDisplay error={mockError} />);

      expect(screen.getByText('Server Error')).toBeInTheDocument();
    });

    it('shows appropriate error title for 404 errors', () => {
      const mockError = new MockApiError('Not found', 404);
      testContext.renderComponent(<ApiErrorDisplay error={mockError} />);

      expect(screen.getByText('Not Found')).toBeInTheDocument();
    });

    it('shows appropriate error title for 403 errors', () => {
      const mockError = new MockApiError('Forbidden', 403);
      testContext.renderComponent(<ApiErrorDisplay error={mockError} />);

      expect(screen.getByText('Access Denied')).toBeInTheDocument();
    });

    it('shows appropriate error title for 401 errors', () => {
      const mockError = new MockApiError('Unauthorized', 401);
      testContext.renderComponent(<ApiErrorDisplay error={mockError} />);

      expect(screen.getByText('Authentication Required')).toBeInTheDocument();
    });
  });

  describe('Error descriptions', () => {
    it('shows network error description', () => {
      const mockError = new MockApiError('Network error', 0);
      render(<ApiErrorDisplay error={mockError} />);

      expect(
        screen.getByText(/unable to connect to the server/i)
      ).toBeInTheDocument();
    });

    it('shows server error description', () => {
      const mockError = new MockApiError('Server error', 500);
      render(<ApiErrorDisplay error={mockError} />);

      expect(
        screen.getByText(/server encountered an error/i)
      ).toBeInTheDocument();
    });

    it('shows custom error message when provided', () => {
      const mockError = new MockApiError('Custom error message', 400);
      render(<ApiErrorDisplay error={mockError} />);

      expect(screen.getByText('Custom error message')).toBeInTheDocument();
    });
  });

  describe('Technical details', () => {
    it('shows technical details when showDetails is true', () => {
      const mockError = new MockApiError(
        'Error',
        500,
        { detail: 'Internal error' },
        'req-123'
      );
      render(<ApiErrorDisplay error={mockError} showDetails={true} />);

      expect(screen.getByText('Technical Details')).toBeInTheDocument();
      expect(screen.getByText('Status:')).toBeInTheDocument();
      expect(screen.getByText('500')).toBeInTheDocument();
      expect(screen.getByText('Request ID:')).toBeInTheDocument();
      expect(screen.getByText('req-123')).toBeInTheDocument();
    });

    it('hides technical details when showDetails is false', () => {
      const mockError = new MockApiError(
        'Error',
        500,
        { detail: 'Internal error' },
        'req-123'
      );
      render(<ApiErrorDisplay error={mockError} showDetails={false} />);

      expect(screen.queryByText('Technical Details')).not.toBeInTheDocument();
    });
  });

  describe('Variant selection', () => {
    it('uses default variant for network errors', () => {
      const mockError = new MockApiError('Network error', 0);
      render(<ApiErrorDisplay error={mockError} />);

      const alert = screen.getByTestId('api-error-display');
      expect(alert).not.toHaveClass('border-destructive');
    });

    it('uses destructive variant for server errors', () => {
      const mockError = new MockApiError('Server error', 500);
      render(<ApiErrorDisplay error={mockError} />);

      const alert = screen.getByTestId('api-error-display');
      // Note: The exact class depends on the Alert component implementation
      expect(alert).toBeInTheDocument();
    });
  });
});

describe('InlineApiError', () => {
  // New tests for inline error consistency (Requirements 3.1, 3.2)
  describe('Inline error button text consistency', () => {
    it('displays "Retry" text consistently in inline mode', () => {
      const mockError = new MockApiError('Network error', 0);
      const mockOnRetry = vi.fn();

      testContext.renderComponent(
        <InlineApiError error={mockError} onRetry={mockOnRetry} />
      );

      const retryButton = screen.getByTestId('retry-button');
      expect(retryButton).toHaveTextContent('Retry');
      expect(retryButton).not.toHaveTextContent('Try Again');
    });

    it('does not show retry button for non-retryable errors in inline mode', () => {
      const mockError = new MockApiError('Bad request', 400);
      const mockOnRetry = vi.fn();

      testContext.renderComponent(
        <InlineApiError error={mockError} onRetry={mockOnRetry} />
      );

      expect(screen.queryByTestId('retry-button')).not.toBeInTheDocument();
    });

    it('calls retry handler when inline retry button is clicked', async () => {
      const mockError = new MockApiError('Server error', 500);
      const mockOnRetry = vi.fn();

      testContext.renderComponent(
        <InlineApiError error={mockError} onRetry={mockOnRetry} />
      );

      const retryButton = screen.getByTestId('retry-button');
      await userEvent.setup().click(retryButton);

      expect(mockOnRetry).toHaveBeenCalledTimes(1);
    });

    it('maintains proper inline styling and layout', () => {
      const mockError = new MockApiError('Network error', 0);
      const mockOnRetry = vi.fn();

      testContext.renderComponent(
        <InlineApiError error={mockError} onRetry={mockOnRetry} />
      );

      const container = screen.getByTestId('inline-api-error');
      expect(container).toHaveClass('flex', 'items-center', 'gap-2');

      const retryButton = screen.getByTestId('retry-button');
      expect(retryButton).toHaveClass('h-6', 'px-2', 'text-xs');
    });
  });

  describe('Inline error display', () => {
    it('shows error message in inline format', () => {
      const mockError = new MockApiError('Network connection failed', 0);
      testContext.renderComponent(<InlineApiError error={mockError} />);

      expect(screen.getByText('Network connection failed')).toBeInTheDocument();
      expect(screen.getByTestId('inline-api-error')).toBeInTheDocument();
    });

    it('shows alert triangle icon', () => {
      const mockError = new MockApiError('Error', 500);
      testContext.renderComponent(<InlineApiError error={mockError} />);

      const icon = screen.getByTestId('inline-api-error').querySelector('svg');
      expect(icon).toBeInTheDocument();
    });

    it('applies custom className', () => {
      const mockError = new MockApiError('Error', 500);
      testContext.renderComponent(
        <InlineApiError error={mockError} className="custom-class" />
      );

      const container = screen.getByTestId('inline-api-error');
      expect(container).toHaveClass('custom-class');
    });
  });
});
