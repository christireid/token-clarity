/**
 * @module policy/types
 * Type definitions for token policy functions
 */

import type { ChatMessage } from '../types/index.js';

/**
 * Message priority levels
 */
export type MessagePriority = 'required' | 'high' | 'medium' | 'low' | 'optional';

/**
 * Message with priority metadata
 */
export interface PrioritizedMessage extends ChatMessage {
  priority?: MessagePriority;
  /** Custom weight override (0-1, higher = more important) */
  weight?: number;
  /** Whether this message must be preserved */
  pinned?: boolean;
  /** Tags for filtering/grouping */
  tags?: string[];
}

/**
 * Token budget for policy functions
 */
export interface TokenBudget {
  /** Maximum tokens allowed */
  maxTokens: number;
  /** Tokens to reserve for output */
  reserveForOutput?: number;
  /** Current token count (optional, for tracking) */
  currentTokens?: number;
}

/**
 * Result of a trim operation
 */
export interface TrimResult<T = ChatMessage> {
  /** Messages after trimming */
  messages: T[];
  /** Messages that were removed */
  removed: T[];
  /** Tokens before trimming */
  tokensBefore: number;
  /** Tokens after trimming */
  tokensAfter: number;
  /** Tokens saved by trimming */
  tokensSaved: number;
  /** Whether the result fits within budget */
  fitsWithinBudget: boolean;
}

/**
 * Options for trimming by priority
 */
export interface TrimByPriorityOptions {
  /** Remove messages in this priority order (first to remove first) */
  priorityOrder?: MessagePriority[];
  /** Preserve pinned messages even if over budget */
  preservePinned?: boolean;
  /** Preserve system messages */
  preserveSystem?: boolean;
  /** Preserve the last N messages */
  preserveRecent?: number;
  /** Preserve the first N messages (after system) */
  preserveFirst?: number;
}

/**
 * Summarizer function type
 */
export type Summarizer = (messages: ChatMessage[]) => Promise<string>;

/**
 * Options for summarize and trim
 */
export interface SummarizeAndTrimOptions {
  /** Summarizer function */
  summarizer: Summarizer;
  /** Role for the summary message */
  summaryRole?: 'system' | 'assistant';
  /** Prefix for the summary */
  summaryPrefix?: string;
  /** Preserve last N messages without summarizing */
  preserveRecent?: number;
  /** Maximum tokens for the summary */
  maxSummaryTokens?: number;
}

/**
 * Template variable for stable prefix
 */
export interface TemplateVariable {
  name: string;
  value: string;
  /** If true, changes to this value won't break cache */
  ephemeral?: boolean;
}

/**
 * Options for stable prefix generation
 */
export interface StablePrefixOptions {
  /** Variables to substitute in template */
  variables?: Record<string, string>;
  /** Provider for cache optimization */
  provider?: 'openai' | 'anthropic' | 'google';
  /** Minimum tokens for caching (provider-specific) */
  minCacheTokens?: number;
}

/**
 * Result of stable prefix generation
 */
export interface StablePrefixResult {
  /** The stable prefix text */
  prefix: string;
  /** Estimated tokens in prefix */
  tokens: number;
  /** Whether this meets minimum cache requirements */
  meetsCacheMinimum: boolean;
  /** Cache-aligned boundary suggestions */
  suggestedBreakpoints?: number[];
}

/**
 * Options for context window packing
 */
export interface PackOptions {
  /** Maximum tokens for the context */
  maxTokens: number;
  /** Reserve tokens for output */
  reserveForOutput?: number;
  /** Strategy for packing */
  strategy?: 'priority' | 'recency' | 'mixed';
  /** Include system messages first */
  systemFirst?: boolean;
}

/**
 * Result of context packing
 */
export interface PackResult<T = ChatMessage> {
  /** Packed messages */
  messages: T[];
  /** Messages that didn't fit */
  overflow: T[];
  /** Token utilization (0-1) */
  utilization: number;
  /** Tokens used */
  tokensUsed: number;
  /** Tokens remaining */
  tokensRemaining: number;
}

/**
 * Message segment for cache-aware processing
 */
export interface MessageSegment {
  /** Messages in this segment */
  messages: ChatMessage[];
  /** Token count for segment */
  tokens: number;
  /** Whether this segment should be cached */
  cacheable: boolean;
  /** Segment type */
  type: 'system' | 'static' | 'dynamic';
}

/**
 * Policy configuration for automatic management
 */
export interface PolicyConfig {
  /** Maximum input tokens */
  maxInputTokens: number;
  /** Reserve for output */
  outputReserve?: number;
  /** Auto-trim strategy */
  trimStrategy?: 'oldest' | 'priority' | 'summarize';
  /** Priority order for trimming */
  priorityOrder?: MessagePriority[];
  /** Summarizer for summarize strategy */
  summarizer?: Summarizer;
  /** Cache optimization settings */
  cacheOptimization?: {
    enabled: boolean;
    provider?: 'openai' | 'anthropic' | 'google';
    minTokens?: number;
  };
}

/**
 * Context optimization result
 */
export interface OptimizationResult<T = ChatMessage> {
  /** Optimized messages */
  messages: T[];
  /** Original token count */
  originalTokens: number;
  /** Final token count */
  finalTokens: number;
  /** Tokens saved */
  tokensSaved: number;
  /** Actions taken */
  actions: Array<{
    type: 'trim' | 'summarize' | 'compress' | 'cache_align';
    description: string;
    tokensSaved: number;
  }>;
}
