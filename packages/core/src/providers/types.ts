/**
 * @module providers/types
 * Type definitions for provider-specific optimizations
 */

import type { ChatMessage, Provider } from '../types/index.js';

/**
 * Prompt segment for cache optimization
 */
export interface PromptSegment {
  /** Unique identifier for this segment */
  id: string;
  /** Type of content in this segment */
  type: 'system' | 'context' | 'examples' | 'tools' | 'history' | 'user';
  /** The content of the segment */
  content: string;
  /** Whether this segment should be cached */
  cacheable: boolean;
  /** Priority for cache placement */
  priority: 'critical' | 'high' | 'medium' | 'low';
  /** Pre-calculated token count (optional) */
  tokens?: number;
}

/**
 * Cache-optimized prompt structure
 */
export interface CacheOptimizedPrompt {
  /** Ordered segments optimized for caching */
  segments: PromptSegment[];
  /** Converted to standard chat messages */
  messages: ChatMessage[];
  /** Indices where cache can break (for Anthropic) */
  cacheBreakpoints: number[];
  /** Estimated cache hit rate (0-1) */
  estimatedCacheHitRate: number;
  /** Total tokens in cacheable segments */
  cacheableTokens: number;
  /** Total tokens in all segments */
  totalTokens: number;
}

/**
 * Options for cache alignment
 */
export interface CacheAlignmentOptions {
  /** Target AI provider */
  provider: Provider;
  /** Minimum tokens for a segment to be cacheable */
  minCacheableTokens?: number;
  /** Maximum number of cache breakpoints (Anthropic limit: 4) */
  maxCacheBreakpoints?: number;
  /** Whether to merge small adjacent cacheable segments */
  mergeSmallSegments?: boolean;
  /** Token counter function */
  countTokens?: (text: string) => number;
}

/**
 * OpenAI request format
 */
export interface OpenAIRequest {
  model?: string;
  messages: OpenAIMessage[];
  tools?: OpenAITool[];
  max_tokens?: number;
}

/**
 * OpenAI message format
 */
export interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | OpenAIContentPart[];
  name?: string;
  tool_calls?: OpenAIToolCall[];
  tool_call_id?: string;
}

/**
 * OpenAI content part for multimodal messages
 */
export interface OpenAIContentPart {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: { url: string; detail?: string };
}

/**
 * OpenAI tool format
 */
export interface OpenAITool {
  type: 'function';
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
}

/**
 * OpenAI tool call format
 */
export interface OpenAIToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

/**
 * Anthropic request format
 */
export interface AnthropicRequest {
  model?: string;
  messages: AnthropicMessage[];
  system?: string | AnthropicSystemBlock[];
  max_tokens?: number;
  tools?: AnthropicTool[];
}

/**
 * Anthropic message format
 */
export interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string | AnthropicContentBlock[];
}

/**
 * Anthropic content block with optional cache control
 */
export interface AnthropicContentBlock {
  type: 'text' | 'image' | 'tool_use' | 'tool_result';
  text?: string;
  cache_control?: { type: 'ephemeral' };
  source?: { type: string; media_type: string; data: string };
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  tool_use_id?: string;
  content?: string;
}

/**
 * Anthropic system block with cache control
 */
export interface AnthropicSystemBlock {
  type: 'text';
  text: string;
  cache_control?: { type: 'ephemeral' };
}

/**
 * Anthropic tool format
 */
export interface AnthropicTool {
  name: string;
  description?: string;
  input_schema: Record<string, unknown>;
}

/**
 * Google (Gemini) request format
 */
export interface GoogleRequest {
  contents: GoogleContent[];
  systemInstruction?: GoogleContent;
  tools?: GoogleTool[];
  generationConfig?: {
    maxOutputTokens?: number;
    temperature?: number;
  };
}

/**
 * Google content format
 */
export interface GoogleContent {
  role?: 'user' | 'model';
  parts: GooglePart[];
}

/**
 * Google content part
 */
export interface GooglePart {
  text?: string;
  inlineData?: { mimeType: string; data: string };
  functionCall?: { name: string; args: Record<string, unknown> };
  functionResponse?: { name: string; response: Record<string, unknown> };
}

/**
 * Google tool format
 */
export interface GoogleTool {
  functionDeclarations: GoogleFunctionDeclaration[];
}

/**
 * Google function declaration
 */
export interface GoogleFunctionDeclaration {
  name: string;
  description?: string;
  parameters?: Record<string, unknown>;
}

/**
 * Union type for provider requests
 */
export type ProviderRequest = OpenAIRequest | AnthropicRequest | GoogleRequest;

/**
 * Cache analysis result
 */
export interface CacheAnalysis {
  /** Total cacheable tokens */
  cacheableTokens: number;
  /** Total tokens */
  totalTokens: number;
  /** Cache ratio (0-1) */
  cacheRatio: number;
  /** Estimated savings percentage */
  estimatedSavings: number;
  /** Recommendations for improving cache hit rate */
  recommendations: string[];
}
