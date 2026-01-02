/**
 * @module providers
 * Provider-specific cache optimization utilities
 */

export type {
  PromptSegment,
  CacheOptimizedPrompt,
  CacheAlignmentOptions,
  CacheAnalysis,
  OpenAIRequest,
  OpenAIMessage,
  AnthropicRequest,
  AnthropicMessage,
  GoogleRequest,
  GoogleContent,
  ProviderRequest,
} from './types.js';

export {
  createSystemSegment,
  createContextSegment,
  createExamplesSegment,
  createToolsSegment,
  createHistorySegment,
  createUserSegment,
  createCustomSegment,
  mergeSegments,
  resetSegmentCounter,
} from './segments.js';

export {
  buildCacheAlignedPrompt,
  analyzeCachePotential,
} from './cache-alignment.js';

export {
  toProviderFormat,
  toOpenAIFormat,
  toAnthropicFormat,
  toGoogleFormat,
  extractMessages,
} from './formatters.js';
