/**
 * @module telemetry/types
 * Type definitions for telemetry and observability
 */

import type { Provider } from '../types/index.js';

/**
 * Telemetry event types
 */
export type TelemetryEventType =
  | 'request_start'
  | 'request_complete'
  | 'request_error'
  | 'cache_hit'
  | 'cache_miss'
  | 'cache_write'
  | 'budget_warning'
  | 'budget_exceeded'
  | 'trim_applied'
  | 'compression_applied'
  | 'token_count';

/**
 * Base telemetry event
 */
export interface TelemetryEvent {
  /** Event type */
  type: TelemetryEventType;
  /** Event timestamp */
  timestamp: number;
  /** Optional trace ID for request correlation */
  traceId?: string;
  /** Optional span ID for nested operations */
  spanId?: string;
  /** Optional parent span ID */
  parentSpanId?: string;
}

/**
 * Token usage information
 */
export interface TokenInfo {
  /** Input/prompt tokens */
  input: number;
  /** Output/completion tokens */
  output: number;
  /** Cached tokens (if applicable) */
  cached?: number;
  /** Total tokens */
  total: number;
}

/**
 * Cost information
 */
export interface CostInfo {
  /** Cost for input tokens (USD) */
  input: number;
  /** Cost for output tokens (USD) */
  output: number;
  /** Total cost (USD) */
  total: number;
  /** Savings from cache (USD) */
  saved?: number;
}

/**
 * Request telemetry event
 */
export interface RequestEvent extends TelemetryEvent {
  type: 'request_start' | 'request_complete' | 'request_error';
  /** Request ID */
  requestId: string;
  /** Model used */
  model: string;
  /** Provider */
  provider: Provider | string;
  /** Token usage (for complete events) */
  tokens?: TokenInfo;
  /** Cost information (for complete events) */
  cost?: CostInfo;
  /** Request duration in ms (for complete events) */
  duration?: number;
  /** Error message (for error events) */
  error?: string;
  /** Custom metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Cache telemetry event
 */
export interface CacheEvent extends TelemetryEvent {
  type: 'cache_hit' | 'cache_miss' | 'cache_write';
  /** Cache key or query hash */
  key: string;
  /** Similarity score (for hits) */
  similarity?: number;
  /** Tokens saved (for hits) */
  tokensSaved?: number;
  /** Cost saved (for hits) */
  costSaved?: number;
  /** Cache TTL (for writes) */
  ttl?: number;
}

/**
 * Budget telemetry event
 */
export interface BudgetEvent extends TelemetryEvent {
  type: 'budget_warning' | 'budget_exceeded';
  /** Current token usage */
  currentTokens: number;
  /** Budget limit */
  budgetLimit: number;
  /** Utilization percentage */
  utilization: number;
  /** Budget type */
  budgetType: 'request' | 'turn' | 'session' | 'daily' | 'monthly';
}

/**
 * Optimization telemetry event
 */
export interface OptimizationEvent extends TelemetryEvent {
  type: 'trim_applied' | 'compression_applied';
  /** Tokens before */
  tokensBefore: number;
  /** Tokens after */
  tokensAfter: number;
  /** Tokens saved */
  tokensSaved: number;
  /** Strategy used */
  strategy?: string;
}

/**
 * Token count event
 */
export interface TokenCountEvent extends TelemetryEvent {
  type: 'token_count';
  /** Model used for counting */
  model?: string;
  /** Token count */
  count: number;
  /** Text length */
  textLength: number;
  /** Source of count (estimation vs actual tokenizer) */
  source: 'estimate' | 'tokenizer';
}

/**
 * Union of all event types
 */
export type AnyTelemetryEvent =
  | RequestEvent
  | CacheEvent
  | BudgetEvent
  | OptimizationEvent
  | TokenCountEvent;

/**
 * Telemetry handler function
 */
export type TelemetryHandler = (event: AnyTelemetryEvent) => void | Promise<void>;

/**
 * Telemetry subscriber
 */
export interface TelemetrySubscriber {
  /** Unique subscriber ID */
  id: string;
  /** Handler function */
  handler: TelemetryHandler;
  /** Event types to subscribe to (undefined = all) */
  eventTypes?: TelemetryEventType[];
}

/**
 * Aggregated metrics for a time period
 */
export interface AggregatedMetrics {
  /** Time period start */
  periodStart: number;
  /** Time period end */
  periodEnd: number;
  /** Total requests */
  totalRequests: number;
  /** Successful requests */
  successfulRequests: number;
  /** Failed requests */
  failedRequests: number;
  /** Token totals */
  tokens: {
    input: number;
    output: number;
    cached: number;
    total: number;
  };
  /** Cost totals */
  costs: {
    input: number;
    output: number;
    total: number;
    saved: number;
  };
  /** Cache stats */
  cache: {
    hits: number;
    misses: number;
    hitRate: number;
    tokensSaved: number;
    costSaved: number;
  };
  /** Budget events */
  budgetEvents: {
    warnings: number;
    exceeded: number;
  };
  /** Average latency in ms */
  avgLatency: number;
  /** Breakdown by model */
  byModel: Record<string, {
    requests: number;
    tokens: number;
    cost: number;
  }>;
  /** Breakdown by provider */
  byProvider: Record<string, {
    requests: number;
    tokens: number;
    cost: number;
  }>;
}

/**
 * Span for request tracing
 */
export interface Span {
  /** Span ID */
  spanId: string;
  /** Trace ID */
  traceId: string;
  /** Parent span ID */
  parentSpanId?: string;
  /** Operation name */
  name: string;
  /** Start time */
  startTime: number;
  /** End time */
  endTime?: number;
  /** Duration in ms */
  duration?: number;
  /** Status */
  status: 'ok' | 'error' | 'pending';
  /** Attributes */
  attributes: Record<string, string | number | boolean>;
  /** Child spans */
  children: Span[];
}

/**
 * Telemetry configuration
 */
export interface TelemetryConfig {
  /** Enable telemetry */
  enabled: boolean;
  /** Enable request tracing */
  tracing?: boolean;
  /** Sample rate (0-1) */
  sampleRate?: number;
  /** Buffer size for batching */
  bufferSize?: number;
  /** Flush interval in ms */
  flushInterval?: number;
  /** Custom attributes to add to all events */
  globalAttributes?: Record<string, string | number | boolean>;
}

/**
 * OpenTelemetry-compatible span context
 */
export interface SpanContext {
  traceId: string;
  spanId: string;
  traceFlags: number;
}

/**
 * OpenTelemetry-compatible exporter interface
 */
export interface TelemetryExporter {
  /** Export events */
  export(events: AnyTelemetryEvent[]): Promise<void>;
  /** Export spans */
  exportSpans?(spans: Span[]): Promise<void>;
  /** Shutdown the exporter */
  shutdown(): Promise<void>;
}
