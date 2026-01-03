/**
 * @module @token-optimizer/core
 *
 * Core utilities for AI token optimization.
 * Provider-agnostic utilities for tokenization, budgets, caching, and cost estimation.
 *
 * @example
 * ```ts
 * import {
 *   createTokenizer,
 *   estimateTokens,
 *   createBudgetManager,
 *   estimateCost,
 *   buildCacheAlignedPrompt,
 * } from '@token-optimizer/core';
 *
 * // Token counting
 * const tokenizer = await createTokenizer('gpt-4o');
 * const count = tokenizer.count('Hello, world!');
 *
 * // Budget management
 * const budget = createBudgetManager({
 *   maxInputTokens: 4096,
 *   maxOutputTokens: 1024,
 * });
 * const status = budget.checkBudget(2000, 500);
 *
 * // Cost estimation
 * const cost = estimateCost('gpt-4o', 1000, 500, 800);
 * console.log(`Cost: $${cost.totalCost.toFixed(4)}`);
 * ```
 */

// Types
export type {
  ChatMessage,
  Tool,
  ToolCall,
  TokenizerModel,
  Provider,
  TokenUsage,
  RequestUsage,
  SessionStats,
  HistoricalStats,
  UsageData,
  StorageAdapter,
} from './types/index.js';

// Tokenizers
export type { Tokenizer, TokenizerOptions, EncodeFn, DecodeFn, ChatOverheadConfig } from './tokenizers/index.js';

export {
  createTokenizer,
  clearTokenizerCache,
  getEstimationTokenizer,
  estimateTokens,
  estimateChatTokens,
  calculateChatOverhead,
  isWithinTokenLimit,
  normalizeModelName,
  createEstimationTokenizer,
  createGPTTokenizer,
  createFallbackTokenizer,
  DEFAULT_CHAT_OVERHEAD,
} from './tokenizers/index.js';

// Budget Management
export type {
  TokenBudget,
  BudgetStatus,
  BudgetStatusLevel,
  BudgetManager,
  TrimResult,
  TrimOptions,
} from './budget/index.js';

export {
  createBudgetManager,
  MODEL_BUDGETS,
  DEFAULT_BUDGET,
  TASK_OUTPUT_RATIOS,
  getModelBudget,
} from './budget/index.js';

// Cost Estimation
export type {
  ModelPricing,
  CostEstimate,
  TrackerOptions,
  UsageTracker,
  DailyStats,
  BudgetAlert,
} from './cost/index.js';

export {
  estimateCost,
  MODEL_PRICING,
  getModelPricing,
  calculatePotentialSavings,
  updatePricing,
  getAllPricing,
  createUsageTracker,
} from './cost/index.js';

// Provider Cache Optimization
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
} from './providers/index.js';

export {
  createSystemSegment,
  createContextSegment,
  createExamplesSegment,
  createToolsSegment,
  createHistorySegment,
  createUserSegment,
  createCustomSegment,
  mergeSegments,
  buildCacheAlignedPrompt,
  analyzeCachePotential,
  toProviderFormat,
  toOpenAIFormat,
  toAnthropicFormat,
  toGoogleFormat,
  extractMessages,
} from './providers/index.js';

// Compression
export type {
  CompressionResult,
  CompressionOptions,
  SummarizeOptions,
  SummarizeResult,
  ImportanceOptions,
  ScoredMessage,
  ScoredSentence,
} from './compression/index.js';

export {
  compressExtractive,
  quickCompress,
  selectImportantMessages,
  summarizeHistory,
  slidingWindowContext,
} from './compression/index.js';

// Provider Adapters
export type {
  ProviderAdapter,
  ProviderCapabilities,
  TokenUsage as AdapterTokenUsage,
  CostEstimate as AdapterCostEstimate,
  ModelPricing as AdapterModelPricing,
  NormalizedResponse,
  CountOptions,
  ProviderMessage,
  OpenAIMessage as AdapterOpenAIMessage,
  AnthropicMessage as AdapterAnthropicMessage,
  GoogleMessage as AdapterGoogleMessage,
  BedrockMessage,
  GenericMessage,
  AdapterRegistry,
  ExtendedProvider,
} from './adapters/index.js';

export {
  BaseAdapter,
  OpenAIAdapter,
  AnthropicAdapter,
  GoogleAdapter,
  AzureAdapter,
  BedrockAdapter,
  MistralAdapter,
  CohereAdapter,
  GroqAdapter,
  createOpenAIAdapter,
  createAnthropicAdapter,
  createGoogleAdapter,
  createAzureAdapter,
  createBedrockAdapter,
  createMistralAdapter,
  createCohereAdapter,
  createGroqAdapter,
  createExtendedAdapter,
  getAdapter,
  getAdapterRegistry,
  registerAdapter,
  getSupportedProviders,
  isProviderSupported,
} from './adapters/index.js';

// Token Policy
export type {
  MessagePriority,
  PrioritizedMessage,
  TokenBudget as PolicyTokenBudget,
  TrimResult as PolicyTrimResult,
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
} from './policy/index.js';

export {
  trimOldestFirst,
  trimByPriority,
  trimPreservingPairs,
  smartTrim,
  estimateTrimTokens,
  stablePrefix,
  multiSectionPrefix,
  padToMinimum,
  analyzePrefix,
  extractiveSummarizer,
  summarizeAndTrim,
  createSummarizer,
  slidingWindowWithSummary,
  incrementalSummarize,
  extractKeyInfo,
  compressMessages,
  packContext,
  segmentMessages,
  mergeSegments as mergePolicySegments,
  distributeAcrossTurns,
  interleaveByPriority,
  calculateUtilization,
  TokenPolicy,
} from './policy/index.js';

// Telemetry
export type {
  TelemetryEventType,
  TelemetryEvent,
  TokenInfo as TelemetryTokenInfo,
  CostInfo as TelemetryCostInfo,
  RequestEvent,
  CacheEvent,
  BudgetEvent as TelemetryBudgetEvent,
  OptimizationEvent,
  TokenCountEvent,
  AnyTelemetryEvent,
  TelemetryHandler,
  TelemetrySubscriber,
  AggregatedMetrics,
  Span,
  TelemetryConfig,
  SpanContext,
  TelemetryExporter,
} from './telemetry/index.js';

export {
  TelemetryCollector,
  createTelemetryCollector,
  getTelemetryCollector,
  setGlobalTelemetryCollector,
  ConsoleExporter,
  MemoryExporter,
  JSONLinesExporter,
  CallbackExporter,
  HTTPExporter,
  OTLPExporter,
  createConsoleExporter,
  createMemoryExporter,
  createHTTPExporter,
  createOTLPExporter,
} from './telemetry/index.js';
