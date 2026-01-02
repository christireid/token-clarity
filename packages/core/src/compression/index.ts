/**
 * @module compression
 * Context compression and summarization utilities
 */

export type {
  CompressionResult,
  CompressionOptions,
  SummarizeOptions,
  SummarizeResult,
  ImportanceOptions,
  ScoredMessage,
  ScoredSentence,
} from './types.js';

export { compressExtractive, quickCompress } from './extractive.js';

export {
  selectImportantMessages,
  summarizeHistory,
  slidingWindowContext,
} from './history.js';
