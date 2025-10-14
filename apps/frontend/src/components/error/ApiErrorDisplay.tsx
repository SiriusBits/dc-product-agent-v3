import { AlertTriangle, RefreshCw, WifiOff } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Button } from '../ui/button';
import { ApiError } from '../../lib/api-client';

interface ApiErrorDisplayProps {
  error: ApiError;
  onRetry?: () => void;
  showDetails?: boolean;
  className?: string;
}

export function ApiErrorDisplay({
  error,
  onRetry,
  showDetails = false,
  className,
}: ApiErrorDisplayProps) {
  const getErrorIcon = () => {
    if (error.isNetworkError()) {
      return <WifiOff className="h-4 w-4" />;
    }
    return <AlertTriangle className="h-4 w-4" />;
  };

  const getErrorTitle = () => {
    if (error.isNetworkError()) {
      return 'Connection Error';
    }
    if (error.isServerError()) {
      return 'Server Error';
    }
    if (error.status === 404) {
      return 'Not Found';
    }
    if (error.status === 403) {
      return 'Access Denied';
    }
    if (error.status === 401) {
      return 'Authentication Required';
    }
    return 'Request Failed';
  };

  const getErrorDescription = () => {
    if (error.isNetworkError()) {
      return 'Unable to connect to the server. Please check your internet connection and try again.';
    }
    if (error.isServerError()) {
      return 'The server encountered an error. Please try again in a few moments.';
    }
    if (error.status === 404) {
      return 'The requested resource could not be found.';
    }
    if (error.status === 403) {
      return 'You do not have permission to access this resource.';
    }
    if (error.status === 401) {
      return 'Please log in to access this resource.';
    }
    return error.message || 'An unexpected error occurred.';
  };

  const getVariant = (): 'default' | 'destructive' => {
    if (error.isNetworkError() || error.status === 401) {
      return 'default';
    }
    return 'destructive';
  };

  return (
    <Alert
      variant={getVariant()}
      className={className}
      data-testid="api-error-display"
    >
      {getErrorIcon()}
      <AlertTitle>{getErrorTitle()}</AlertTitle>
      <AlertDescription className="mt-2">
        <p data-testid="error-message">{getErrorDescription()}</p>

        {showDetails && (
          <div className="mt-3 p-2 bg-muted rounded text-sm">
            <details>
              <summary className="cursor-pointer font-medium">
                Technical Details
              </summary>
              <div className="mt-2 space-y-1 text-xs">
                <p>
                  <strong>Status:</strong> {error.status}
                </p>
                {error.requestId && (
                  <p>
                    <strong>Request ID:</strong> {error.requestId}
                  </p>
                )}
                {error.details != null && (
                  <div>
                    <strong>Details:</strong>
                    <pre className="mt-1 whitespace-pre-wrap">
                      {typeof error.details === 'string'
                        ? error.details
                        : JSON.stringify(error.details, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </details>
          </div>
        )}

        {onRetry && error.isRetryable() && (
          <Button
            onClick={onRetry}
            variant="outline"
            size="sm"
            className="mt-3 flex items-center gap-2"
            data-testid="retry-button"
          >
            <RefreshCw className="h-4 w-4" />
            Try Again
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}

/**
 * Inline error display for smaller spaces
 */
export function InlineApiError({
  error,
  onRetry,
  className,
}: Omit<ApiErrorDisplayProps, 'showDetails'>) {
  return (
    <div
      className={`flex items-center gap-2 text-sm text-destructive ${className}`}
      data-testid="inline-api-error"
    >
      <AlertTriangle className="h-4 w-4 flex-shrink-0" />
      <span className="flex-1" data-testid="error-message">
        {error.message}
      </span>
      {onRetry && error.isRetryable() && (
        <Button
          onClick={onRetry}
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs"
          data-testid="retry-button"
        >
          Retry
        </Button>
      )}
    </div>
  );
}
