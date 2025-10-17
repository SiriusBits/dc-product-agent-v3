import * as React from 'react';
import { cn } from '../../lib/utils';

export interface SpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: 'sm' | 'md' | 'lg';
  testId?: string;
}

export const Spinner = React.forwardRef<HTMLDivElement, SpinnerProps>(
  ({ className, size = 'md', testId = 'loading-spinner', ...props }, ref) => {
    const sizeClasses = {
      sm: 'h-4 w-4',
      md: 'h-6 w-6',
      lg: 'h-8 w-8',
    };

    return (
      <div
        ref={ref}
        data-testid={testId}
        className={cn(
          'animate-spin rounded-full border-2 border-current border-t-transparent',
          sizeClasses[size],
          className
        )}
        {...props}
      >
        <span className="sr-only">Loading...</span>
      </div>
    );
  }
);

Spinner.displayName = 'Spinner';

export interface LoadingProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  testId?: string;
}

export function Loading({
  message = 'Loading...',
  size = 'md',
  className,
  testId,
}: LoadingProps) {
  return (
    <div
      className={cn('flex items-center justify-center space-x-2', className)}
    >
      <Spinner size={size} testId={testId} />
      <span className="text-sm text-muted-foreground">{message}</span>
    </div>
  );
}
