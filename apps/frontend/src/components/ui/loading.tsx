import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function LoadingSpinner({
  size = 'md',
  className,
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
  };

  return (
    <Loader2
      data-testid="loading-spinner"
      className={cn('animate-spin', sizeClasses[size], className)}
    />
  );
}

interface LoadingStateProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function LoadingState({
  message = 'Loading...',
  size = 'md',
  className,
}: LoadingStateProps) {
  return (
    <div
      className={cn('flex items-center justify-center gap-2 p-4', className)}
    >
      <LoadingSpinner size={size} />
      <span className="text-muted-foreground">{message}</span>
    </div>
  );
}

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return <div className={cn('animate-pulse rounded-md bg-muted', className)} />;
}

interface CardSkeletonProps {
  showImage?: boolean;
  lines?: number;
  className?: string;
}

export function CardSkeleton({
  showImage = false,
  lines = 3,
  className,
}: CardSkeletonProps) {
  return (
    <div className={cn('space-y-3 p-4', className)}>
      {showImage && <Skeleton className="h-48 w-full" />}
      <div className="space-y-2">
        <Skeleton className="h-4 w-3/4" />
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton
            key={i}
            className={cn('h-3', i === lines - 1 ? 'w-1/2' : 'w-full')}
          />
        ))}
      </div>
    </div>
  );
}

interface TableSkeletonProps {
  rows?: number;
  columns?: number;
  className?: string;
}

export function TableSkeleton({
  rows = 5,
  columns = 4,
  className,
}: TableSkeletonProps) {
  return (
    <div className={cn('space-y-3', className)}>
      {/* Header */}
      <div className="flex gap-4">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={`header-${i}`} className="h-4 flex-1" />
        ))}
      </div>

      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={`row-${rowIndex}`} className="flex gap-4">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton
              key={`cell-${rowIndex}-${colIndex}`}
              className="h-3 flex-1"
            />
          ))}
        </div>
      ))}
    </div>
  );
}

interface LoadingOverlayProps {
  isLoading: boolean;
  message?: string;
  children: React.ReactNode;
  className?: string;
}

export function LoadingOverlay({
  isLoading,
  message = 'Loading...',
  children,
  className,
}: LoadingOverlayProps) {
  return (
    <div className={cn('relative', className)}>
      {children}
      {isLoading && (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="flex items-center gap-2 bg-background border rounded-lg p-4 shadow-lg">
            <LoadingSpinner />
            <span className="text-sm">{message}</span>
          </div>
        </div>
      )}
    </div>
  );
}

interface ProgressiveLoadingProps {
  stages: Array<{
    message: string;
    completed: boolean;
  }>;
  className?: string;
}

export function ProgressiveLoading({
  stages,
  className,
}: ProgressiveLoadingProps) {
  const currentStage = stages.findIndex((stage) => !stage.completed);
  const progress =
    (stages.filter((stage) => stage.completed).length / stages.length) * 100;

  return (
    <div className={cn('space-y-4 p-4', className)}>
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span>Loading...</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="w-full bg-muted rounded-full h-2">
          <div
            className="bg-primary h-2 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="space-y-2">
        {stages.map((stage, index) => (
          <div key={index} className="flex items-center gap-2 text-sm">
            {stage.completed ? (
              <div className="h-2 w-2 bg-green-500 rounded-full" />
            ) : index === currentStage ? (
              <LoadingSpinner size="sm" />
            ) : (
              <div className="h-2 w-2 bg-muted rounded-full" />
            )}
            <span
              className={cn(
                stage.completed
                  ? 'text-green-600'
                  : index === currentStage
                    ? 'text-foreground'
                    : 'text-muted-foreground'
              )}
            >
              {stage.message}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
