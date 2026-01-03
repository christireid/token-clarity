/**
 * @module policy
 * Token policy functions for context management
 *
 * Pure functions for shaping, trimming, and optimizing context windows.
 * All functions are side-effect free and composable.
 *
 * @example
 * ```ts
 * import {
 *   trimOldestFirst,
 *   trimByPriority,
 *   stablePrefix,
 *   packContext,
 * } from '@token-optimizer/core/policy';
 *
 * // Trim old messages when over budget
 * const trimmed = trimOldestFirst(messages, { maxTokens: 4000 });
 *
 * // Priority-based trimming
 * const priorityTrimmed = trimByPriority(
 *   messagesWithPriority,
 *   { maxTokens: 4000 },
 *   { preserveRecent: 2 }
 * );
 *
 * // Create cache-optimized prefix
 * const prefix = stablePrefix(template, {
 *   variables: { date: '2024-01-15' },
 *   provider: 'anthropic',
 * });
 * ```
 */

// Types
export type {
  MessagePriority,
  PrioritizedMessage,
  TokenBudget,
  TrimResult,
  TrimByPriorityOptions,
  Summarizer,
  SummarizeAndTrimOptions,
  TemplateVariable,
  StablePrefixOptions,
  StablePrefixResult,
  PackOptions,
  PackResult,
  MessageSegment,
  PolicyConfig,
  OptimizationResult,
} from './types.js';

// Trim functions
export {
  trimOldestFirst,
  trimByPriority,
  trimPreservingPairs,
  smartTrim,
  estimateTrimTokens,
} from './trim.js';

// Prefix functions
export {
  stablePrefix,
  multiSectionPrefix,
  padToMinimum,
  analyzePrefix,
} from './prefix.js';

// Summarize functions
export {
  extractiveSummarizer,
  summarizeAndTrim,
  createSummarizer,
  slidingWindowWithSummary,
  incrementalSummarize,
  extractKeyInfo,
  compressMessages,
} from './summarize.js';

// Pack functions
export {
  packContext,
  segmentMessages,
  mergeSegments,
  distributeAcrossTurns,
  interleaveByPriority,
  calculateUtilization,
} from './pack.js';

// Re-export compression utilities
export { compressExtractive, quickCompress } from '../compression/extractive.js';

/**
 * TokenPolicy namespace for organized access to all policy functions
 */
export const TokenPolicy = {
  // Trimming
  trimOldestFirst: async (messages: Parameters<typeof import('./trim.js').trimOldestFirst>[0], budget: Parameters<typeof import('./trim.js').trimOldestFirst>[1]) => {
    const { trimOldestFirst } = await import('./trim.js');
    return trimOldestFirst(messages, budget);
  },
  trimByPriority: async (messages: Parameters<typeof import('./trim.js').trimByPriority>[0], budget: Parameters<typeof import('./trim.js').trimByPriority>[1], options?: Parameters<typeof import('./trim.js').trimByPriority>[2]) => {
    const { trimByPriority } = await import('./trim.js');
    return trimByPriority(messages, budget, options);
  },
  smartTrim: async (messages: Parameters<typeof import('./trim.js').smartTrim>[0], budget: Parameters<typeof import('./trim.js').smartTrim>[1]) => {
    const { smartTrim } = await import('./trim.js');
    return smartTrim(messages, budget);
  },

  // Prefixes
  stablePrefix: async (template: Parameters<typeof import('./prefix.js').stablePrefix>[0], options?: Parameters<typeof import('./prefix.js').stablePrefix>[1]) => {
    const { stablePrefix } = await import('./prefix.js');
    return stablePrefix(template, options);
  },

  // Summarization
  summarizeAndTrim: async (messages: Parameters<typeof import('./summarize.js').summarizeAndTrim>[0], budget: Parameters<typeof import('./summarize.js').summarizeAndTrim>[1], options: Parameters<typeof import('./summarize.js').summarizeAndTrim>[2]) => {
    const { summarizeAndTrim } = await import('./summarize.js');
    return summarizeAndTrim(messages, budget, options);
  },

  // Packing
  packContext: async (messages: Parameters<typeof import('./pack.js').packContext>[0], options: Parameters<typeof import('./pack.js').packContext>[1]) => {
    const { packContext } = await import('./pack.js');
    return packContext(messages, options);
  },

  // Compression
  compressExtractive: async (text: Parameters<typeof import('../compression/extractive.js').compressExtractive>[0], options?: Parameters<typeof import('../compression/extractive.js').compressExtractive>[1]) => {
    const { compressExtractive } = await import('../compression/extractive.js');
    return compressExtractive(text, options);
  },
};
