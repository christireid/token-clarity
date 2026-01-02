/**
 * @module budget/types
 * Type definitions for token budget management
 */

import type { ChatMessage } from '../types/index.js';

/**
 * Token budget configuration
 */
export interface TokenBudget {
  /** Maximum input/prompt tokens allowed */
  maxInputTokens: number;
  /** Maximum output/completion tokens allowed */
  maxOutputTokens: number;
  /** Maximum total tokens (input + output). If not set, uses sum of maxInput and maxOutput */
  maxTotalTokens?: number;
  /** Utilization threshold for warning status (0-1) */
  warningThreshold?: number;
  /** Utilization threshold for critical status (0-1) */
  criticalThreshold?: number;
}

/**
 * Budget status levels
 */
export type BudgetStatusLevel = 'ok' | 'warning' | 'critical' | 'exceeded';

/**
 * Current budget status information
 */
export interface BudgetStatus {
  /** Current input tokens used */
  inputTokens: number;
  /** Current output tokens (estimated or actual) */
  outputTokens: number;
  /** Total tokens (input + output) */
  totalTokens: number;
  /** Input token utilization (0-1) */
  inputUtilization: number;
  /** Output token utilization (0-1) */
  outputUtilization: number;
  /** Total token utilization (0-1) */
  totalUtilization: number;
  /** Overall status level */
  status: BudgetStatusLevel;
  /** Remaining tokens available */
  remaining: {
    /** Remaining input tokens */
    input: number;
    /** Remaining output tokens */
    output: number;
    /** Remaining total tokens */
    total: number;
  };
}

/**
 * Result of trimming messages to fit budget
 */
export interface TrimResult {
  /** Messages that fit within budget */
  messages: ChatMessage[];
  /** Messages that were removed */
  removed: ChatMessage[];
  /** Updated budget status */
  status: BudgetStatus;
  /** Number of tokens saved by trimming */
  tokensSaved: number;
}

/**
 * Options for trimming messages
 */
export interface TrimOptions {
  /** Reserve tokens for expected output */
  reserveForOutput?: number;
  /** Always preserve system messages */
  preserveSystem?: boolean;
  /** Minimum number of recent messages to keep */
  minRecentMessages?: number;
  /** Strategy for selecting messages to remove */
  strategy?: 'oldest-first' | 'least-important' | 'summarize';
}

/**
 * Budget manager interface
 */
export interface BudgetManager {
  /** Current budget configuration */
  readonly budget: TokenBudget;

  /**
   * Check if content fits within budget
   * @param inputTokens - Number of input tokens
   * @param estimatedOutput - Estimated output tokens
   * @returns Current budget status
   */
  checkBudget(inputTokens: number, estimatedOutput?: number): BudgetStatus;

  /**
   * Validate that messages array fits within budget
   * @param messages - Messages to validate
   * @returns Budget status for the messages
   */
  validateMessages(messages: ChatMessage[]): BudgetStatus;

  /**
   * Trim messages to fit within budget
   * @param messages - Messages to trim
   * @param options - Trim options
   * @returns Trim result with kept and removed messages
   */
  trimToFit(messages: ChatMessage[], options?: TrimOptions): TrimResult;

  /**
   * Calculate optimal max_tokens for response based on current input
   * @param inputTokens - Number of input tokens
   * @param taskType - Type of task (affects output length)
   * @returns Recommended max_tokens value
   */
  calculateMaxOutputTokens(
    inputTokens: number,
    taskType?: 'chat' | 'code' | 'summary' | 'analysis'
  ): number;

  /**
   * Update budget configuration
   * @param budget - Partial budget updates
   */
  updateBudget(budget: Partial<TokenBudget>): void;
}
