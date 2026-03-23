import { useState, useEffect, useCallback } from 'react';
import { pipelinesApi } from '../api/pipelines';
import type { StepbitCoreStatus } from '../types';

export const useStepbitCore = (interval = 30000) => {
  const [status, setStatus] = useState<StepbitCoreStatus>({
    online: false,
    ready: false,
    message: 'Checking...',
    active_model: '',
    supported_models: [],
      metrics: {
        requests_total: 0,
        tokens_generated_total: 0,
        active_sessions: 0,
        token_latency_avg_ms: 0,
      },
      warnings: [],
      capabilities: {
        planner_http: false,
        replan_http: false,
        distributed_http: false,
        metrics_http: false,
        mcp_registry_http: false,
      },
    });
  const [loading, setLoading] = useState(true);

  const checkStatus = useCallback(async () => {
    try {
      const currentStatus = await pipelinesApi.getStepbitCoreStatus();
      setStatus(currentStatus);
    } catch (error) {
      setStatus({
        online: false,
        ready: false,
        message: 'Failed to reach backend',
        active_model: '',
        supported_models: [],
        metrics: {
          requests_total: 0,
          tokens_generated_total: 0,
          active_sessions: 0,
          token_latency_avg_ms: 0,
        },
        warnings: [],
        capabilities: {
          planner_http: false,
          replan_http: false,
          distributed_http: false,
          metrics_http: false,
          mcp_registry_http: false,
        },
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkStatus();
    if (interval > 0) {
      const timer = setInterval(checkStatus, interval);
      return () => clearInterval(timer);
    }
  }, [checkStatus, interval]);

  return { ...status, loading, refresh: checkStatus };
};
