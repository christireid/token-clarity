/**
 * @module hooks/useDevtools
 * React hook for collecting and managing devtools data
 */

import { useState, useCallback, useMemo, useRef } from 'react';
import type { SessionStats } from '@token-optimizer/core';
import type { DevtoolsRequestEntry, DevtoolsMetrics } from '../components/TokenDevtoolsPanel.js';

/**
 * Options for useDevtools hook
 */
export interface UseDevtoolsOptions {
  /** Maximum number of requests to keep in history */
  maxHistory?: number;
  /** Enable auto-tracking of requests */
  autoTrack?: boolean;
  /** Persist history to localStorage */
  persistKey?: string;
}

/**
 * Return type for useDevtools hook
 */
export interface UseDevtoolsReturn {
  /** Array of tracked requests */
  requestHistory: DevtoolsRequestEntry[];
  /** Aggregated session stats */
  sessionStats: SessionStats;
  /** Computed metrics */
  metrics: DevtoolsMetrics;
  /** Track a new request */
  trackRequest: (request: Omit<DevtoolsRequestEntry, 'id' | 'timestamp'>) => void;
  /** Clear all history */
  clearHistory: () => void;
  /** Reset all tracking */
  reset: () => void;
  /** Get request by ID */
  getRequest: (id: string) => DevtoolsRequestEntry | undefined;
  /** Export history as JSON */
  exportHistory: () => string;
  /** Import history from JSON */
  importHistory: (json: string) => void;
}

/**
 * Generate a unique request ID
 */
function generateId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Calculate metrics from request history
 */
function calculateMetrics(history: DevtoolsRequestEntry[]): DevtoolsMetrics {
  const metrics: DevtoolsMetrics = {
    totalRequests: history.length,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalCachedTokens: 0,
    totalCost: 0,
    totalSavings: 0,
    cacheHitRate: 0,
    avgLatency: 0,
    tokensPerSecond: 0,
    byModel: {},
    byProvider: {},
  };

  if (history.length === 0) return metrics;

  let totalLatency = 0;
  let cacheHits = 0;

  for (const req of history) {
    metrics.totalInputTokens += req.inputTokens;
    metrics.totalOutputTokens += req.outputTokens;
    metrics.totalCachedTokens += req.cachedTokens;
    metrics.totalCost += req.cost;
    totalLatency += req.latency;

    if (req.cachedTokens > 0) {
      cacheHits++;
      // Estimate savings (cached tokens cost ~90% less)
      const savingsRate = 0.9;
      const perTokenCost = req.cost / (req.inputTokens + req.outputTokens - req.cachedTokens * savingsRate);
      metrics.totalSavings += req.cachedTokens * perTokenCost * savingsRate;
    }

    // By model
    if (!metrics.byModel[req.model]) {
      metrics.byModel[req.model] = { requests: 0, tokens: 0, cost: 0 };
    }
    const modelMetrics = metrics.byModel[req.model]!;
    modelMetrics.requests++;
    modelMetrics.tokens += req.inputTokens + req.outputTokens;
    modelMetrics.cost += req.cost;

    // By provider
    if (!metrics.byProvider[req.provider]) {
      metrics.byProvider[req.provider] = { requests: 0, tokens: 0, cost: 0 };
    }
    const providerMetrics = metrics.byProvider[req.provider]!;
    providerMetrics.requests++;
    providerMetrics.tokens += req.inputTokens + req.outputTokens;
    providerMetrics.cost += req.cost;
  }

  metrics.cacheHitRate = cacheHits / history.length;
  metrics.avgLatency = totalLatency / history.length;

  const totalTokens = metrics.totalInputTokens + metrics.totalOutputTokens;
  const totalTimeSeconds = totalLatency / 1000;
  metrics.tokensPerSecond = totalTimeSeconds > 0 ? totalTokens / totalTimeSeconds : 0;

  return metrics;
}

/**
 * Calculate session stats from request history
 */
function calculateSessionStats(history: DevtoolsRequestEntry[]): SessionStats {
  let inputTokens = 0;
  let outputTokens = 0;
  let cachedTokens = 0;
  let cost = 0;
  let savings = 0;

  for (const req of history) {
    inputTokens += req.inputTokens;
    outputTokens += req.outputTokens;
    cachedTokens += req.cachedTokens;
    cost += req.cost;

    if (req.cachedTokens > 0) {
      const savingsRate = 0.9;
      const perTokenCost = req.cost / Math.max(1, req.inputTokens + req.outputTokens - req.cachedTokens * savingsRate);
      savings += req.cachedTokens * perTokenCost * savingsRate;
    }
  }

  return {
    cost,
    inputTokens,
    outputTokens,
    cachedTokens,
    savings,
    requestCount: history.length,
  };
}

/**
 * React hook for collecting and managing devtools data.
 * Tracks request history, calculates metrics, and provides export functionality.
 *
 * @param options - Devtools configuration
 * @returns Devtools utilities
 *
 * @example
 * ```tsx
 * function App() {
 *   const devtools = useDevtools({ maxHistory: 100 });
 *
 *   // Track a request after API call
 *   const handleResponse = (response) => {
 *     devtools.trackRequest({
 *       model: 'gpt-4o',
 *       provider: 'openai',
 *       inputTokens: response.usage.prompt_tokens,
 *       outputTokens: response.usage.completion_tokens,
 *       cachedTokens: response.usage.prompt_tokens_details?.cached_tokens ?? 0,
 *       cost: calculateCost(response.usage),
 *       latency: response.latency,
 *     });
 *   };
 *
 *   return (
 *     <TokenDevtoolsPanel
 *       requestHistory={devtools.requestHistory}
 *       sessionStats={devtools.sessionStats}
 *       onReset={devtools.reset}
 *     />
 *   );
 * }
 * ```
 */
export function useDevtools(options: UseDevtoolsOptions = {}): UseDevtoolsReturn {
  const { maxHistory = 500, persistKey } = options;

  // Load initial history from localStorage if persistKey is provided
  const getInitialHistory = (): DevtoolsRequestEntry[] => {
    if (persistKey && typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(`devtools_${persistKey}`);
        if (stored) {
          return JSON.parse(stored) as DevtoolsRequestEntry[];
        }
      } catch {
        // Ignore parse errors
      }
    }
    return [];
  };

  const [history, setHistory] = useState<DevtoolsRequestEntry[]>(getInitialHistory);
  const historyRef = useRef(history);
  historyRef.current = history;

  // Persist to localStorage when history changes
  const persistHistory = useCallback((newHistory: DevtoolsRequestEntry[]) => {
    if (persistKey && typeof window !== 'undefined') {
      try {
        localStorage.setItem(`devtools_${persistKey}`, JSON.stringify(newHistory));
      } catch {
        // Ignore storage errors
      }
    }
  }, [persistKey]);

  // Track a new request
  const trackRequest = useCallback((request: Omit<DevtoolsRequestEntry, 'id' | 'timestamp'>) => {
    const entry: DevtoolsRequestEntry = {
      ...request,
      id: generateId(),
      timestamp: Date.now(),
    };

    setHistory((prev) => {
      const newHistory = [...prev, entry];
      // Trim to maxHistory
      const trimmed = newHistory.slice(-maxHistory);
      persistHistory(trimmed);
      return trimmed;
    });
  }, [maxHistory, persistHistory]);

  // Clear history
  const clearHistory = useCallback(() => {
    setHistory([]);
    persistHistory([]);
  }, [persistHistory]);

  // Reset all tracking
  const reset = useCallback(() => {
    clearHistory();
  }, [clearHistory]);

  // Get request by ID
  const getRequest = useCallback((id: string): DevtoolsRequestEntry | undefined => {
    return historyRef.current.find((r) => r.id === id);
  }, []);

  // Export history as JSON
  const exportHistory = useCallback((): string => {
    return JSON.stringify({
      exportedAt: new Date().toISOString(),
      requests: historyRef.current,
      metrics: calculateMetrics(historyRef.current),
    }, null, 2);
  }, []);

  // Import history from JSON
  const importHistory = useCallback((json: string) => {
    try {
      const data = JSON.parse(json) as { requests?: DevtoolsRequestEntry[] };
      if (Array.isArray(data.requests)) {
        const newHistory = data.requests.slice(-maxHistory);
        setHistory(newHistory);
        persistHistory(newHistory);
      }
    } catch {
      throw new Error('Invalid JSON format');
    }
  }, [maxHistory, persistHistory]);

  // Calculate metrics
  const metrics = useMemo(() => calculateMetrics(history), [history]);

  // Calculate session stats
  const sessionStats = useMemo(() => calculateSessionStats(history), [history]);

  return {
    requestHistory: history,
    sessionStats,
    metrics,
    trackRequest,
    clearHistory,
    reset,
    getRequest,
    exportHistory,
    importHistory,
  };
}

export default useDevtools;
