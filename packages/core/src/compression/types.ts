/**
 * @module compression/types
 * Type definitions for context compression
 */

import type { ChatMessage } from '../types/index.js';

/**
 * Result of compressing text
 */
export interface CompressionResult {
  /** Original text */
  original: string;
  /** Compressed text */
  compressed: string;
  /** Token count of original */
  originalTokens: number;
  /** Token count of compressed */
  compressedTokens: number;
  /** Compression ratio (0-1, lower is more compressed) */
  compressionRatio: number;
}

/**
 * Options for text compression
 */
export interface CompressionOptions {
  /** Target compression ratio (0-1, e.g., 0.5 for 50% of original size) */
  targetRatio?: number;
  /** Preserve document structure (headings, lists, etc.) */
  preserveStructure?: boolean;
  /** Preserve named entities (people, places, organizations) */
  preserveEntities?: boolean;
  /** Preserve numbers and statistics */
  preserveNumbers?: boolean;
  /** Minimum sentence importance score to include (0-1) */
  minImportance?: number;
}

/**
 * Options for history summarization
 */
export interface SummarizeOptions {
  /** Maximum tokens for the summary */
  maxTokens: number;
  /** Number of recent messages to preserve verbatim */
  preserveRecent?: number;
  /** Whether to preserve system messages */
  preserveSystem?: boolean;
  /** Summary style */
  style?: 'brief' | 'detailed' | 'bullet-points';
}

/**
 * Result of summarizing conversation history
 */
export interface SummarizeResult {
  /** Generated summary */
  summary: string;
  /** Recent messages preserved verbatim */
  recentMessages: ChatMessage[];
  /** Total tokens in result */
  totalTokens: number;
  /** Number of messages summarized */
  summarizedCount: number;
  /** Original message count */
  originalCount: number;
}

/**
 * Options for importance-based message selection
 */
export interface ImportanceOptions {
  /** Weight for message recency (0-1) */
  recencyWeight?: number;
  /** Weight for questions (0-1) */
  questionWeight?: number;
  /** Weight for named entities (0-1) */
  entityWeight?: number;
  /** Weight for code blocks (0-1) */
  codeWeight?: number;
  /** Weight for long messages (0-1) */
  lengthWeight?: number;
}

/**
 * Message with calculated importance score
 */
export interface ScoredMessage {
  /** Original message */
  message: ChatMessage;
  /** Calculated importance score (0-1) */
  score: number;
  /** Token count */
  tokens: number;
  /** Original index in conversation */
  index: number;
}

/**
 * Sentence with score for extractive compression
 */
export interface ScoredSentence {
  /** Sentence text */
  text: string;
  /** Importance score */
  score: number;
  /** Original position in text */
  position: number;
}
