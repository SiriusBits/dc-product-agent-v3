import { useState, useCallback, useRef, useEffect } from 'react';
import { ApiError } from '../lib/api-client';

export interface UseApiState<T> {
  data: T | null;
  loading: boolean;
  error: ApiError | null;
  lastUpdated: Date | null;
}

export interface UseApiOptions<T = unknown> {
  retryOnMount?: boolean;
  retryDelay?: number;
  maxRetries?: number;
  onSuccess?: (data: T) => void;
  onError?: (error: ApiError) => void;
}

export interface UseApiReturn<T, TArgs extends unknown[] = unknown[]>
  extends UseApiState<T> {
  execute: (...args: TArgs) => Promise<T | null>;
  retry: () => Promise<T | null>;
  reset: () => void;
  isRetryable: boolean;
}

/**
 * Generic hook for API requests with loading states, error handling, and retry logic
 */
export function useApi<T, TArgs extends unknown[] = unknown[]>(
  apiFunction: (...args: TArgs) => Promise<T>,
  options: UseApiOptions<T> = {}
): UseApiReturn<T, TArgs> {
  const [state, setState] = useState<UseApiState<T>>({
    data: null,
    loading: false,
    error: null,
    lastUpdated: null,
  });

  const lastArgsRef = useRef<TArgs>([] as unknown as TArgs);
  const abortControllerRef = useRef<AbortController | null>(null);
  const retryCountRef = useRef(0);

  const {
    retryOnMount = false,
    retryDelay = 1000,
    maxRetries = 3,
    onSuccess,
    onError,
  } = options;

  const execute = useCallback(
    async (...args: TArgs): Promise<T | null> => {
      // Cancel any ongoing request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      lastArgsRef.current = args;
      retryCountRef.current = 0;

      setState((prev) => ({
        ...prev,
        loading: true,
        error: null,
      }));

      try {
        const result = await apiFunction(...args);

        setState({
          data: result,
          loading: false,
          error: null,
          lastUpdated: new Date(),
        });

        onSuccess?.(result);
        return result;
      } catch (error) {
        const apiError =
          error instanceof ApiError
            ? error
            : new ApiError(
                error instanceof Error ? error.message : 'Unknown error',
                0
              );

        setState((prev) => ({
          ...prev,
          loading: false,
          error: apiError,
        }));

        onError?.(apiError);
        return null;
      }
    },
    [apiFunction, onSuccess, onError]
  );

  const retry = useCallback(async (): Promise<T | null> => {
    if (retryCountRef.current >= maxRetries) {
      return null;
    }

    retryCountRef.current++;

    // Wait before retrying
    if (retryDelay > 0) {
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
    }

    return execute(...lastArgsRef.current);
  }, [execute, maxRetries, retryDelay]);

  const reset = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    setState({
      data: null,
      loading: false,
      error: null,
      lastUpdated: null,
    });

    retryCountRef.current = 0;
    lastArgsRef.current = [] as unknown as TArgs;
  }, []);

  // Auto-retry on mount if enabled and there's an error
  useEffect(() => {
    if (
      retryOnMount &&
      state.error?.isRetryable() &&
      retryCountRef.current < maxRetries
    ) {
      const timeoutId = setTimeout(() => {
        retry();
      }, retryDelay);

      return () => clearTimeout(timeoutId);
    }
  }, [retryOnMount, state.error, retry, maxRetries, retryDelay]);

  // Cleanup on unmount
  useEffect(() => {
    const controller = abortControllerRef.current;
    return () => {
      if (controller) {
        controller.abort();
      }
    };
  }, []);

  return {
    ...state,
    execute,
    retry,
    reset,
    isRetryable: state.error?.isRetryable() ?? false,
  };
}

/**
 * Hook for API requests that should execute immediately on mount
 */
export function useApiQuery<T, TArgs extends unknown[] = unknown[]>(
  apiFunction: (...args: TArgs) => Promise<T>,
  args: TArgs = [] as unknown as TArgs,
  options: UseApiOptions<T> = {}
): UseApiReturn<T, TArgs> {
  const api = useApi(apiFunction, options);

  useEffect(() => {
    api.execute(...args);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return api;
}

/**
 * Hook for managing multiple API requests with shared loading state
 */
export function useApiGroup<T extends Record<string, unknown>>(
  requests: Record<keyof T, () => Promise<unknown>>
): {
  data: Partial<T>;
  loading: boolean;
  errors: Record<keyof T, ApiError | null>;
  execute: () => Promise<void>;
  retry: () => Promise<void>;
  reset: () => void;
} {
  const [data, setData] = useState<Partial<T>>({});
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<keyof T, ApiError | null>>(
    {} as Record<keyof T, ApiError | null>
  );

  const execute = useCallback(async () => {
    setLoading(true);
    setErrors({} as Record<keyof T, ApiError | null>);

    const results = await Promise.allSettled(
      Object.entries(requests).map(async ([key, request]) => {
        try {
          const result = await request();
          return { key, result, error: null };
        } catch (error) {
          const apiError =
            error instanceof ApiError
              ? error
              : new ApiError(
                  error instanceof Error ? error.message : 'Unknown error',
                  0
                );
          return { key, result: null, error: apiError };
        }
      })
    );

    const newData: Partial<T> = {};
    const newErrors: Record<keyof T, ApiError | null> = {} as Record<
      keyof T,
      ApiError | null
    >;

    results.forEach((result) => {
      if (result.status === 'fulfilled') {
        const { key, result: data, error } = result.value;
        if (error) {
          newErrors[key as keyof T] = error;
        } else {
          newData[key as keyof T] = data as T[keyof T];
        }
      }
    });

    setData(newData);
    setErrors(newErrors);
    setLoading(false);
  }, [requests]);

  const retry = useCallback(async () => {
    await execute();
  }, [execute]);

  const reset = useCallback(() => {
    setData({});
    setErrors({} as Record<keyof T, ApiError | null>);
    setLoading(false);
  }, []);

  return {
    data,
    loading,
    errors,
    execute,
    retry,
    reset,
  };
}
