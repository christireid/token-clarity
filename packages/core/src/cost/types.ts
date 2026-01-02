/**
 * @module cost/types
 * Type definitions for cost estimation and tracking
 */

import type { RequestUsage, SessionStats, UsageData, StorageAdapter } from '../types/index.js';

/**
 * Model pricing information in USD
 */
export interface ModelPricing {
  /** Price per 1,000 input tokens */
  inputPer1k: number;
  /** Price per 1,000 output tokens */
  outputPer1k: number;
  /** Discounted price for cached input tokens */
  cachedInputPer1k?: number;
}

/**
 * Cost estimate for a request
 */
export interface CostEstimate {
  /** Cost of input tokens in USD */
  inputCost: number;
  /** Cost of output tokens in USD */
  outputCost: number;
  /** Total cost in USD */
  totalCost: number;
  /** Savings from cache (if applicable) */
  savings?: {
    /** Amount saved from cache in USD */
    fromCache: number;
    /** Savings as a percentage */
    percentage: number;
  };
}

/**
 * Options for usage tracker
 */
export interface TrackerOptions {
  /** Key for persisting usage data */
  persistKey?: string;
  /** Storage adapter (defaults to localStorage if available) */
  storage?: StorageAdapter;
  /** Callback when usage is tracked */
  onTrack?: (usage: RequestUsage) => void;
}

/**
 * Usage tracker interface for monitoring costs
 */
export interface UsageTracker {
  /**
   * Track a new API request
   * @param usage - Usage information from the request
   */
  trackRequest(usage: Omit<RequestUsage, 'timestamp'>): void;

  /**
   * Get statistics for the current session
   * @returns Session statistics
   */
  getSessionStats(): SessionStats;

  /**
   * Get historical statistics for a time period
   * @param days - Number of days to include (default: 30)
   * @returns Historical statistics
   */
  getHistoricalStats(days?: number): HistoricalStats;

  /**
   * Export all tracked usage data
   * @returns Raw usage data
   */
  exportData(): UsageData;

  /**
   * Import usage data
   * @param data - Usage data to import
   */
  importData(data: UsageData): void;

  /**
   * Reset all tracked data
   */
  reset(): void;
}

/**
 * Historical statistics with time period
 */
export interface HistoricalStats extends SessionStats {
  /** Start of the time period */
  startDate: Date;
  /** End of the time period */
  endDate: Date;
  /** Average cost per request */
  avgCostPerRequest: number;
  /** Average tokens per request */
  avgTokensPerRequest: number;
  /** Daily breakdown */
  dailyStats: DailyStats[];
}

/**
 * Statistics for a single day
 */
export interface DailyStats {
  /** Date */
  date: string;
  /** Total cost for the day */
  cost: number;
  /** Total requests for the day */
  requests: number;
  /** Total tokens for the day */
  tokens: number;
}

/**
 * Budget alert configuration
 */
export interface BudgetAlert {
  /** Budget limit in USD */
  limit: number;
  /** Period for the budget (daily, weekly, monthly) */
  period: 'daily' | 'weekly' | 'monthly';
  /** Warning threshold as percentage (0-1) */
  warningThreshold?: number;
  /** Callback when warning threshold is reached */
  onWarning?: (spent: number, limit: number) => void;
  /** Callback when budget is exceeded */
  onExceeded?: (spent: number, limit: number) => void;
}
