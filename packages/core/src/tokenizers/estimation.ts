/**
 * @module tokenizers/estimation
 * Lightweight token estimation without heavy tokenizer dependencies
 */

import type { ChatMessage } from '../types/index.js';
import type { ChatOverheadConfig, Tokenizer } from './types.js';

/**
 * Default chat overhead configuration for GPT-style models
 */
export const DEFAULT_CHAT_OVERHEAD: ChatOverheadConfig = {
  perMessage: 4,
  conversationOverhead: 2,
  nameOverhead: 1,
  toolCallOverhead: 3,
};

/**
 * Estimate token count for text without loading a full tokenizer.
 * Uses heuristics that are approximately 95% accurate for English text.
 *
 * @param text - The text to estimate tokens for
 * @returns Estimated token count
 *
 * @example
 * ```ts
 * const tokens = estimateTokens("Hello, world!");
 * console.log(tokens); // ~3-4
 * ```
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;

  // Split into words
  const words = text.split(/\s+/).filter(w => w.length > 0);
  const wordCount = words.length;

  // Character count
  const charCount = text.length;

  // Count special patterns that affect tokenization
  const codeBlocks = (text.match(/```[\s\S]*?```/g) || []).length;
  const numbers = (text.match(/\d+/g) || []).length;
  const punctuation = (text.match(/[.,!?;:'"()[\]{}]/g) || []).length;
  const urls = (text.match(/https?:\/\/\S+/g) || []).length;
  const whitespace = (text.match(/\s+/g) || []).length;

  // Base estimation: average of word-based and char-based estimates
  // English text averages ~1.3 tokens per word and ~4 chars per token
  const wordBasedEstimate = wordCount * 1.3;
  const charBasedEstimate = charCount / 4;

  // Weighted average favoring character-based for short text, word-based for long
  const baseEstimate =
    charCount < 100
      ? charBasedEstimate
      : (wordBasedEstimate + charBasedEstimate) / 2;

  // Adjustments for special content
  let adjustment = 0;
  adjustment += codeBlocks * 2; // Code blocks tend to have more tokens
  adjustment += numbers * 0.5; // Numbers can be multiple tokens
  adjustment += punctuation * 0.1; // Punctuation usually merges with adjacent tokens
  adjustment += urls * 5; // URLs are heavily tokenized
  adjustment -= whitespace * 0.1; // Whitespace often merges

  return Math.max(1, Math.ceil(baseEstimate + adjustment));
}

/**
 * Estimate token count for chat messages including overhead.
 *
 * @param messages - Array of chat messages
 * @param config - Chat overhead configuration
 * @returns Estimated total token count
 */
export function estimateChatTokens(
  messages: ChatMessage[],
  config: ChatOverheadConfig = DEFAULT_CHAT_OVERHEAD
): number {
  if (messages.length === 0) return 0;

  let total = config.conversationOverhead;

  for (const message of messages) {
    // Message overhead (role tokens, delimiters)
    total += config.perMessage;

    // Role token (system, user, assistant, tool)
    total += 1;

    // Content tokens
    total += estimateTokens(message.content);

    // Name overhead if present
    if (message.name) {
      total += config.nameOverhead + estimateTokens(message.name);
    }

    // Tool calls overhead
    if (message.tool_calls) {
      for (const toolCall of message.tool_calls) {
        total += config.toolCallOverhead;
        total += estimateTokens(toolCall.function.name);
        total += estimateTokens(toolCall.function.arguments);
      }
    }

    // Tool call ID
    if (message.tool_call_id) {
      total += 1;
    }
  }

  return total;
}

/**
 * Create a tokenizer that uses estimation (no external dependencies).
 * Useful for real-time UI updates where exact counts aren't critical.
 *
 * @returns Tokenizer using estimation
 */
export function createEstimationTokenizer(): Tokenizer {
  return {
    model: 'estimation',

    encode(text: string): number[] {
      // Return synthetic token array based on estimation
      const count = estimateTokens(text);
      return Array.from({ length: count }, (_, i) => i);
    },

    decode(_tokens: number[]): string {
      // Cannot decode estimation tokens
      throw new Error(
        'Estimation tokenizer cannot decode tokens. Use a full tokenizer for decoding.'
      );
    },

    count(text: string): number {
      return estimateTokens(text);
    },

    countChat(messages: ChatMessage[]): number {
      return estimateChatTokens(messages);
    },

    isWithinLimit(text: string, limit: number): boolean {
      return estimateTokens(text) <= limit;
    },

    truncateToLimit(text: string, limit: number): string {
      if (estimateTokens(text) <= limit) {
        return text;
      }

      // Binary search for the right length
      let low = 0;
      let high = text.length;

      while (low < high) {
        const mid = Math.floor((low + high + 1) / 2);
        const truncated = text.slice(0, mid);

        if (estimateTokens(truncated) <= limit) {
          low = mid;
        } else {
          high = mid - 1;
        }
      }

      // Find word boundary
      let end = low;
      while (end > 0 && !/\s/.test(text[end - 1] ?? '')) {
        end--;
      }

      return end > 0 ? text.slice(0, end).trimEnd() : text.slice(0, low);
    },
  };
}
