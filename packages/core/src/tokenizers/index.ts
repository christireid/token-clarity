/**
 * @module tokenizers
 * Token counting abstractions with lazy loading support
 */

import type { ChatMessage, TokenizerModel } from '../types/index.js';
import type { Tokenizer, TokenizerOptions } from './types.js';
import { createEstimationTokenizer, estimateTokens, estimateChatTokens } from './estimation.js';
import { createGPTTokenizer, loadGPTTokenizer, createFallbackTokenizer } from './gpt.js';

export type {
  Tokenizer,
  TokenizerOptions,
  EncodeFn,
  DecodeFn,
  ChatOverheadConfig,
} from './types.js';

export {
  estimateTokens,
  estimateChatTokens,
  createEstimationTokenizer,
  DEFAULT_CHAT_OVERHEAD,
} from './estimation.js';

export { createGPTTokenizer, createFallbackTokenizer } from './gpt.js';

/**
 * Cache for tokenizer instances to avoid repeated loading
 */
const tokenizerCache = new Map<TokenizerModel, Tokenizer>();

/**
 * Models that support GPT tokenizer loading
 */
const GPT_COMPATIBLE_MODELS: TokenizerModel[] = [
  'gpt-4o',
  'gpt-4o-mini',
  'gpt-4-turbo',
  'gpt-4',
  'gpt-3.5-turbo',
  'o1',
  'o1-mini',
  'claude-3-opus',
  'claude-3-5-sonnet',
  'claude-3-sonnet',
  'claude-3-haiku',
];

/**
 * Check if a model supports GPT tokenizer
 */
function isGPTCompatible(model: TokenizerModel): boolean {
  return GPT_COMPATIBLE_MODELS.includes(model);
}

/**
 * Create a tokenizer for the specified model.
 * Lazy loads the appropriate tokenizer implementation.
 *
 * @param model - The model to create a tokenizer for
 * @param options - Tokenizer options
 * @returns Promise resolving to a Tokenizer instance
 *
 * @example
 * ```ts
 * const tokenizer = await createTokenizer('gpt-4o');
 * const count = tokenizer.count('Hello, world!');
 * console.log(count); // 4
 * ```
 */
export async function createTokenizer(
  model: TokenizerModel,
  options: TokenizerOptions = {}
): Promise<Tokenizer> {
  const { cache = true } = options;

  // Check cache first
  if (cache && tokenizerCache.has(model)) {
    return tokenizerCache.get(model)!;
  }

  let tokenizer: Tokenizer;

  if (isGPTCompatible(model)) {
    try {
      const { encode, decode } = await loadGPTTokenizer(model);
      tokenizer = createGPTTokenizer(encode, decode, model);
    } catch {
      // Fall back to estimation if loading fails
      console.warn(
        `Failed to load tokenizer for ${model}, falling back to estimation`
      );
      tokenizer = createFallbackTokenizer(model);
    }
  } else {
    // Use estimation for models without dedicated tokenizers
    tokenizer = createFallbackTokenizer(model);
  }

  // Cache the tokenizer
  if (cache) {
    tokenizerCache.set(model, tokenizer);
  }

  return tokenizer;
}

/**
 * Clear the tokenizer cache.
 * Useful for testing or memory management.
 */
export function clearTokenizerCache(): void {
  tokenizerCache.clear();
}

/**
 * Get a synchronous tokenizer using estimation.
 * Use this when you need immediate results without async loading.
 *
 * @param model - Optional model for configuration (affects chat overhead)
 * @returns Tokenizer using estimation
 *
 * @example
 * ```ts
 * const tokenizer = getEstimationTokenizer();
 * const count = tokenizer.count('Hello, world!');
 * ```
 */
export function getEstimationTokenizer(): Tokenizer {
  return createEstimationTokenizer();
}

/**
 * Calculate the token overhead for chat messages.
 * Includes role tokens, delimiters, and special tokens.
 *
 * @param messages - Array of chat messages
 * @param model - Model to calculate overhead for
 * @returns Overhead token count
 */
export function calculateChatOverhead(
  messages: ChatMessage[],
  _model: TokenizerModel
): number {
  // Base overhead that's added beyond content tokens
  const contentTokens = messages.reduce(
    (sum, m) => sum + estimateTokens(m.content),
    0
  );
  const totalTokens = estimateChatTokens(messages);
  return totalTokens - contentTokens;
}

/**
 * Utility to check if text is within a token limit using estimation.
 * Faster than loading a full tokenizer for simple checks.
 *
 * @param text - Text to check
 * @param limit - Token limit
 * @returns True if within limit
 */
export function isWithinTokenLimit(text: string, limit: number): boolean {
  return estimateTokens(text) <= limit;
}

/**
 * Get the recommended tokenizer model for a given model string.
 * Normalizes model names to supported tokenizer models.
 *
 * @param model - Model name (can include version suffixes)
 * @returns Normalized TokenizerModel
 */
export function normalizeModelName(model: string): TokenizerModel {
  const normalized = model.toLowerCase();

  // OpenAI models
  if (normalized.includes('gpt-4o-mini')) return 'gpt-4o-mini';
  if (normalized.includes('gpt-4o')) return 'gpt-4o';
  if (normalized.includes('gpt-4-turbo')) return 'gpt-4-turbo';
  if (normalized.includes('gpt-4')) return 'gpt-4';
  if (normalized.includes('gpt-3.5')) return 'gpt-3.5-turbo';
  if (normalized.includes('o1-mini')) return 'o1-mini';
  if (normalized.includes('o1')) return 'o1';

  // Anthropic models
  if (normalized.includes('claude-3-opus')) return 'claude-3-opus';
  if (normalized.includes('claude-3-5-sonnet') || normalized.includes('claude-3.5-sonnet')) {
    return 'claude-3-5-sonnet';
  }
  if (normalized.includes('claude-3-sonnet')) return 'claude-3-sonnet';
  if (normalized.includes('claude-3-haiku')) return 'claude-3-haiku';

  // Google models
  if (normalized.includes('gemini-1.5-pro')) return 'gemini-1.5-pro';
  if (normalized.includes('gemini-1.5-flash')) return 'gemini-1.5-flash';
  if (normalized.includes('gemini-pro')) return 'gemini-pro';
  if (normalized.includes('gemini-ultra')) return 'gemini-ultra';

  // Open source models
  if (normalized.includes('llama-3.1') || normalized.includes('llama3.1')) return 'llama-3.1';
  if (normalized.includes('llama-3') || normalized.includes('llama3')) return 'llama-3';
  if (normalized.includes('mixtral')) return 'mixtral';
  if (normalized.includes('mistral')) return 'mistral';

  // Default to GPT-4 for unknown models
  return 'gpt-4';
}
