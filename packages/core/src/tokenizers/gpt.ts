/**
 * @module tokenizers/gpt
 * GPT tokenizer implementation using gpt-tokenizer
 */

import type { ChatMessage, TokenizerModel } from '../types/index.js';
import type { ChatOverheadConfig, DecodeFn, EncodeFn, Tokenizer } from './types.js';
import { DEFAULT_CHAT_OVERHEAD, estimateTokens } from './estimation.js';

/**
 * Chat overhead configurations for different OpenAI models
 */
const GPT_CHAT_OVERHEAD: Record<string, ChatOverheadConfig> = {
  'gpt-4o': {
    perMessage: 3,
    conversationOverhead: 3,
    nameOverhead: 1,
    toolCallOverhead: 3,
  },
  'gpt-4': {
    perMessage: 3,
    conversationOverhead: 3,
    nameOverhead: 1,
    toolCallOverhead: 3,
  },
  'gpt-3.5-turbo': {
    perMessage: 4,
    conversationOverhead: 2,
    nameOverhead: -1, // Names reduce overhead in older models
    toolCallOverhead: 3,
  },
};

/**
 * Create a GPT tokenizer wrapper around gpt-tokenizer functions.
 *
 * @param encode - Encode function from gpt-tokenizer
 * @param decode - Decode function from gpt-tokenizer
 * @param model - Model identifier
 * @returns Tokenizer instance
 */
export function createGPTTokenizer(
  encode: EncodeFn,
  decode: DecodeFn,
  model: TokenizerModel
): Tokenizer {
  const overheadConfig = GPT_CHAT_OVERHEAD[model] ?? DEFAULT_CHAT_OVERHEAD;

  return {
    model,

    encode(text: string): number[] {
      if (!text) return [];
      return encode(text);
    },

    decode(tokens: number[]): string {
      if (!tokens.length) return '';
      return decode(tokens);
    },

    count(text: string): number {
      if (!text) return 0;
      return encode(text).length;
    },

    countChat(messages: ChatMessage[]): number {
      if (messages.length === 0) return 0;

      let total = overheadConfig.conversationOverhead;

      for (const message of messages) {
        total += overheadConfig.perMessage;
        total += encode(message.role).length;
        total += encode(message.content).length;

        if (message.name) {
          total += overheadConfig.nameOverhead;
          total += encode(message.name).length;
        }

        if (message.tool_calls) {
          for (const toolCall of message.tool_calls) {
            total += overheadConfig.toolCallOverhead;
            total += encode(toolCall.function.name).length;
            total += encode(toolCall.function.arguments).length;
          }
        }

        if (message.tool_call_id) {
          total += encode(message.tool_call_id).length;
        }
      }

      return total;
    },

    isWithinLimit(text: string, limit: number): boolean {
      return this.count(text) <= limit;
    },

    truncateToLimit(text: string, limit: number): string {
      const tokens = encode(text);
      if (tokens.length <= limit) {
        return text;
      }

      // Truncate tokens and decode
      const truncatedTokens = tokens.slice(0, limit);
      let result = decode(truncatedTokens);

      // Clean up any partial unicode characters
      result = result.replace(/[\uFFFD]$/, '');

      return result;
    },
  };
}

/**
 * Dynamically load the appropriate GPT tokenizer for a model.
 *
 * @param model - The model to load tokenizer for
 * @returns Promise resolving to tokenizer functions
 */
export async function loadGPTTokenizer(model: TokenizerModel): Promise<{
  encode: EncodeFn;
  decode: DecodeFn;
}> {
  // Map models to their tokenizer modules
  const modelToModule: Record<string, string> = {
    'gpt-4o': 'gpt-tokenizer/model/gpt-4o',
    'gpt-4o-mini': 'gpt-tokenizer/model/gpt-4o',
    'gpt-4-turbo': 'gpt-tokenizer/model/gpt-4',
    'gpt-4': 'gpt-tokenizer/model/gpt-4',
    'gpt-3.5-turbo': 'gpt-tokenizer/model/gpt-3.5-turbo',
    'o1': 'gpt-tokenizer/model/gpt-4o',
    'o1-mini': 'gpt-tokenizer/model/gpt-4o',
    // Claude models use cl100k_base (similar to GPT-4)
    'claude-3-opus': 'gpt-tokenizer/model/gpt-4',
    'claude-3-5-sonnet': 'gpt-tokenizer/model/gpt-4',
    'claude-3-sonnet': 'gpt-tokenizer/model/gpt-4',
    'claude-3-haiku': 'gpt-tokenizer/model/gpt-4',
  };

  const moduleName = modelToModule[model];

  if (!moduleName) {
    throw new Error(
      `No GPT tokenizer available for model: ${model}. Use estimation tokenizer instead.`
    );
  }

  try {
    // Dynamic import for tree-shaking
    const tokenizer = await import(/* webpackIgnore: true */ moduleName);
    return {
      encode: tokenizer.encode as EncodeFn,
      decode: tokenizer.decode as DecodeFn,
    };
  } catch (error) {
    // If gpt-tokenizer is not installed, provide helpful error
    throw new Error(
      `Failed to load tokenizer for ${model}. Ensure 'gpt-tokenizer' is installed: pnpm add gpt-tokenizer\n` +
        `Original error: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Create a fallback tokenizer that uses estimation when exact tokenization fails.
 *
 * @param model - Model identifier
 * @returns Tokenizer that falls back to estimation
 */
export function createFallbackTokenizer(model: TokenizerModel): Tokenizer {
  return {
    model,

    encode(text: string): number[] {
      const count = estimateTokens(text);
      return Array.from({ length: count }, (_, i) => i);
    },

    decode(_tokens: number[]): string {
      throw new Error('Fallback tokenizer cannot decode tokens');
    },

    count(text: string): number {
      return estimateTokens(text);
    },

    countChat(messages: ChatMessage[]): number {
      const overhead = GPT_CHAT_OVERHEAD[model] ?? DEFAULT_CHAT_OVERHEAD;
      let total = overhead.conversationOverhead;

      for (const message of messages) {
        total += overhead.perMessage;
        total += 1; // role token
        total += estimateTokens(message.content);

        if (message.name) {
          total += overhead.nameOverhead + estimateTokens(message.name);
        }

        if (message.tool_calls) {
          for (const toolCall of message.tool_calls) {
            total += overhead.toolCallOverhead;
            total += estimateTokens(toolCall.function.name);
            total += estimateTokens(toolCall.function.arguments);
          }
        }
      }

      return total;
    },

    isWithinLimit(text: string, limit: number): boolean {
      return this.count(text) <= limit;
    },

    truncateToLimit(text: string, limit: number): string {
      if (this.count(text) <= limit) return text;

      // Binary search for truncation point
      let low = 0;
      let high = text.length;

      while (low < high) {
        const mid = Math.floor((low + high + 1) / 2);
        if (estimateTokens(text.slice(0, mid)) <= limit) {
          low = mid;
        } else {
          high = mid - 1;
        }
      }

      return text.slice(0, low).trimEnd();
    },
  };
}
