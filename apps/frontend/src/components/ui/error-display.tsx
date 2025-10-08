import { AlertTriangle } from 'lucide-react';
import { ApiError } from '../../lib/api-client';

interface ErrorDisplayProps {
  error: string | ApiError | null;
  className?: string;
}

export function ErrorDisplay({ error, className = '' }: ErrorDisplayProps) {
  if (!error) return null;

  const message = typeof error === 'string' ? error : error.message;

  return (
    <div className={`flex items-center gap-2 text-sm text-red-600 ${className}`}>
      <AlertTriangle className="h-4 w-4 flex-shrink-0" />
      <span>{message}</span>
    </div>
  );
}

export function getErrorMessage(error: string | ApiError | null): string | null {
  if (!error) return null;
  return typeof error === 'string' ? error : error.message;
}