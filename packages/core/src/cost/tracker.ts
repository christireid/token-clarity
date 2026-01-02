/**
 * @module cost/tracker
 * Usage tracking and analytics
 */

import type { RequestUsage, SessionStats, UsageData, StorageAdapter } from '../types/index.js';
import type { TrackerOptions, UsageTracker, HistoricalStats, DailyStats } from './types.js';

/**
 * Default in-memory storage adapter
 */
function createMemoryStorage(): StorageAdapter {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
  };
}

/**
 * Get storage adapter based on environment
 */
function getDefaultStorage(): StorageAdapter {
  if (typeof localStorage !== 'undefined') {
    return {
      getItem: (key: string) => localStorage.getItem(key),
      setItem: (key: string, value: string) => localStorage.setItem(key, value),
      removeItem: (key: string) => localStorage.removeItem(key),
    };
  }
  return createMemoryStorage();
}

/**
 * Create initial empty usage data
 */
function createEmptyUsageData(): UsageData {
  return {
    requests: [],
    totals: {
      cost: 0,
      inputTokens: 0,
      outputTokens: 0,
      cachedTokens: 0,
      savings: 0,
      requestCount: 0,
    },
  };
}

/**
 * Create a usage tracker for monitoring API costs.
 *
 * @param options - Tracker configuration options
 * @returns Usage tracker instance
 *
 * @example
 * ```ts
 * const tracker = createUsageTracker({
 *   persistKey: 'my-app-usage',
 * });
 *
 * tracker.trackRequest({
 *   model: 'gpt-4o',
 *   inputTokens: 1000,
 *   outputTokens: 500,
 *   cachedTokens: 800,
 *   totalTokens: 1500,
 *   cost: 0.0075,
 *   savedFromCache: 0.002,
 * });
 *
 * console.log(tracker.getSessionStats());
 * ```
 */
export function createUsageTracker(options: TrackerOptions = {}): UsageTracker {
  const { persistKey, storage = getDefaultStorage(), onTrack } = options;

  // Load persisted data
  let data: UsageData = createEmptyUsageData();

  if (persistKey) {
    try {
      const saved = storage.getItem(persistKey);
      if (saved && typeof saved === 'string') {
        data = JSON.parse(saved) as UsageData;
      }
    } catch {
      // Ignore parse errors, use empty data
    }
  }

  // Session start time
  const sessionStart = Date.now();

  /**
   * Persist data to storage
   */
  function persist(): void {
    if (persistKey) {
      try {
        storage.setItem(persistKey, JSON.stringify(data));
      } catch {
        // Ignore storage errors
      }
    }
  }

  /**
   * Recalculate totals from requests
   */
  function recalculateTotals(): void {
    data.totals = data.requests.reduce(
      (totals, req) => ({
        cost: totals.cost + req.cost,
        inputTokens: totals.inputTokens + req.inputTokens,
        outputTokens: totals.outputTokens + req.outputTokens,
        cachedTokens: totals.cachedTokens + (req.cachedTokens ?? 0),
        savings: totals.savings + (req.savedFromCache ?? 0),
        requestCount: totals.requestCount + 1,
      }),
      createEmptyUsageData().totals
    );
  }

  return {
    trackRequest(usage: Omit<RequestUsage, 'timestamp'>): void {
      const request: RequestUsage = {
        ...usage,
        timestamp: Date.now(),
      };

      data.requests.push(request);
      data.totals.cost += usage.cost;
      data.totals.inputTokens += usage.inputTokens;
      data.totals.outputTokens += usage.outputTokens;
      data.totals.cachedTokens += usage.cachedTokens ?? 0;
      data.totals.savings += usage.savedFromCache ?? 0;
      data.totals.requestCount += 1;

      persist();
      onTrack?.(request);
    },

    getSessionStats(): SessionStats {
      // Filter to requests since session start
      const sessionRequests = data.requests.filter(r => r.timestamp >= sessionStart);

      return sessionRequests.reduce(
        (stats, req) => ({
          cost: stats.cost + req.cost,
          inputTokens: stats.inputTokens + req.inputTokens,
          outputTokens: stats.outputTokens + req.outputTokens,
          cachedTokens: stats.cachedTokens + (req.cachedTokens ?? 0),
          savings: stats.savings + (req.savedFromCache ?? 0),
          requestCount: stats.requestCount + 1,
        }),
        createEmptyUsageData().totals
      );
    },

    getHistoricalStats(days = 30): HistoricalStats {
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);
      const startTime = startDate.getTime();

      // Filter requests within time period
      const periodRequests = data.requests.filter(r => r.timestamp >= startTime);

      // Calculate totals
      const totals = periodRequests.reduce(
        (stats, req) => ({
          cost: stats.cost + req.cost,
          inputTokens: stats.inputTokens + req.inputTokens,
          outputTokens: stats.outputTokens + req.outputTokens,
          cachedTokens: stats.cachedTokens + (req.cachedTokens ?? 0),
          savings: stats.savings + (req.savedFromCache ?? 0),
          requestCount: stats.requestCount + 1,
        }),
        createEmptyUsageData().totals
      );

      // Group by day
      const dailyMap = new Map<string, DailyStats>();

      for (const req of periodRequests) {
        const date = new Date(req.timestamp).toISOString().split('T')[0]!;
        const existing = dailyMap.get(date) ?? {
          date,
          cost: 0,
          requests: 0,
          tokens: 0,
        };

        existing.cost += req.cost;
        existing.requests += 1;
        existing.tokens += req.inputTokens + req.outputTokens;
        dailyMap.set(date, existing);
      }

      const dailyStats = Array.from(dailyMap.values()).sort((a, b) =>
        a.date.localeCompare(b.date)
      );

      return {
        ...totals,
        startDate,
        endDate,
        avgCostPerRequest: totals.requestCount > 0 ? totals.cost / totals.requestCount : 0,
        avgTokensPerRequest:
          totals.requestCount > 0
            ? (totals.inputTokens + totals.outputTokens) / totals.requestCount
            : 0,
        dailyStats,
      };
    },

    exportData(): UsageData {
      return JSON.parse(JSON.stringify(data)) as UsageData;
    },

    importData(importedData: UsageData): void {
      // Merge imported data with existing
      data.requests = [...data.requests, ...importedData.requests];
      // Remove duplicates based on timestamp
      const seen = new Set<number>();
      data.requests = data.requests.filter(r => {
        if (seen.has(r.timestamp)) return false;
        seen.add(r.timestamp);
        return true;
      });
      // Sort by timestamp
      data.requests.sort((a, b) => a.timestamp - b.timestamp);
      recalculateTotals();
      persist();
    },

    reset(): void {
      data = createEmptyUsageData();
      persist();
    },
  };
}
