/**
 * @module telemetry
 * Telemetry and observability for token optimization
 *
 * Provides comprehensive tracking of token usage, costs, cache performance,
 * and request tracing with OpenTelemetry-compatible exports.
 *
 * @example
 * ```ts
 * import {
 *   createTelemetryCollector,
 *   createConsoleExporter,
 * } from '@token-optimizer/core/telemetry';
 *
 * // Create collector with console output
 * const collector = createTelemetryCollector({
 *   enabled: true,
 *   tracing: true,
 * });
 * collector.addExporter(createConsoleExporter({ verbose: true }));
 *
 * // Record events
 * collector.recordRequestStart('req-1', 'gpt-4o', 'openai');
 * // ... make API call ...
 * collector.recordRequestComplete('req-1', 'gpt-4o', 'openai',
 *   { input: 100, output: 50, total: 150 },
 *   { input: 0.01, output: 0.02, total: 0.03 },
 *   250
 * );
 *
 * // Get metrics
 * const metrics = collector.getMetrics();
 * console.log(`Total cost: $${metrics.costs.total.toFixed(4)}`);
 * ```
 */

// Types
export type {
  TelemetryEventType,
  TelemetryEvent,
  TokenInfo,
  CostInfo,
  RequestEvent,
  CacheEvent,
  BudgetEvent,
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
} from './types.js';

// Collector
export {
  TelemetryCollector,
  createTelemetryCollector,
  getTelemetryCollector,
  setGlobalTelemetryCollector,
} from './collector.js';

// Exporters
export {
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
} from './exporters.js';
