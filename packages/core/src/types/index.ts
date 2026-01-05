/**
 * @module types
 * Shared TypeScript types for the token optimizer library
 */

/**
 * Represents a chat message in the conversation
 */
export interface ChatMessage {
  /** The role of the message sender */
  role: 'system' | 'user' | 'assistant' | 'tool';
  /** The content of the message */
  content: string;
  /** Optional name for the message sender */
  name?: string;
  /** Tool calls made by the assistant */
  tool_calls?: ToolCall[];
  /** ID of the tool call this message is responding to */
  tool_call_id?: string;
}

/**
 * Represents a tool call made by the assistant
 */
export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

/**
 * Tool definition for function calling
 */
export interface Tool {
  type: 'function';
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
}

/**
 * Supported AI model identifiers
 */
export type TokenizerModel =
  // OpenAI models
  | 'gpt-4o'
  | 'gpt-4o-mini'
  | 'gpt-4-turbo'
  | 'gpt-4'
  | 'gpt-3.5-turbo'
  | 'o1'
  | 'o1-mini'
  // Anthropic models
  | 'claude-3-opus'
  | 'claude-3-5-sonnet'
  | 'claude-3-sonnet'
  | 'claude-3-haiku'
  // Google models
  | 'gemini-pro'
  | 'gemini-ultra'
  | 'gemini-1.5-pro'
  | 'gemini-1.5-flash'
  // Open source models
  | 'llama-3'
  | 'llama-3.1'
  | 'mistral'
  | 'mixtral';

/**
 * Supported AI providers
 */
export type Provider = 'openai' | 'anthropic' | 'google';

/**
 * Token usage information from an API response
 */
export interface TokenUsage {
  /** Number of input/prompt tokens */
  inputTokens: number;
  /** Number of output/completion tokens */
  outputTokens: number;
  /** Number of tokens served from cache (if available) */
  cachedTokens?: number;
  /** Total tokens used */
  totalTokens: number;
}

/**
 * Request usage tracking data
 */
export interface RequestUsage extends TokenUsage {
  /** Model used for the request */
  model: string;
  /** Estimated cost of the request in USD */
  cost: number;
  /** Amount saved from cache hits in USD */
  savedFromCache?: number;
  /** Timestamp of the request */
  timestamp: number;
}

/**
 * Session statistics for usage tracking
 */
export interface SessionStats {
  /** Total cost in USD */
  cost: number;
  /** Total input tokens used */
  inputTokens: number;
  /** Total output tokens used */
  outputTokens: number;
  /** Total tokens served from cache */
  cachedTokens: number;
  /** Total savings from cache in USD */
  savings: number;
  /** Number of requests made */
  requestCount: number;
}

/**
 * Historical usage statistics
 */
export interface HistoricalStats extends SessionStats {
  /** Start date of the period */
  startDate: Date;
  /** End date of the period */
  endDate: Date;
  /** Average cost per request */
  avgCostPerRequest: number;
  /** Average tokens per request */
  avgTokensPerRequest: number;
}

/**
 * Stored usage data structure
 */
export interface UsageData {
  /** List of all requests */
  requests: RequestUsage[];
  /** Aggregated totals */
  totals: SessionStats;
}

/**
 * Generic storage interface for persistence
 */
export interface StorageAdapter {
  getItem(key: string): string | null | Promise<string | null>;
  setItem(key: string, value: string): void | Promise<void>;
  removeItem(key: string): void | Promise<void>;
}

/**
 * Unified model pricing information in USD.
 * This is the canonical source for model pricing across the library.
 */
export interface ModelPricing {
  /** Price per 1,000 input tokens */
  inputPer1k: number;
  /** Price per 1,000 output tokens */
  outputPer1k: number;
  /** Discounted price for cached input tokens (if supported) */
  cachedInputPer1k?: number;
  /** Context window size in tokens */
  contextWindow?: number;
  /** Maximum output tokens */
  maxOutputTokens?: number;
  /** Model identifier */
  model?: string;
  /** Provider name */
  provider?: string;
}

/**
 * Unified cost estimate for a request.
 * This is the canonical source for cost estimates across the library.
 */
export interface CostEstimate {
  /** Cost of input tokens in USD */
  inputCost: number;
  /** Cost of output tokens in USD */
  outputCost: number;
  /** Total cost in USD */
  totalCost: number;
  /** Savings from cache (structured format) */
  savings?: {
    /** Amount saved from cache in USD */
    fromCache: number;
    /** Savings as a percentage */
    percentage: number;
  };
  /**
   * Savings from cached tokens in USD (flat format).
   * @deprecated Use `savings.fromCache` instead
   */
  cacheSavings?: number;
  /** Model used for estimation */
  model?: string;
  /** Provider */
  provider?: string;
}
