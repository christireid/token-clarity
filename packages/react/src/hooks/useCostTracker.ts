/**
 * @module hooks/useCostTracker
 * React hook for tracking API costs
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  createUsageTracker,
  estimateCost,
  type CostEstimate,
  type SessionStats,
} from '@token-optimizer/core';

/**
 * Options for useCostTracker hook
 */
export interface UseCostTrackerOptions {
  /** Model to use for cost calculation */
  model: string;
  /** Optional budget limit in USD */
  budgetLimit?: number;
  /** Callback when approaching budget limit (80%) */
  onBudgetWarning?: (spent: number, limit: number) => void;
  /** Callback when budget is exceeded */
  onBudgetExceeded?: (spent: number, limit: number) => void;
  /** Key for persisting usage data */
  persistKey?: string;
}

/**
 * Return type for useCostTracker hook
 */
export interface UseCostTrackerReturn {
  /** Total cost in current session */
  sessionCost: number;
  /** Total cost across all persisted sessions */
  totalCost: number;
  /** Number of requests tracked */
  requestCount: number;
  /** Total input tokens used */
  inputTokens: number;
  /** Total output tokens used */
  outputTokens: number;
  /** Total tokens served from cache */
  cachedTokens: number;
  /** Total savings from cache */
  totalSavings: number;
  /** Savings as percentage */
  savingsPercent: number;
  /** Track a new request */
  trackRequest: (usage: {
    inputTokens: number;
    outputTokens: number;
    cachedTokens?: number;
  }) => CostEstimate;
  /** Estimate cost for upcoming request */
  estimateNext: (inputTokens: number, outputEstimate: number) => CostEstimate;
  /** Reset all tracking data */
  reset: () => void;
  /** Remaining budget (null if no limit set) */
  budgetRemaining: number | null;
  /** Budget status */
  budgetStatus: 'ok' | 'warning' | 'exceeded' | null;
  /** Full session statistics */
  sessionStats: SessionStats;
}

/**
 * React hook for tracking API costs.
 * Monitors spending, calculates savings from caching, and enforces budget limits.
 *
 * @param options - Cost tracking options
 * @returns Cost tracking utilities
 *
 * @example
 * ```tsx
 * function CostDisplay() {
 *   const {
 *     sessionCost,
 *     totalSavings,
 *     savingsPercent,
 *     trackRequest,
 *     budgetStatus,
 *   } = useCostTracker({
 *     model: 'gpt-4o',
 *     budgetLimit: 10.00,
 *     persistKey: 'my-app-costs',
 *   });
 *
 *   // After API call
 *   const onResponse = (usage) => {
 *     const cost = trackRequest(usage);
 *     console.log(`Request cost: $${cost.totalCost.toFixed(4)}`);
 *   };
 *
 *   return (
 *     <div>
 *       <div>Spent: ${sessionCost.toFixed(4)}</div>
 *       <div>Saved: ${totalSavings.toFixed(4)} ({savingsPercent.toFixed(1)}%)</div>
 *       {budgetStatus === 'warning' && <div>Approaching budget limit!</div>}
 *     </div>
 *   );
 * }
 * ```
 */
export function useCostTracker(options: UseCostTrackerOptions): UseCostTrackerReturn {
  const {
    model,
    budgetLimit,
    onBudgetWarning,
    onBudgetExceeded,
    persistKey,
  } = options;

  // Create usage tracker
  const tracker = useMemo(() => {
    return createUsageTracker({
      persistKey,
    });
  }, [persistKey]);

  // State for reactive updates
  const [stats, setStats] = useState<SessionStats>(() => tracker.getSessionStats());
  const [lastCallbackTriggered, setLastCallbackTriggered] = useState<'warning' | 'exceeded' | null>(null);

  // Update stats when tracker changes
  const refreshStats = useCallback(() => {
    setStats(tracker.getSessionStats());
  }, [tracker]);

  // Track a request
  const trackRequest = useCallback(
    (usage: {
      inputTokens: number;
      outputTokens: number;
      cachedTokens?: number;
    }): CostEstimate => {
      const estimate = estimateCost(
        model,
        usage.inputTokens,
        usage.outputTokens,
        usage.cachedTokens
      );

      tracker.trackRequest({
        model,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        cachedTokens: usage.cachedTokens,
        totalTokens: usage.inputTokens + usage.outputTokens,
        cost: estimate.totalCost,
        savedFromCache: estimate.savings?.fromCache,
      });

      refreshStats();

      // Check budget after tracking
      const newStats = tracker.getSessionStats();
      if (budgetLimit) {
        if (newStats.cost > budgetLimit && lastCallbackTriggered !== 'exceeded') {
          onBudgetExceeded?.(newStats.cost, budgetLimit);
          setLastCallbackTriggered('exceeded');
        } else if (
          newStats.cost > budgetLimit * 0.8 &&
          newStats.cost <= budgetLimit &&
          lastCallbackTriggered !== 'warning' &&
          lastCallbackTriggered !== 'exceeded'
        ) {
          onBudgetWarning?.(newStats.cost, budgetLimit);
          setLastCallbackTriggered('warning');
        }
      }

      return estimate;
    },
    [model, tracker, budgetLimit, onBudgetWarning, onBudgetExceeded, lastCallbackTriggered, refreshStats]
  );

  // Estimate next request cost
  const estimateNext = useCallback(
    (inputTokens: number, outputEstimate: number): CostEstimate => {
      return estimateCost(model, inputTokens, outputEstimate);
    },
    [model]
  );

  // Reset tracking
  const reset = useCallback(() => {
    tracker.reset();
    refreshStats();
    setLastCallbackTriggered(null);
  }, [tracker, refreshStats]);

  // Calculate derived values
  const budgetStatus = useMemo(() => {
    if (!budgetLimit) return null;
    if (stats.cost > budgetLimit) return 'exceeded';
    if (stats.cost > budgetLimit * 0.8) return 'warning';
    return 'ok';
  }, [stats.cost, budgetLimit]);

  const savingsPercent = useMemo(() => {
    const totalSpentWithoutSavings = stats.cost + stats.savings;
    if (totalSpentWithoutSavings === 0) return 0;
    return (stats.savings / totalSpentWithoutSavings) * 100;
  }, [stats.cost, stats.savings]);

  return {
    sessionCost: stats.cost,
    totalCost: stats.cost, // In a full implementation, this would include historical data
    requestCount: stats.requestCount,
    inputTokens: stats.inputTokens,
    outputTokens: stats.outputTokens,
    cachedTokens: stats.cachedTokens,
    totalSavings: stats.savings,
    savingsPercent,
    trackRequest,
    estimateNext,
    reset,
    budgetRemaining: budgetLimit ? Math.max(0, budgetLimit - stats.cost) : null,
    budgetStatus,
    sessionStats: stats,
  };
}
