import React, { Component, type ReactNode, type ErrorInfo } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button } from '../ui/button';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  showDetails?: boolean;
  level?: 'page' | 'component' | 'critical';
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: '',
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
      errorId: `error-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      errorInfo,
    });

    // Log error to console in development
    if (import.meta.env.DEV) {
      console.error('ErrorBoundary caught an error:', error, errorInfo);
    }

    // Call custom error handler
    this.props.onError?.(error, errorInfo);

    // In production, you might want to send this to an error reporting service
    if (import.meta.env.PROD) {
      // Example: Send to error reporting service
      // errorReportingService.captureException(error, {
      //   extra: errorInfo,
      //   tags: { errorBoundary: true, level: this.props.level }
      // });
    }
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: '',
    });
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const { level = 'component', showDetails = false } = this.props;
      const { error, errorInfo, errorId } = this.state;

      return (
        <div
          className="flex items-center justify-center min-h-[200px] p-4"
          data-testid="error-boundary"
        >
          <div className="max-w-md w-full">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>
                {level === 'critical'
                  ? 'Critical Error'
                  : level === 'page'
                    ? 'Page Error'
                    : 'Something went wrong'}
              </AlertTitle>
              <AlertDescription className="mt-2">
                <div data-testid="error-boundary-message">
                  {level === 'critical' ? (
                    <p>
                      A critical error occurred that prevents the application
                      from functioning properly.
                    </p>
                  ) : level === 'page' ? (
                    <p>
                      This page encountered an error and cannot be displayed.
                    </p>
                  ) : (
                    <p>
                      This component encountered an error and cannot be
                      displayed.
                    </p>
                  )}
                </div>
              </AlertDescription>
            </Alert>

            {showDetails && error && (
              <div className="mt-4 p-3 bg-gray-100 dark:bg-gray-800 rounded-md">
                <details>
                  <summary className="cursor-pointer text-sm font-medium">
                    Error Details
                  </summary>
                  <div className="mt-2 text-xs font-mono">
                    <p>
                      <strong>Error ID:</strong> {errorId}
                    </p>
                    <p>
                      <strong>Message:</strong> {error.message}
                    </p>
                    {error.stack && (
                      <div className="mt-2">
                        <strong>Stack Trace:</strong>
                        <pre className="whitespace-pre-wrap text-xs mt-1">
                          {error.stack}
                        </pre>
                      </div>
                    )}
                    {errorInfo?.componentStack && (
                      <div className="mt-2">
                        <strong>Component Stack:</strong>
                        <pre className="whitespace-pre-wrap text-xs mt-1">
                          {errorInfo.componentStack}
                        </pre>
                      </div>
                    )}
                  </div>
                </details>
              </div>
            )}

            <div className="flex gap-2 mt-4">
              <Button
                onClick={this.handleRetry}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
                data-testid="error-boundary-retry"
              >
                <RefreshCw className="h-4 w-4" />
                Try Again
              </Button>

              {level === 'page' && (
                <Button
                  onClick={this.handleGoHome}
                  variant="default"
                  size="sm"
                  className="flex items-center gap-2"
                  data-testid="error-boundary-home"
                >
                  <Home className="h-4 w-4" />
                  Go Home
                </Button>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Higher-order component for wrapping components with error boundary
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;

  return WrappedComponent;
}
