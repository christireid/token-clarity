/**
 * @module adapters/types
 * Type definitions for provider adapters
 */

import type { ChatMessage, Provider } from '../types/index.js';

/**
 * Token usage breakdown
 */
export interface TokenUsage {
  /** Input/prompt tokens */
  input: number;
  /** Output/completion tokens */
  output: number;
  /** Cached input tokens (if applicable) */
  cached?: number;
  /** Total tokens */
  total: number;
}

/**
 * Cost estimate with breakdown
 */
export interface CostEstimate {
  /** Cost for input tokens (USD) */
  inputCost: number;
  /** Cost for output tokens (USD) */
  outputCost: number;
  /** Total cost (USD) */
  totalCost: number;
  /** Savings from cached tokens (USD) */
  cacheSavings?: number;
  /** Model used for estimation */
  model: string;
  /** Provider */
  provider: string;
}

/**
 * Model pricing information
 */
export interface ModelPricing {
  /** Model identifier */
  model: string;
  /** Provider name */
  provider: string;
  /** Cost per 1K input tokens (USD) */
  inputPer1k: number;
  /** Cost per 1K output tokens (USD) */
  outputPer1k: number;
  /** Cost per 1K cached input tokens (USD), if supported */
  cachedInputPer1k?: number;
  /** Context window size in tokens */
  contextWindow: number;
  /** Maximum output tokens */
  maxOutputTokens?: number;
}

/**
 * Provider capabilities
 */
export interface ProviderCapabilities {
  /** Supports prompt caching */
  caching: boolean;
  /** Supported cache TTL options (in minutes) */
  cacheTTL?: number[];
  /** Supports streaming responses */
  streaming: boolean;
  /** Supports tool/function calling */
  tools: boolean;
  /** Supports multi-modal (images, etc.) */
  multiModal: boolean;
  /** Supports extended thinking/reasoning */
  extendedThinking: boolean;
  /** Maximum context tokens by model */
  maxContextTokens: Record<string, number>;
  /** Minimum tokens for caching */
  minCacheTokens?: number;
  /** Maximum cache breakpoints */
  maxCacheBreakpoints?: number;
}

/**
 * Normalized response from any provider
 */
export interface NormalizedResponse {
  /** Response content */
  content: string;
  /** Token usage */
  usage: TokenUsage;
  /** Model used */
  model: string;
  /** Finish reason */
  finishReason: 'stop' | 'length' | 'tool_calls' | 'content_filter' | 'error';
  /** Tool calls if any */
  toolCalls?: Array<{
    id: string;
    name: string;
    arguments: string;
  }>;
  /** Raw provider response */
  raw?: unknown;
}

/**
 * Options for token counting
 */
export interface CountOptions {
  /** Model to use for counting (affects tokenizer) */
  model?: string;
  /** Include message overhead tokens */
  includeOverhead?: boolean;
}

/**
 * Provider-specific message format
 */
export type ProviderMessage =
  | OpenAIMessage
  | AnthropicMessage
  | GoogleMessage
  | BedrockMessage
  | GenericMessage;

/**
 * OpenAI message format
 */
export interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
  name?: string;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
}

/**
 * Anthropic message format
 */
export interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string | Array<{
    type: 'text' | 'image' | 'tool_use' | 'tool_result';
    text?: string;
    cache_control?: { type: 'ephemeral'; ttl?: '5m' | '1h' };
    source?: { type: string; media_type: string; data: string };
    id?: string;
    name?: string;
    input?: unknown;
    tool_use_id?: string;
    content?: string;
  }>;
}

/**
 * Google Gemini message format
 */
export interface GoogleMessage {
  role: 'user' | 'model';
  parts: Array<{
    text?: string;
    inlineData?: { mimeType: string; data: string };
    functionCall?: { name: string; args: Record<string, unknown> };
    functionResponse?: { name: string; response: Record<string, unknown> };
  }>;
}

/**
 * AWS Bedrock message format (Claude via Bedrock)
 */
export interface BedrockMessage {
  role: 'user' | 'assistant';
  content: Array<{
    type: 'text' | 'image' | 'tool_use' | 'tool_result';
    text?: string;
    source?: { type: string; mediaType: string; data: string };
    toolUseId?: string;
    name?: string;
    input?: unknown;
    content?: string;
  }>;
}

/**
 * Generic message format for OpenAI-compatible providers
 */
export interface GenericMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
}

/**
 * Provider adapter interface
 *
 * Provides a unified interface for working with different AI providers.
 * Each provider adapter handles tokenization, cost estimation, and
 * message normalization specific to that provider's API.
 */
export interface ProviderAdapter {
  /** Provider name */
  readonly name: Provider;

  /** Provider capabilities */
  readonly supports: ProviderCapabilities;

  /**
   * Count tokens in a text string
   * @param text - Text to count tokens for
   * @param options - Counting options
   * @returns Token count
   */
  countTokens(text: string, options?: CountOptions): Promise<number>;

  /**
   * Count tokens for an array of chat messages
   * @param messages - Messages to count
   * @param options - Counting options
   * @returns Total token count including message overhead
   */
  countMessages(messages: ChatMessage[], options?: CountOptions): Promise<number>;

  /**
   * Estimate cost for token usage
   * @param usage - Token usage breakdown
   * @param model - Model to estimate for
   * @returns Cost estimate
   */
  estimateCost(usage: TokenUsage, model: string): CostEstimate;

  /**
   * Get pricing information for a model
   * @param model - Model identifier
   * @returns Pricing information or undefined if unknown
   */
  getPricing(model: string): ModelPricing | undefined;

  /**
   * Normalize messages to provider-specific format
   * @param messages - Standard chat messages
   * @returns Provider-formatted messages
   */
  normalizeMessages(messages: ChatMessage[]): ProviderMessage[];

  /**
   * Normalize provider response to standard format
   * @param response - Raw provider response
   * @returns Normalized response
   */
  normalizeResponse(response: unknown): NormalizedResponse;

  /**
   * Get list of supported models
   * @returns Array of model identifiers
   */
  getSupportedModels(): string[];
}

/**
 * Registry of provider adapters
 */
export type AdapterRegistry = Map<Provider, ProviderAdapter>;

/**
 * Extended provider type including new providers
 */
export type ExtendedProvider = Provider | 'azure' | 'bedrock' | 'mistral' | 'cohere' | 'groq' | 'openai-compatible';
