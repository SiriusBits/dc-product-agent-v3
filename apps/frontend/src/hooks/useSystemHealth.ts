import { useState, useEffect, useCallback, useRef } from 'react';
import { apiClient, ApiError } from '../lib/api-client';
import type { SystemStatus } from '@repo/shared-types';

export interface UseSystemHealthReturn {
  isOnline: boolean;
  systemStatus: SystemStatus | null;
  lastChecked: Date | null;
  checking: boolean;
  error: ApiError | null;
  checkHealth: () => Promise<void>;
  startMonitoring: (interval?: number) => void;
  stopMonitoring: () => void;
  isMonitoring: boolean;
}

/**
 * Hook for monitoring system health and connectivity
 */
export function useSystemHealth(): UseSystemHealthReturn {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [isMonitoring, setIsMonitoring] = useState(false);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  const checkHealth = useCallback(async () => {
    if (checking) return;

    setChecking(true);
    setError(null);

    try {
      const [healthCheck, status] = await Promise.allSettled([
        apiClient.checkHealth(),
        apiClient.getSystemStatus(),
      ]);

      if (mountedRef.current) {
        if (healthCheck.status === 'fulfilled') {
          setIsOnline(healthCheck.value);
        }

        if (status.status === 'fulfilled') {
          setSystemStatus(status.value);
        } else if (status.status === 'rejected') {
          // Health check passed but status failed - system is partially available
          setSystemStatus(null);
        }

        setLastChecked(new Date());
      }
    } catch (err) {
      if (mountedRef.current) {
        const apiError =
          err instanceof ApiError
            ? err
            : new ApiError('Failed to check system health', 0);
        setError(apiError);
        setIsOnline(false);
        setSystemStatus(null);
        setLastChecked(new Date());
      }
    } finally {
      if (mountedRef.current) {
        setChecking(false);
      }
    }
  }, [checking]);

  const startMonitoring = useCallback(
    (interval = 30000) => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }

      setIsMonitoring(true);

      // Initial check
      checkHealth();

      // Set up periodic checks
      intervalRef.current = setInterval(() => {
        checkHealth();
      }, interval);
    },
    [checkHealth]
  );

  const stopMonitoring = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsMonitoring(false);
  }, []);

  // Handle browser online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (isMonitoring) {
        checkHealth();
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setSystemStatus(null);
      setError(new ApiError('Network connection lost', 0));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [isMonitoring, checkHealth]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return {
    isOnline,
    systemStatus,
    lastChecked,
    checking,
    error,
    checkHealth,
    startMonitoring,
    stopMonitoring,
    isMonitoring,
  };
}

/**
 * Hook for checking if specific services are available
 */
export function useServiceHealth(serviceName: string) {
  const { systemStatus } = useSystemHealth();

  const serviceStatus = systemStatus?.services.find(
    (service) => service.name === serviceName
  );

  return {
    isAvailable: serviceStatus?.status === 'up',
    status: serviceStatus?.status || 'unknown',
    responseTime: serviceStatus?.response_time_ms,
    lastCheck: serviceStatus?.last_check,
    details: serviceStatus?.details,
  };
}
