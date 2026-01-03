/**
 * @module telemetry/exporters
 * Telemetry exporters for different backends
 */

import type {
  TelemetryExporter,
  AnyTelemetryEvent,
  Span,
} from './types.js';

/**
 * Console exporter for development/debugging
 */
export class ConsoleExporter implements TelemetryExporter {
  private prefix: string;
  private verbose: boolean;

  constructor(options: { prefix?: string; verbose?: boolean } = {}) {
    this.prefix = options.prefix ?? '[Telemetry]';
    this.verbose = options.verbose ?? false;
  }

  async export(events: AnyTelemetryEvent[]): Promise<void> {
    for (const event of events) {
      const timestamp = new Date(event.timestamp).toISOString();

      if (this.verbose) {
        console.log(`${this.prefix} ${timestamp} ${event.type}:`, event);
      } else {
        console.log(`${this.prefix} ${timestamp} ${event.type}`);
      }
    }
  }

  async exportSpans(spans: Span[]): Promise<void> {
    for (const span of spans) {
      const duration = span.duration ?? 'pending';
      console.log(
        `${this.prefix} Span: ${span.name} (${duration}ms) [${span.status}]`
      );

      if (this.verbose && span.children.length > 0) {
        this.logSpanTree(span, 1);
      }
    }
  }

  private logSpanTree(span: Span, depth: number): void {
    const indent = '  '.repeat(depth);
    for (const child of span.children) {
      const duration = child.duration ?? 'pending';
      console.log(
        `${this.prefix} ${indent}└─ ${child.name} (${duration}ms) [${child.status}]`
      );
      if (child.children.length > 0) {
        this.logSpanTree(child, depth + 1);
      }
    }
  }

  async shutdown(): Promise<void> {
    // No cleanup needed
  }
}

/**
 * Memory exporter for testing
 */
export class MemoryExporter implements TelemetryExporter {
  private events: AnyTelemetryEvent[] = [];
  private spans: Span[] = [];

  async export(events: AnyTelemetryEvent[]): Promise<void> {
    this.events.push(...events);
  }

  async exportSpans(spans: Span[]): Promise<void> {
    this.spans.push(...spans);
  }

  async shutdown(): Promise<void> {
    // No cleanup needed
  }

  /**
   * Get all exported events
   */
  getEvents(): AnyTelemetryEvent[] {
    return [...this.events];
  }

  /**
   * Get all exported spans
   */
  getSpans(): Span[] {
    return [...this.spans];
  }

  /**
   * Get events by type
   */
  getEventsByType<T extends AnyTelemetryEvent>(type: T['type']): T[] {
    return this.events.filter((e) => e.type === type) as T[];
  }

  /**
   * Clear all exported data
   */
  clear(): void {
    this.events = [];
    this.spans = [];
  }

  /**
   * Get event count
   */
  get eventCount(): number {
    return this.events.length;
  }

  /**
   * Get span count
   */
  get spanCount(): number {
    return this.spans.length;
  }
}

/**
 * JSON Lines exporter for file-based logging
 */
export class JSONLinesExporter implements TelemetryExporter {
  private output: (line: string) => void;

  constructor(output: (line: string) => void) {
    this.output = output;
  }

  async export(events: AnyTelemetryEvent[]): Promise<void> {
    for (const event of events) {
      this.output(JSON.stringify(event));
    }
  }

  async exportSpans(spans: Span[]): Promise<void> {
    for (const span of spans) {
      this.output(JSON.stringify({ type: 'span', ...span }));
    }
  }

  async shutdown(): Promise<void> {
    // No cleanup needed
  }
}

/**
 * Callback exporter for custom integrations
 */
export class CallbackExporter implements TelemetryExporter {
  private onEvents?: (events: AnyTelemetryEvent[]) => void | Promise<void>;
  private onSpans?: (spans: Span[]) => void | Promise<void>;
  private onShutdown?: () => void | Promise<void>;

  constructor(options: {
    onEvents?: (events: AnyTelemetryEvent[]) => void | Promise<void>;
    onSpans?: (spans: Span[]) => void | Promise<void>;
    onShutdown?: () => void | Promise<void>;
  }) {
    this.onEvents = options.onEvents;
    this.onSpans = options.onSpans;
    this.onShutdown = options.onShutdown;
  }

  async export(events: AnyTelemetryEvent[]): Promise<void> {
    if (this.onEvents) {
      await this.onEvents(events);
    }
  }

  async exportSpans(spans: Span[]): Promise<void> {
    if (this.onSpans) {
      await this.onSpans(spans);
    }
  }

  async shutdown(): Promise<void> {
    if (this.onShutdown) {
      await this.onShutdown();
    }
  }
}

/**
 * Batched HTTP exporter for sending to remote endpoints
 */
export class HTTPExporter implements TelemetryExporter {
  private endpoint: string;
  private headers: Record<string, string>;
  private timeout: number;

  constructor(options: {
    endpoint: string;
    headers?: Record<string, string>;
    timeout?: number;
  }) {
    this.endpoint = options.endpoint;
    this.headers = options.headers ?? {};
    this.timeout = options.timeout ?? 10000;
  }

  async export(events: AnyTelemetryEvent[]): Promise<void> {
    await this.send({ events });
  }

  async exportSpans(spans: Span[]): Promise<void> {
    await this.send({ spans });
  }

  private async send(payload: unknown): Promise<void> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.headers,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        console.error(`Telemetry export failed: ${response.status}`);
      }
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        console.error('Telemetry export error:', error);
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async shutdown(): Promise<void> {
    // No cleanup needed
  }
}

/**
 * OpenTelemetry Protocol (OTLP) compatible exporter
 * Converts our format to OTLP-like format for compatibility
 */
export class OTLPExporter implements TelemetryExporter {
  private endpoint: string;
  private headers: Record<string, string>;
  private serviceName: string;

  constructor(options: {
    endpoint: string;
    headers?: Record<string, string>;
    serviceName?: string;
  }) {
    this.endpoint = options.endpoint;
    this.headers = options.headers ?? {};
    this.serviceName = options.serviceName ?? 'token-optimizer';
  }

  async export(events: AnyTelemetryEvent[]): Promise<void> {
    // Convert to OTLP log format
    const logs = events.map((event) => ({
      timeUnixNano: event.timestamp * 1_000_000, // ms to ns
      severityNumber: 9, // INFO
      body: {
        stringValue: JSON.stringify(event),
      },
      attributes: [
        { key: 'event.type', value: { stringValue: event.type } },
        { key: 'service.name', value: { stringValue: this.serviceName } },
      ],
    }));

    await this.send({
      resourceLogs: [{
        resource: {
          attributes: [
            { key: 'service.name', value: { stringValue: this.serviceName } },
          ],
        },
        scopeLogs: [{
          scope: { name: '@token-optimizer/telemetry' },
          logRecords: logs,
        }],
      }],
    });
  }

  async exportSpans(spans: Span[]): Promise<void> {
    // Convert to OTLP span format
    const otlpSpans = this.convertSpans(spans);

    await this.send({
      resourceSpans: [{
        resource: {
          attributes: [
            { key: 'service.name', value: { stringValue: this.serviceName } },
          ],
        },
        scopeSpans: [{
          scope: { name: '@token-optimizer/telemetry' },
          spans: otlpSpans,
        }],
      }],
    });
  }

  private convertSpans(spans: Span[]): unknown[] {
    const result: unknown[] = [];

    for (const span of spans) {
      result.push({
        traceId: span.traceId,
        spanId: span.spanId,
        parentSpanId: span.parentSpanId,
        name: span.name,
        startTimeUnixNano: span.startTime * 1_000_000,
        endTimeUnixNano: (span.endTime ?? span.startTime) * 1_000_000,
        status: {
          code: span.status === 'ok' ? 1 : span.status === 'error' ? 2 : 0,
        },
        attributes: Object.entries(span.attributes).map(([key, value]) => ({
          key,
          value: typeof value === 'string'
            ? { stringValue: value }
            : typeof value === 'number'
              ? { intValue: value }
              : { boolValue: value },
        })),
      });

      // Recursively add child spans
      if (span.children.length > 0) {
        result.push(...this.convertSpans(span.children));
      }
    }

    return result;
  }

  private async send(payload: unknown): Promise<void> {
    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.headers,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        console.error(`OTLP export failed: ${response.status}`);
      }
    } catch (error) {
      console.error('OTLP export error:', error);
    }
  }

  async shutdown(): Promise<void> {
    // No cleanup needed
  }
}

/**
 * Create a console exporter
 */
export function createConsoleExporter(
  options?: { prefix?: string; verbose?: boolean }
): ConsoleExporter {
  return new ConsoleExporter(options);
}

/**
 * Create a memory exporter
 */
export function createMemoryExporter(): MemoryExporter {
  return new MemoryExporter();
}

/**
 * Create an HTTP exporter
 */
export function createHTTPExporter(
  endpoint: string,
  options?: { headers?: Record<string, string>; timeout?: number }
): HTTPExporter {
  return new HTTPExporter({ endpoint, ...options });
}

/**
 * Create an OTLP exporter
 */
export function createOTLPExporter(
  endpoint: string,
  options?: { headers?: Record<string, string>; serviceName?: string }
): OTLPExporter {
  return new OTLPExporter({ endpoint, ...options });
}
