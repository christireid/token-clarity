/**
 * Tests for telemetry module
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  TelemetryCollector,
  createTelemetryCollector,
  getTelemetryCollector,
  setGlobalTelemetryCollector,
} from '../collector.js';
import {
  ConsoleExporter,
  MemoryExporter,
  JSONLinesExporter,
  CallbackExporter,
  createConsoleExporter,
  createMemoryExporter,
} from '../exporters.js';
import type { RequestEvent, CacheEvent, AnyTelemetryEvent } from '../types.js';

describe('TelemetryCollector', () => {
  let collector: TelemetryCollector;
  let exporter: MemoryExporter;

  beforeEach(() => {
    exporter = new MemoryExporter();
    collector = createTelemetryCollector({
      enabled: true,
      bufferSize: 10,
      flushInterval: 0, // Disable auto-flush for tests
    });
    collector.addExporter(exporter);
  });

  describe('basic event recording', () => {
    it('should record request start', () => {
      collector.recordRequestStart('req-1', 'gpt-4o', 'openai');
      collector.flush();

      const events = exporter.getEvents();
      expect(events.length).toBe(1);
      expect(events[0]?.type).toBe('request_start');

      const reqEvent = events[0] as RequestEvent;
      expect(reqEvent.requestId).toBe('req-1');
      expect(reqEvent.model).toBe('gpt-4o');
      expect(reqEvent.provider).toBe('openai');
    });

    it('should record request complete', async () => {
      collector.recordRequestComplete(
        'req-1',
        'gpt-4o',
        'openai',
        { input: 100, output: 50, total: 150 },
        { input: 0.01, output: 0.02, total: 0.03 },
        250
      );
      await collector.flush();

      const events = exporter.getEvents();
      expect(events.length).toBe(1);

      const reqEvent = events[0] as RequestEvent;
      expect(reqEvent.type).toBe('request_complete');
      expect(reqEvent.tokens?.input).toBe(100);
      expect(reqEvent.tokens?.output).toBe(50);
      expect(reqEvent.cost?.total).toBe(0.03);
      expect(reqEvent.duration).toBe(250);
    });

    it('should record request error', async () => {
      collector.recordRequestError('req-1', 'gpt-4o', 'openai', 'Rate limited');
      await collector.flush();

      const events = exporter.getEvents();
      expect(events.length).toBe(1);

      const reqEvent = events[0] as RequestEvent;
      expect(reqEvent.type).toBe('request_error');
      expect(reqEvent.error).toBe('Rate limited');
    });
  });

  describe('cache events', () => {
    it('should record cache hit', async () => {
      collector.recordCacheHit('query-hash', 0.95, 500, 0.01);
      await collector.flush();

      const events = exporter.getEventsByType<CacheEvent>('cache_hit');
      expect(events.length).toBe(1);
      expect(events[0]?.similarity).toBe(0.95);
      expect(events[0]?.tokensSaved).toBe(500);
    });

    it('should record cache miss', async () => {
      collector.recordCacheMiss('query-hash');
      await collector.flush();

      const events = exporter.getEventsByType<CacheEvent>('cache_miss');
      expect(events.length).toBe(1);
    });

    it('should record cache write', async () => {
      collector.recordCacheWrite('query-hash', 3600);
      await collector.flush();

      const events = exporter.getEventsByType<CacheEvent>('cache_write');
      expect(events.length).toBe(1);
      expect(events[0]?.ttl).toBe(3600);
    });
  });

  describe('budget events', () => {
    it('should record budget warning', async () => {
      collector.recordBudgetWarning(3500, 4000, 'request');
      await collector.flush();

      const events = exporter.getEvents();
      expect(events.length).toBe(1);
      expect(events[0]?.type).toBe('budget_warning');
    });

    it('should record budget exceeded', async () => {
      collector.recordBudgetExceeded(4500, 4000, 'session');
      await collector.flush();

      const events = exporter.getEvents();
      expect(events.length).toBe(1);
      expect(events[0]?.type).toBe('budget_exceeded');
    });
  });

  describe('optimization events', () => {
    it('should record trim', async () => {
      collector.recordTrim(5000, 3000, 'oldest-first');
      await collector.flush();

      const events = exporter.getEvents();
      expect(events.length).toBe(1);
      expect(events[0]?.type).toBe('trim_applied');
    });

    it('should record compression', async () => {
      collector.recordCompression(1000, 600, 'extractive');
      await collector.flush();

      const events = exporter.getEvents();
      expect(events.length).toBe(1);
      expect(events[0]?.type).toBe('compression_applied');
    });
  });

  describe('subscriptions', () => {
    it('should notify subscribers', () => {
      const handler = vi.fn();
      collector.subscribe(handler);

      collector.recordCacheMiss('key');

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler.mock.calls[0][0].type).toBe('cache_miss');
    });

    it('should filter by event type', () => {
      const handler = vi.fn();
      collector.subscribe(handler, ['cache_hit']);

      collector.recordCacheMiss('key');
      collector.recordCacheHit('key', 0.9, 100, 0.01);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler.mock.calls[0][0].type).toBe('cache_hit');
    });

    it('should unsubscribe', () => {
      const handler = vi.fn();
      const id = collector.subscribe(handler);

      collector.recordCacheMiss('key1');
      collector.unsubscribe(id);
      collector.recordCacheMiss('key2');

      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe('metrics aggregation', () => {
    it('should aggregate request metrics', async () => {
      collector.recordRequestComplete(
        'req-1', 'gpt-4o', 'openai',
        { input: 100, output: 50, total: 150 },
        { input: 0.01, output: 0.02, total: 0.03 },
        100
      );
      collector.recordRequestComplete(
        'req-2', 'gpt-4o', 'openai',
        { input: 200, output: 100, total: 300 },
        { input: 0.02, output: 0.04, total: 0.06 },
        200
      );

      const metrics = collector.getMetrics();

      expect(metrics.successfulRequests).toBe(2);
      expect(metrics.tokens.input).toBe(300);
      expect(metrics.tokens.output).toBe(150);
      expect(metrics.costs.total).toBe(0.09);
      expect(metrics.avgLatency).toBe(150);
    });

    it('should aggregate cache metrics', async () => {
      collector.recordCacheHit('key1', 0.95, 100, 0.01);
      collector.recordCacheHit('key2', 0.90, 200, 0.02);
      collector.recordCacheMiss('key3');

      const metrics = collector.getMetrics();

      expect(metrics.cache.hits).toBe(2);
      expect(metrics.cache.misses).toBe(1);
      expect(metrics.cache.hitRate).toBeCloseTo(2 / 3, 2);
      expect(metrics.cache.tokensSaved).toBe(300);
    });

    it('should aggregate by model', async () => {
      collector.recordRequestComplete(
        'req-1', 'gpt-4o', 'openai',
        { input: 100, output: 50, total: 150 },
        { input: 0.01, output: 0.02, total: 0.03 },
        100
      );
      collector.recordRequestComplete(
        'req-2', 'claude-3-opus', 'anthropic',
        { input: 200, output: 100, total: 300 },
        { input: 0.03, output: 0.06, total: 0.09 },
        200
      );

      const metrics = collector.getMetrics();

      expect(metrics.byModel['gpt-4o']?.requests).toBe(1);
      expect(metrics.byModel['claude-3-opus']?.requests).toBe(1);
      expect(metrics.byProvider['openai']?.cost).toBe(0.03);
      expect(metrics.byProvider['anthropic']?.cost).toBe(0.09);
    });

    it('should reset metrics', async () => {
      collector.recordRequestComplete(
        'req-1', 'gpt-4o', 'openai',
        { input: 100, output: 50, total: 150 },
        { input: 0.01, output: 0.02, total: 0.03 },
        100
      );

      collector.resetMetrics();
      const metrics = collector.getMetrics();

      expect(metrics.successfulRequests).toBe(0);
      expect(metrics.tokens.total).toBe(0);
    });
  });

  describe('sampling', () => {
    it('should sample events', async () => {
      const sampledCollector = createTelemetryCollector({
        enabled: true,
        sampleRate: 0.5,
        flushInterval: 0,
      });
      const sampledExporter = new MemoryExporter();
      sampledCollector.addExporter(sampledExporter);

      // Record many events
      for (let i = 0; i < 100; i++) {
        sampledCollector.recordCacheMiss(`key-${i}`);
      }
      await sampledCollector.flush();

      // Should have approximately 50 events (with variance)
      const events = sampledExporter.getEvents();
      expect(events.length).toBeGreaterThan(20);
      expect(events.length).toBeLessThan(80);

      await sampledCollector.shutdown();
    });
  });

  describe('configuration', () => {
    it('should disable when enabled is false', async () => {
      collector.updateConfig({ enabled: false });

      collector.recordCacheMiss('key');
      await collector.flush();

      expect(exporter.eventCount).toBe(0);
    });

    it('should add global attributes', async () => {
      const attrCollector = createTelemetryCollector({
        enabled: true,
        flushInterval: 0,
        globalAttributes: {
          environment: 'test',
          version: '1.0.0',
        },
      });
      const attrExporter = new MemoryExporter();
      attrCollector.addExporter(attrExporter);

      attrCollector.recordRequestStart('req-1', 'gpt-4o', 'openai');
      await attrCollector.flush();

      const events = attrExporter.getEvents();
      const reqEvent = events[0] as RequestEvent;
      expect(reqEvent.metadata?.environment).toBe('test');
      expect(reqEvent.metadata?.version).toBe('1.0.0');

      await attrCollector.shutdown();
    });
  });

  describe('tracing', () => {
    it('should create spans when tracing enabled', () => {
      const tracingCollector = createTelemetryCollector({
        enabled: true,
        tracing: true,
        flushInterval: 0,
      });

      const span = tracingCollector.startSpan('test-operation');
      expect(span).not.toBeNull();
      expect(span?.name).toBe('test-operation');
      expect(span?.status).toBe('pending');

      tracingCollector.endSpan(span!.spanId);
      expect(span?.status).toBe('ok');
      expect(span?.duration).toBeGreaterThanOrEqual(0);

      tracingCollector.shutdown();
    });

    it('should create nested spans', () => {
      const tracingCollector = createTelemetryCollector({
        enabled: true,
        tracing: true,
        flushInterval: 0,
      });

      const parentSpan = tracingCollector.startSpan('parent');
      const childSpan = tracingCollector.startSpan('child', parentSpan?.spanId);

      expect(childSpan?.parentSpanId).toBe(parentSpan?.spanId);
      expect(childSpan?.traceId).toBe(parentSpan?.traceId);
      expect(parentSpan?.children).toContain(childSpan);

      tracingCollector.shutdown();
    });

    it('should add span attributes', () => {
      const tracingCollector = createTelemetryCollector({
        enabled: true,
        tracing: true,
        flushInterval: 0,
      });

      const span = tracingCollector.startSpan('test');
      tracingCollector.addSpanAttribute(span!.spanId, 'model', 'gpt-4o');
      tracingCollector.addSpanAttribute(span!.spanId, 'tokens', 100);

      expect(span?.attributes.model).toBe('gpt-4o');
      expect(span?.attributes.tokens).toBe(100);

      tracingCollector.shutdown();
    });

    it('should not create spans when tracing disabled', () => {
      const span = collector.startSpan('test');
      expect(span).toBeNull();
    });
  });

  describe('shutdown', () => {
    it('should flush and cleanup on shutdown', async () => {
      collector.recordCacheMiss('key');
      await collector.shutdown();

      expect(exporter.eventCount).toBe(1);

      // After shutdown, events should not be recorded
      collector.recordCacheMiss('key2');
      await collector.flush();
      expect(exporter.eventCount).toBe(1);
    });
  });
});

describe('Exporters', () => {
  describe('ConsoleExporter', () => {
    it('should log events', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const exporter = createConsoleExporter();

      await exporter.export([
        { type: 'cache_miss', timestamp: Date.now(), key: 'test' } as any,
      ]);

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('MemoryExporter', () => {
    it('should store and retrieve events', async () => {
      const exporter = createMemoryExporter();

      await exporter.export([
        { type: 'cache_miss', timestamp: Date.now(), key: 'test' } as any,
        { type: 'cache_hit', timestamp: Date.now(), key: 'test' } as any,
      ]);

      expect(exporter.eventCount).toBe(2);
      expect(exporter.getEventsByType('cache_miss').length).toBe(1);
    });

    it('should clear events', async () => {
      const exporter = createMemoryExporter();

      await exporter.export([
        { type: 'cache_miss', timestamp: Date.now(), key: 'test' } as any,
      ]);

      exporter.clear();
      expect(exporter.eventCount).toBe(0);
    });
  });

  describe('JSONLinesExporter', () => {
    it('should output JSON lines', async () => {
      const lines: string[] = [];
      const exporter = new JSONLinesExporter((line) => lines.push(line));

      await exporter.export([
        { type: 'cache_miss', timestamp: 123456, key: 'test' } as any,
      ]);

      expect(lines.length).toBe(1);
      const parsed = JSON.parse(lines[0]!);
      expect(parsed.type).toBe('cache_miss');
      expect(parsed.key).toBe('test');
    });
  });

  describe('CallbackExporter', () => {
    it('should call callbacks', async () => {
      const onEvents = vi.fn();
      const onSpans = vi.fn();

      const exporter = new CallbackExporter({ onEvents, onSpans });

      await exporter.export([{ type: 'cache_miss', timestamp: 123 } as any]);
      await exporter.exportSpans([{ spanId: 'span-1' } as any]);

      expect(onEvents).toHaveBeenCalledTimes(1);
      expect(onSpans).toHaveBeenCalledTimes(1);
    });
  });
});

describe('Global collector', () => {
  it('should provide global singleton', () => {
    const collector1 = getTelemetryCollector();
    const collector2 = getTelemetryCollector();

    expect(collector1).toBe(collector2);
  });

  it('should allow setting custom global collector', () => {
    const customCollector = createTelemetryCollector();
    setGlobalTelemetryCollector(customCollector);

    expect(getTelemetryCollector()).toBe(customCollector);
  });
});
