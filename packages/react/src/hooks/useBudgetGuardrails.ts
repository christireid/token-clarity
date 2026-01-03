/**
 * @module hooks/useBudgetGuardrails
 * Budget guardrails with spending alerts and limits
 */

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import type { CostEstimate } from '@token-optimizer/core';

/**
 * Budget period
 */
export type BudgetPeriod = 'request' | 'hourly' | 'daily' | 'weekly' | 'monthly';

/**
 * Budget limit configuration
 */
export interface BudgetLimit {
  /** Period for this limit */
  period: BudgetPeriod;
  /** Maximum spend in USD */
  limit: number;
  /** Warning threshold (0-1, e.g., 0.8 = warn at 80%) */
  warnAt?: number;
  /** Soft limit - warn but allow */
  soft?: boolean;
}

/**
 * Budget status for a period
 */
export interface BudgetPeriodStatus {
  period: BudgetPeriod;
  spent: number;
  limit: number;
  remaining: number;
  percentUsed: number;
  status: 'ok' | 'warning' | 'exceeded';
  softLimit: boolean;
}

/**
 * Budget alert
 */
export interface BudgetAlert {
  id: string;
  timestamp: number;
  period: BudgetPeriod;
  type: 'warning' | 'exceeded' | 'blocked';
  message: string;
  spent: number;
  limit: number;
}

/**
 * Spending record
 */
interface SpendingRecord {
  timestamp: number;
  amount: number;
  requestId?: string;
}

/**
 * Options for useBudgetGuardrails
 */
export interface UseBudgetGuardrailsOptions {
  /** Budget limits */
  limits: BudgetLimit[];
  /** Callback when warning threshold is reached */
  onWarning?: (alert: BudgetAlert) => void;
  /** Callback when limit is exceeded */
  onExceeded?: (alert: BudgetAlert) => void;
  /** Callback when request is blocked */
  onBlocked?: (alert: BudgetAlert) => void;
  /** Storage key for persistence */
  persistKey?: string;
  /** Auto-reset periods at their boundaries */
  autoReset?: boolean;
}

/**
 * Return type for useBudgetGuardrails
 */
export interface UseBudgetGuardrailsReturn {
  /** Check if a request can proceed */
  canSpend: (amount: number) => { allowed: boolean; reason?: string };
  /** Record spending */
  recordSpend: (amount: number, requestId?: string) => void;
  /** Get status for all periods */
  getStatus: () => BudgetPeriodStatus[];
  /** Get status for a specific period */
  getPeriodStatus: (period: BudgetPeriod) => BudgetPeriodStatus | undefined;
  /** Recent alerts */
  alerts: BudgetAlert[];
  /** Clear alerts */
  clearAlerts: () => void;
  /** Reset spending for a period */
  resetPeriod: (period: BudgetPeriod) => void;
  /** Reset all spending */
  resetAll: () => void;
  /** Total spent across all time in this session */
  totalSpent: number;
  /** Check a cost estimate before sending */
  checkCost: (estimate: CostEstimate) => { allowed: boolean; warnings: string[] };
}

/**
 * Get period start timestamp
 */
function getPeriodStart(period: BudgetPeriod): number {
  const now = new Date();

  switch (period) {
    case 'request':
      return now.getTime();
    case 'hourly':
      return new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours()).getTime();
    case 'daily':
      return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    case 'weekly': {
      const day = now.getDay();
      const diff = now.getDate() - day;
      return new Date(now.getFullYear(), now.getMonth(), diff).getTime();
    }
    case 'monthly':
      return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    default:
      return now.getTime();
  }
}

/**
 * Generate unique ID
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * useBudgetGuardrails - Enforce spending limits with alerts
 *
 * @param options - Configuration options
 * @returns Budget guardrail utilities
 *
 * @example
 * ```tsx
 * function Chat() {
 *   const { canSpend, recordSpend, alerts } = useBudgetGuardrails({
 *     limits: [
 *       { period: 'daily', limit: 10, warnAt: 0.8 },
 *       { period: 'monthly', limit: 100, warnAt: 0.9 },
 *       { period: 'request', limit: 0.50, soft: true },
 *     ],
 *     onWarning: (alert) => toast.warn(alert.message),
 *     onExceeded: (alert) => toast.error(alert.message),
 *   });
 *
 *   const handleSend = async () => {
 *     const estimatedCost = 0.05;
 *     const { allowed, reason } = canSpend(estimatedCost);
 *
 *     if (!allowed) {
 *       alert(reason);
 *       return;
 *     }
 *
 *     const response = await sendRequest();
 *     recordSpend(response.cost);
 *   };
 * }
 * ```
 */
export function useBudgetGuardrails(
  options: UseBudgetGuardrailsOptions
): UseBudgetGuardrailsReturn {
  const {
    limits,
    onWarning,
    onExceeded,
    onBlocked,
    persistKey,
    autoReset = true,
  } = options;

  // Spending records by period
  const [spending, setSpending] = useState<Map<BudgetPeriod, SpendingRecord[]>>(() => {
    // Try to load from storage
    if (persistKey && typeof localStorage !== 'undefined') {
      try {
        const stored = localStorage.getItem(`budget-guardrails-${persistKey}`);
        if (stored) {
          const parsed = JSON.parse(stored);
          return new Map(Object.entries(parsed) as [BudgetPeriod, SpendingRecord[]][]);
        }
      } catch {
        // Ignore storage errors
      }
    }
    return new Map();
  });

  const [alerts, setAlerts] = useState<BudgetAlert[]>([]);
  const lastResetRef = useRef<Map<BudgetPeriod, number>>(new Map());

  // Persist spending to storage
  useEffect(() => {
    if (persistKey && typeof localStorage !== 'undefined') {
      try {
        const obj: Record<string, SpendingRecord[]> = {};
        spending.forEach((records, period) => {
          obj[period] = records;
        });
        localStorage.setItem(`budget-guardrails-${persistKey}`, JSON.stringify(obj));
      } catch {
        // Ignore storage errors
      }
    }
  }, [spending, persistKey]);

  // Auto-reset expired periods
  useEffect(() => {
    if (!autoReset) return;

    const checkAndReset = () => {
      const now = Date.now();

      limits.forEach((limit) => {
        const periodStart = getPeriodStart(limit.period);
        const lastReset = lastResetRef.current.get(limit.period) ?? 0;

        if (periodStart > lastReset) {
          // Period has rolled over - filter out old records
          setSpending((prev) => {
            const newMap = new Map(prev);
            const records = newMap.get(limit.period) ?? [];
            const filtered = records.filter((r) => r.timestamp >= periodStart);
            newMap.set(limit.period, filtered);
            return newMap;
          });
          lastResetRef.current.set(limit.period, now);
        }
      });
    };

    // Check immediately and then every minute
    checkAndReset();
    const interval = setInterval(checkAndReset, 60000);

    return () => clearInterval(interval);
  }, [limits, autoReset]);

  // Calculate spent for a period
  const getSpentForPeriod = useCallback(
    (period: BudgetPeriod): number => {
      const periodStart = getPeriodStart(period);
      const records = spending.get(period) ?? [];
      return records
        .filter((r) => r.timestamp >= periodStart)
        .reduce((sum, r) => sum + r.amount, 0);
    },
    [spending]
  );

  // Get status for a period
  const getPeriodStatus = useCallback(
    (period: BudgetPeriod): BudgetPeriodStatus | undefined => {
      const limitConfig = limits.find((l) => l.period === period);
      if (!limitConfig) return undefined;

      const spent = getSpentForPeriod(period);
      const remaining = Math.max(0, limitConfig.limit - spent);
      const percentUsed = limitConfig.limit > 0 ? spent / limitConfig.limit : 0;

      let status: 'ok' | 'warning' | 'exceeded' = 'ok';
      if (percentUsed >= 1) {
        status = 'exceeded';
      } else if (limitConfig.warnAt && percentUsed >= limitConfig.warnAt) {
        status = 'warning';
      }

      return {
        period,
        spent,
        limit: limitConfig.limit,
        remaining,
        percentUsed,
        status,
        softLimit: limitConfig.soft ?? false,
      };
    },
    [limits, getSpentForPeriod]
  );

  // Get status for all periods
  const getStatus = useCallback((): BudgetPeriodStatus[] => {
    return limits
      .map((l) => getPeriodStatus(l.period))
      .filter((s): s is BudgetPeriodStatus => s !== undefined);
  }, [limits, getPeriodStatus]);

  // Check if spending is allowed
  const canSpend = useCallback(
    (amount: number): { allowed: boolean; reason?: string } => {
      for (const limit of limits) {
        const status = getPeriodStatus(limit.period);
        if (!status) continue;

        if (status.spent + amount > limit.limit) {
          if (limit.soft) {
            // Soft limit - warn but allow
            continue;
          }
          return {
            allowed: false,
            reason: `${limit.period} budget exceeded: $${status.spent.toFixed(2)} + $${amount.toFixed(4)} > $${limit.limit.toFixed(2)}`,
          };
        }
      }
      return { allowed: true };
    },
    [limits, getPeriodStatus]
  );

  // Check a cost estimate
  const checkCost = useCallback(
    (estimate: CostEstimate): { allowed: boolean; warnings: string[] } => {
      const { allowed, reason } = canSpend(estimate.totalCost);
      const warnings: string[] = [];

      // Check for warnings even if allowed
      for (const limit of limits) {
        const status = getPeriodStatus(limit.period);
        if (!status) continue;

        const wouldBe = status.spent + estimate.totalCost;
        const wouldBePercent = wouldBe / limit.limit;

        if (status.status === 'warning' || (limit.warnAt && wouldBePercent >= limit.warnAt)) {
          warnings.push(
            `${limit.period} budget at ${(wouldBePercent * 100).toFixed(0)}%`
          );
        }
      }

      return { allowed, warnings: reason ? [reason, ...warnings] : warnings };
    },
    [canSpend, limits, getPeriodStatus]
  );

  // Record spending
  const recordSpend = useCallback(
    (amount: number, requestId?: string) => {
      const timestamp = Date.now();
      const record: SpendingRecord = { timestamp, amount, requestId };

      // Add to all relevant periods
      setSpending((prev) => {
        const newMap = new Map(prev);

        for (const limit of limits) {
          const records = newMap.get(limit.period) ?? [];
          newMap.set(limit.period, [...records, record]);
        }

        return newMap;
      });

      // Check for alerts
      for (const limit of limits) {
        const status = getPeriodStatus(limit.period);
        if (!status) continue;

        const newSpent = status.spent + amount;
        const newPercent = newSpent / limit.limit;

        if (newPercent >= 1 && status.status !== 'exceeded') {
          const alert: BudgetAlert = {
            id: generateId(),
            timestamp,
            period: limit.period,
            type: limit.soft ? 'exceeded' : 'blocked',
            message: `${limit.period} budget exceeded: $${newSpent.toFixed(2)} of $${limit.limit.toFixed(2)}`,
            spent: newSpent,
            limit: limit.limit,
          };
          setAlerts((prev) => [...prev, alert]);

          if (limit.soft) {
            onExceeded?.(alert);
          } else {
            onBlocked?.(alert);
          }
        } else if (
          limit.warnAt &&
          newPercent >= limit.warnAt &&
          status.percentUsed < limit.warnAt
        ) {
          const alert: BudgetAlert = {
            id: generateId(),
            timestamp,
            period: limit.period,
            type: 'warning',
            message: `${limit.period} budget at ${(newPercent * 100).toFixed(0)}%: $${newSpent.toFixed(2)} of $${limit.limit.toFixed(2)}`,
            spent: newSpent,
            limit: limit.limit,
          };
          setAlerts((prev) => [...prev, alert]);
          onWarning?.(alert);
        }
      }
    },
    [limits, getPeriodStatus, onWarning, onExceeded, onBlocked]
  );

  // Clear alerts
  const clearAlerts = useCallback(() => {
    setAlerts([]);
  }, []);

  // Reset a specific period
  const resetPeriod = useCallback((period: BudgetPeriod) => {
    setSpending((prev) => {
      const newMap = new Map(prev);
      newMap.delete(period);
      return newMap;
    });
  }, []);

  // Reset all spending
  const resetAll = useCallback(() => {
    setSpending(new Map());
    setAlerts([]);
  }, []);

  // Calculate total spent
  const totalSpent = useMemo(() => {
    let total = 0;
    spending.forEach((records) => {
      total += records.reduce((sum, r) => sum + r.amount, 0);
    });
    return total;
  }, [spending]);

  return {
    canSpend,
    recordSpend,
    getStatus,
    getPeriodStatus,
    alerts,
    clearAlerts,
    resetPeriod,
    resetAll,
    totalSpent,
    checkCost,
  };
}
