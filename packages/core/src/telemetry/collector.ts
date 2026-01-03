/**
 * @module telemetry/collector
 * Telemetry collector for token and cost tracking
 */

import type {
  TelemetryConfig,
  TelemetryHandler,
  TelemetrySubscriber,
  TelemetryEventType,
  AnyTelemetryEvent,
  RequestEvent,
  CacheEvent,
  BudgetEvent,
  OptimizationEvent,
  TokenCountEvent,
  TokenInfo,
  CostInfo,
  AggregatedMetrics,
  Span,
  TelemetryExporter,
} from './types.js';

/**
 * Generate a unique ID
 */
function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Telemetry collector for tracking token usage, costs, and performance
 */
export class TelemetryCollector {
  private config: TelemetryConfig;
  private subscribers: Map<string, TelemetrySubscriber> = new Map();
  private eventBuffer: AnyTelemetryEvent[] = [];
  private spanBuffer: Span[] = [];
  private activeSpans: Map<string, Span> = new Map();
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private exporters: TelemetryExporter[] = [];

  // Metrics for aggregation
  private metricsWindow: AnyTelemetryEvent[] = [];
  private windowStart: number = Date.now();

  constructor(config: Partial<TelemetryConfig> = {}) {
    this.config = {
      enabled: true,
      tracing: false,
      sampleRate: 1.0,
      bufferSize: 100,
      flushInterval: 5000,
      ...config,
    };

    if (this.config.flushInterval && this.config.flushInterval > 0) {
      this.startFlushTimer();
    }
  }

  /**
   * Subscribe to telemetry events
   */
  subscribe(
    handler: TelemetryHandler,
    eventTypes?: TelemetryEventType[]
  ): string {
    const id = generateId();
    this.subscribers.set(id, { id, handler, eventTypes });
    return id;
  }

  /**
   * Unsubscribe from telemetry events
   */
  unsubscribe(id: string): boolean {
    return this.subscribers.delete(id);
  }

  /**
   * Add an exporter
   */
  addExporter(exporter: TelemetryExporter): void {
    this.exporters.push(exporter);
  }

  /**
   * Emit a telemetry event
   */
  emit(event: Omit<AnyTelemetryEvent, 'timestamp'>): void {
    if (!this.config.enabled) return;

    // Apply sampling
    if (this.config.sampleRate && Math.random() > this.config.sampleRate) {
      return;
    }

    const fullEvent: AnyTelemetryEvent = {
      ...event,
      timestamp: Date.now(),
    } as AnyTelemetryEvent;

    // Add global attributes if any
    if (this.config.globalAttributes && 'metadata' in fullEvent) {
      (fullEvent as RequestEvent).metadata = {
        ...this.config.globalAttributes,
        ...(fullEvent as RequestEvent).metadata,
      };
    }

    // Buffer the event
    this.eventBuffer.push(fullEvent);
    this.metricsWindow.push(fullEvent);

    // Notify subscribers
    this.notifySubscribers(fullEvent);

    // Flush if buffer is full
    if (this.eventBuffer.length >= (this.config.bufferSize ?? 100)) {
      this.flush();
    }
  }

  /**
   * Notify all matching subscribers
   */
  private notifySubscribers(event: AnyTelemetryEvent): void {
    for (const subscriber of this.subscribers.values()) {
      if (!subscriber.eventTypes || subscriber.eventTypes.includes(event.type)) {
        try {
          subscriber.handler(event);
        } catch (error) {
          console.error('Telemetry subscriber error:', error);
        }
      }
    }
  }

  /**
   * Record a request start
   */
  recordRequestStart(
    requestId: string,
    model: string,
    provider: string,
    metadata?: Record<string, unknown>
  ): void {
    const event: Omit<RequestEvent, 'timestamp'> = {
      type: 'request_start',
      requestId,
      model,
      provider,
      metadata,
      traceId: this.config.tracing ? generateId() : undefined,
      spanId: this.config.tracing ? generateId() : undefined,
    };
    this.emit(event);
  }

  /**
   * Record a request completion
   */
  recordRequestComplete(
    requestId: string,
    model: string,
    provider: string,
    tokens: TokenInfo,
    cost: CostInfo,
    duration: number,
    metadata?: Record<string, unknown>
  ): void {
    const event: Omit<RequestEvent, 'timestamp'> = {
      type: 'request_complete',
      requestId,
      model,
      provider,
      tokens,
      cost,
      duration,
      metadata,
    };
    this.emit(event);
  }

  /**
   * Record a request error
   */
  recordRequestError(
    requestId: string,
    model: string,
    provider: string,
    error: string,
    duration?: number,
    metadata?: Record<string, unknown>
  ): void {
    const event: Omit<RequestEvent, 'timestamp'> = {
      type: 'request_error',
      requestId,
      model,
      provider,
      error,
      duration,
      metadata,
    };
    this.emit(event);
  }

  /**
   * Record a cache hit
   */
  recordCacheHit(
    key: string,
    similarity: number,
    tokensSaved: number,
    costSaved: number
  ): void {
    const event: Omit<CacheEvent, 'timestamp'> = {
      type: 'cache_hit',
      key,
      similarity,
      tokensSaved,
      costSaved,
    };
    this.emit(event);
  }

  /**
   * Record a cache miss
   */
  recordCacheMiss(key: string): void {
    const event: Omit<CacheEvent, 'timestamp'> = {
      type: 'cache_miss',
      key,
    };
    this.emit(event);
  }

  /**
   * Record a cache write
   */
  recordCacheWrite(key: string, ttl?: number): void {
    const event: Omit<CacheEvent, 'timestamp'> = {
      type: 'cache_write',
      key,
      ttl,
    };
    this.emit(event);
  }

  /**
   * Record a budget warning
   */
  recordBudgetWarning(
    currentTokens: number,
    budgetLimit: number,
    budgetType: BudgetEvent['budgetType']
  ): void {
    const event: Omit<BudgetEvent, 'timestamp'> = {
      type: 'budget_warning',
      currentTokens,
      budgetLimit,
      utilization: currentTokens / budgetLimit,
      budgetType,
    };
    this.emit(event);
  }

  /**
   * Record a budget exceeded event
   */
  recordBudgetExceeded(
    currentTokens: number,
    budgetLimit: number,
    budgetType: BudgetEvent['budgetType']
  ): void {
    const event: Omit<BudgetEvent, 'timestamp'> = {
      type: 'budget_exceeded',
      currentTokens,
      budgetLimit,
      utilization: currentTokens / budgetLimit,
      budgetType,
    };
    this.emit(event);
  }

  /**
   * Record a trim operation
   */
  recordTrim(
    tokensBefore: number,
    tokensAfter: number,
    strategy?: string
  ): void {
    const event: Omit<OptimizationEvent, 'timestamp'> = {
      type: 'trim_applied',
      tokensBefore,
      tokensAfter,
      tokensSaved: tokensBefore - tokensAfter,
      strategy,
    };
    this.emit(event);
  }

  /**
   * Record a compression operation
   */
  recordCompression(
    tokensBefore: number,
    tokensAfter: number,
    strategy?: string
  ): void {
    const event: Omit<OptimizationEvent, 'timestamp'> = {
      type: 'compression_applied',
      tokensBefore,
      tokensAfter,
      tokensSaved: tokensBefore - tokensAfter,
      strategy,
    };
    this.emit(event);
  }

  /**
   * Record a token count
   */
  recordTokenCount(
    count: number,
    textLength: number,
    source: 'estimate' | 'tokenizer',
    model?: string
  ): void {
    const event: Omit<TokenCountEvent, 'timestamp'> = {
      type: 'token_count',
      count,
      textLength,
      source,
      model,
    };
    this.emit(event);
  }

  /**
   * Start a span for tracing
   */
  startSpan(
    name: string,
    parentSpanId?: string
  ): Span | null {
    if (!this.config.tracing) return null;

    const span: Span = {
      spanId: generateId(),
      traceId: parentSpanId
        ? this.activeSpans.get(parentSpanId)?.traceId ?? generateId()
        : generateId(),
      parentSpanId,
      name,
      startTime: Date.now(),
      status: 'pending',
      attributes: {},
      children: [],
    };

    this.activeSpans.set(span.spanId, span);

    // Add to parent if exists
    if (parentSpanId) {
      const parent = this.activeSpans.get(parentSpanId);
      if (parent) {
        parent.children.push(span);
      }
    }

    return span;
  }

  /**
   * End a span
   */
  endSpan(spanId: string, status: 'ok' | 'error' = 'ok'): void {
    const span = this.activeSpans.get(spanId);
    if (!span) return;

    span.endTime = Date.now();
    span.duration = span.endTime - span.startTime;
    span.status = status;

    // If this is a root span, add to buffer
    if (!span.parentSpanId) {
      this.spanBuffer.push(span);
    }

    this.activeSpans.delete(spanId);
  }

  /**
   * Add attribute to span
   */
  addSpanAttribute(
    spanId: string,
    key: string,
    value: string | number | boolean
  ): void {
    const span = this.activeSpans.get(spanId);
    if (span) {
      span.attributes[key] = value;
    }
  }

  /**
   * Get aggregated metrics for the current window
   */
  getMetrics(): AggregatedMetrics {
    const now = Date.now();
    const metrics: AggregatedMetrics = {
      periodStart: this.windowStart,
      periodEnd: now,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      tokens: { input: 0, output: 0, cached: 0, total: 0 },
      costs: { input: 0, output: 0, total: 0, saved: 0 },
      cache: { hits: 0, misses: 0, hitRate: 0, tokensSaved: 0, costSaved: 0 },
      budgetEvents: { warnings: 0, exceeded: 0 },
      avgLatency: 0,
      byModel: {},
      byProvider: {},
    };

    let totalLatency = 0;
    let requestCount = 0;

    for (const event of this.metricsWindow) {
      switch (event.type) {
        case 'request_start':
          metrics.totalRequests++;
          break;

        case 'request_complete': {
          const reqEvent = event as RequestEvent;
          metrics.successfulRequests++;

          if (reqEvent.tokens) {
            metrics.tokens.input += reqEvent.tokens.input;
            metrics.tokens.output += reqEvent.tokens.output;
            metrics.tokens.cached += reqEvent.tokens.cached ?? 0;
            metrics.tokens.total += reqEvent.tokens.total;
          }

          if (reqEvent.cost) {
            metrics.costs.input += reqEvent.cost.input;
            metrics.costs.output += reqEvent.cost.output;
            metrics.costs.total += reqEvent.cost.total;
            metrics.costs.saved += reqEvent.cost.saved ?? 0;
          }

          if (reqEvent.duration) {
            totalLatency += reqEvent.duration;
            requestCount++;
          }

          // By model
          const model = reqEvent.model;
          if (!metrics.byModel[model]) {
            metrics.byModel[model] = { requests: 0, tokens: 0, cost: 0 };
          }
          metrics.byModel[model].requests++;
          metrics.byModel[model].tokens += reqEvent.tokens?.total ?? 0;
          metrics.byModel[model].cost += reqEvent.cost?.total ?? 0;

          // By provider
          const provider = reqEvent.provider;
          if (!metrics.byProvider[provider]) {
            metrics.byProvider[provider] = { requests: 0, tokens: 0, cost: 0 };
          }
          metrics.byProvider[provider].requests++;
          metrics.byProvider[provider].tokens += reqEvent.tokens?.total ?? 0;
          metrics.byProvider[provider].cost += reqEvent.cost?.total ?? 0;
          break;
        }

        case 'request_error':
          metrics.failedRequests++;
          break;

        case 'cache_hit': {
          const cacheEvent = event as CacheEvent;
          metrics.cache.hits++;
          metrics.cache.tokensSaved += cacheEvent.tokensSaved ?? 0;
          metrics.cache.costSaved += cacheEvent.costSaved ?? 0;
          break;
        }

        case 'cache_miss':
          metrics.cache.misses++;
          break;

        case 'budget_warning':
          metrics.budgetEvents.warnings++;
          break;

        case 'budget_exceeded':
          metrics.budgetEvents.exceeded++;
          break;
      }
    }

    // Calculate averages
    if (requestCount > 0) {
      metrics.avgLatency = totalLatency / requestCount;
    }

    const totalCacheAttempts = metrics.cache.hits + metrics.cache.misses;
    if (totalCacheAttempts > 0) {
      metrics.cache.hitRate = metrics.cache.hits / totalCacheAttempts;
    }

    return metrics;
  }

  /**
   * Reset metrics window
   */
  resetMetrics(): void {
    this.metricsWindow = [];
    this.windowStart = Date.now();
  }

  /**
   * Flush buffered events to exporters
   */
  async flush(): Promise<void> {
    if (this.eventBuffer.length === 0 && this.spanBuffer.length === 0) return;

    const events = [...this.eventBuffer];
    const spans = [...this.spanBuffer];

    this.eventBuffer = [];
    this.spanBuffer = [];

    // Export to all exporters
    await Promise.all(
      this.exporters.map(async (exporter) => {
        try {
          if (events.length > 0) {
            await exporter.export(events);
          }
          if (spans.length > 0 && exporter.exportSpans) {
            await exporter.exportSpans(spans);
          }
        } catch (error) {
          console.error('Telemetry export error:', error);
        }
      })
    );
  }

  /**
   * Start the flush timer
   */
  private startFlushTimer(): void {
    if (this.flushTimer) return;

    this.flushTimer = setInterval(
      () => this.flush(),
      this.config.flushInterval ?? 5000
    );
  }

  /**
   * Stop the flush timer
   */
  private stopFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  /**
   * Shutdown the collector
   */
  async shutdown(): Promise<void> {
    this.stopFlushTimer();
    await this.flush();

    // Shutdown all exporters
    await Promise.all(
      this.exporters.map((exporter) => exporter.shutdown())
    );

    this.subscribers.clear();
    this.activeSpans.clear();
    this.config.enabled = false;
  }

  /**
   * Get current configuration
   */
  getConfig(): TelemetryConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<TelemetryConfig>): void {
    const wasEnabled = this.config.enabled;
    this.config = { ...this.config, ...config };

    // Handle flush interval changes
    if (config.flushInterval !== undefined) {
      this.stopFlushTimer();
      if (config.flushInterval > 0 && this.config.enabled) {
        this.startFlushTimer();
      }
    }

    // Handle enable/disable
    if (!wasEnabled && this.config.enabled) {
      this.startFlushTimer();
    } else if (wasEnabled && !this.config.enabled) {
      this.stopFlushTimer();
    }
  }
}

/**
 * Create a telemetry collector
 */
export function createTelemetryCollector(
  config?: Partial<TelemetryConfig>
): TelemetryCollector {
  return new TelemetryCollector(config);
}

// Global singleton collector
let globalCollector: TelemetryCollector | null = null;

/**
 * Get the global telemetry collector
 */
export function getTelemetryCollector(): TelemetryCollector {
  if (!globalCollector) {
    globalCollector = new TelemetryCollector();
  }
  return globalCollector;
}

/**
 * Set the global telemetry collector
 */
export function setGlobalTelemetryCollector(collector: TelemetryCollector): void {
  globalCollector = collector;
}
