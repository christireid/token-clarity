/**
 * @module tokenizers/types
 * Type definitions for tokenizer abstractions
 */

import type { ChatMessage, TokenizerModel } from '../types/index.js';

/**
 * Tokenizer interface for encoding and decoding text
 */
export interface Tokenizer {
  /**
   * Encode text into tokens
   * @param text - The text to encode
   * @returns Array of token IDs
   */
  encode(text: string): number[];

  /**
   * Decode tokens back into text
   * @param tokens - Array of token IDs
   * @returns Decoded text
   */
  decode(tokens: number[]): string;

  /**
   * Count the number of tokens in text
   * @param text - The text to count tokens for
   * @returns Number of tokens
   */
  count(text: string): number;

  /**
   * Count tokens for a chat conversation including message overhead
   * @param messages - Array of chat messages
   * @returns Total token count including overhead
   */
  countChat(messages: ChatMessage[]): number;

  /**
   * Check if text is within a token limit
   * @param text - The text to check
   * @param limit - Maximum token limit
   * @returns True if within limit
   */
  isWithinLimit(text: string, limit: number): boolean;

  /**
   * Truncate text to fit within a token limit
   * @param text - The text to truncate
   * @param limit - Maximum token limit
   * @returns Truncated text
   */
  truncateToLimit(text: string, limit: number): string;

  /**
   * The model this tokenizer is configured for
   */
  model: TokenizerModel | 'estimation';
}

/**
 * Encode function signature
 */
export type EncodeFn = (text: string) => number[];

/**
 * Decode function signature
 */
export type DecodeFn = (tokens: number[]) => string;

/**
 * Options for tokenizer creation
 */
export interface TokenizerOptions {
  /**
   * Whether to cache the tokenizer instance
   * @default true
   */
  cache?: boolean;

  /**
   * Custom message overhead calculator
   */
  messageOverhead?: (message: ChatMessage) => number;
}

/**
 * Chat token overhead configuration per model family
 */
export interface ChatOverheadConfig {
  /** Tokens added per message (role tokens, delimiters) */
  perMessage: number;
  /** Tokens added for the entire conversation */
  conversationOverhead: number;
  /** Additional tokens for messages with names */
  nameOverhead: number;
  /** Additional tokens per tool call */
  toolCallOverhead: number;
}
