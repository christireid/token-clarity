/**
 * Tests for TokenDevtoolsPanel and useDevtools hook
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDevtools } from '../hooks/useDevtools.js';
import type { DevtoolsRequestEntry, DevtoolsMetrics } from '../components/TokenDevtoolsPanel.js';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
  };
})();

Object.defineProperty(global, 'localStorage', { value: localStorageMock });

describe('useDevtools', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it('should initialize with empty history', () => {
    const { result } = renderHook(() => useDevtools());

    expect(result.current.requestHistory).toEqual([]);
    expect(result.current.sessionStats.requestCount).toBe(0);
    expect(result.current.metrics.totalRequests).toBe(0);
  });

  it('should track a request', () => {
    const { result } = renderHook(() => useDevtools());

    act(() => {
      result.current.trackRequest({
        model: 'gpt-4o',
        provider: 'openai',
        inputTokens: 100,
        outputTokens: 50,
        cachedTokens: 0,
        cost: 0.003,
        latency: 250,
      });
    });

    expect(result.current.requestHistory.length).toBe(1);
    expect(result.current.requestHistory[0]?.model).toBe('gpt-4o');
    expect(result.current.requestHistory[0]?.provider).toBe('openai');
    expect(result.current.requestHistory[0]?.inputTokens).toBe(100);
    expect(result.current.sessionStats.requestCount).toBe(1);
    expect(result.current.metrics.totalRequests).toBe(1);
  });

  it('should track multiple requests', () => {
    const { result } = renderHook(() => useDevtools());

    act(() => {
      result.current.trackRequest({
        model: 'gpt-4o',
        provider: 'openai',
        inputTokens: 100,
        outputTokens: 50,
        cachedTokens: 0,
        cost: 0.003,
        latency: 200,
      });
      result.current.trackRequest({
        model: 'claude-3-opus',
        provider: 'anthropic',
        inputTokens: 200,
        outputTokens: 100,
        cachedTokens: 50,
        cost: 0.009,
        latency: 300,
      });
    });

    expect(result.current.requestHistory.length).toBe(2);
    expect(result.current.metrics.totalRequests).toBe(2);
    expect(result.current.metrics.totalInputTokens).toBe(300);
    expect(result.current.metrics.totalOutputTokens).toBe(150);
    expect(result.current.metrics.totalCachedTokens).toBe(50);
    expect(result.current.metrics.totalCost).toBe(0.012);
  });

  it('should calculate metrics by model', () => {
    const { result } = renderHook(() => useDevtools());

    act(() => {
      result.current.trackRequest({
        model: 'gpt-4o',
        provider: 'openai',
        inputTokens: 100,
        outputTokens: 50,
        cachedTokens: 0,
        cost: 0.003,
        latency: 200,
      });
      result.current.trackRequest({
        model: 'gpt-4o',
        provider: 'openai',
        inputTokens: 150,
        outputTokens: 75,
        cachedTokens: 0,
        cost: 0.0045,
        latency: 250,
      });
    });

    expect(result.current.metrics.byModel['gpt-4o']).toBeDefined();
    expect(result.current.metrics.byModel['gpt-4o']?.requests).toBe(2);
    expect(result.current.metrics.byModel['gpt-4o']?.tokens).toBe(375);
    expect(result.current.metrics.byModel['gpt-4o']?.cost).toBe(0.0075);
  });

  it('should calculate metrics by provider', () => {
    const { result } = renderHook(() => useDevtools());

    act(() => {
      result.current.trackRequest({
        model: 'gpt-4o',
        provider: 'openai',
        inputTokens: 100,
        outputTokens: 50,
        cachedTokens: 0,
        cost: 0.003,
        latency: 200,
      });
      result.current.trackRequest({
        model: 'claude-3-opus',
        provider: 'anthropic',
        inputTokens: 200,
        outputTokens: 100,
        cachedTokens: 0,
        cost: 0.009,
        latency: 300,
      });
    });

    expect(result.current.metrics.byProvider['openai']?.requests).toBe(1);
    expect(result.current.metrics.byProvider['anthropic']?.requests).toBe(1);
    expect(result.current.metrics.byProvider['openai']?.cost).toBe(0.003);
    expect(result.current.metrics.byProvider['anthropic']?.cost).toBe(0.009);
  });

  it('should calculate cache hit rate', () => {
    const { result } = renderHook(() => useDevtools());

    act(() => {
      // Cache hit
      result.current.trackRequest({
        model: 'gpt-4o',
        provider: 'openai',
        inputTokens: 100,
        outputTokens: 50,
        cachedTokens: 50,
        cost: 0.002,
        latency: 150,
      });
      // Cache miss
      result.current.trackRequest({
        model: 'gpt-4o',
        provider: 'openai',
        inputTokens: 100,
        outputTokens: 50,
        cachedTokens: 0,
        cost: 0.003,
        latency: 200,
      });
    });

    expect(result.current.metrics.cacheHitRate).toBe(0.5);
  });

  it('should calculate average latency', () => {
    const { result } = renderHook(() => useDevtools());

    act(() => {
      result.current.trackRequest({
        model: 'gpt-4o',
        provider: 'openai',
        inputTokens: 100,
        outputTokens: 50,
        cachedTokens: 0,
        cost: 0.003,
        latency: 200,
      });
      result.current.trackRequest({
        model: 'gpt-4o',
        provider: 'openai',
        inputTokens: 100,
        outputTokens: 50,
        cachedTokens: 0,
        cost: 0.003,
        latency: 400,
      });
    });

    expect(result.current.metrics.avgLatency).toBe(300);
  });

  it('should clear history', () => {
    const { result } = renderHook(() => useDevtools());

    act(() => {
      result.current.trackRequest({
        model: 'gpt-4o',
        provider: 'openai',
        inputTokens: 100,
        outputTokens: 50,
        cachedTokens: 0,
        cost: 0.003,
        latency: 200,
      });
    });

    expect(result.current.requestHistory.length).toBe(1);

    act(() => {
      result.current.clearHistory();
    });

    expect(result.current.requestHistory.length).toBe(0);
    expect(result.current.metrics.totalRequests).toBe(0);
  });

  it('should reset all tracking', () => {
    const { result } = renderHook(() => useDevtools());

    act(() => {
      result.current.trackRequest({
        model: 'gpt-4o',
        provider: 'openai',
        inputTokens: 100,
        outputTokens: 50,
        cachedTokens: 0,
        cost: 0.003,
        latency: 200,
      });
    });

    act(() => {
      result.current.reset();
    });

    expect(result.current.requestHistory.length).toBe(0);
    expect(result.current.sessionStats.requestCount).toBe(0);
  });

  it('should get request by ID', () => {
    const { result } = renderHook(() => useDevtools());

    act(() => {
      result.current.trackRequest({
        model: 'gpt-4o',
        provider: 'openai',
        inputTokens: 100,
        outputTokens: 50,
        cachedTokens: 0,
        cost: 0.003,
        latency: 200,
      });
    });

    const requestId = result.current.requestHistory[0]?.id;
    expect(requestId).toBeDefined();

    const request = result.current.getRequest(requestId!);
    expect(request).toBeDefined();
    expect(request?.model).toBe('gpt-4o');
  });

  it('should export history as JSON', () => {
    const { result } = renderHook(() => useDevtools());

    act(() => {
      result.current.trackRequest({
        model: 'gpt-4o',
        provider: 'openai',
        inputTokens: 100,
        outputTokens: 50,
        cachedTokens: 0,
        cost: 0.003,
        latency: 200,
      });
    });

    const exported = result.current.exportHistory();
    const parsed = JSON.parse(exported);

    expect(parsed.exportedAt).toBeDefined();
    expect(parsed.requests).toHaveLength(1);
    expect(parsed.metrics).toBeDefined();
    expect(parsed.requests[0].model).toBe('gpt-4o');
  });

  it('should import history from JSON', () => {
    const { result } = renderHook(() => useDevtools());

    const importData = {
      requests: [
        {
          id: 'test-id',
          timestamp: Date.now(),
          model: 'claude-3-opus',
          provider: 'anthropic',
          inputTokens: 200,
          outputTokens: 100,
          cachedTokens: 0,
          cost: 0.009,
          latency: 300,
        },
      ],
    };

    act(() => {
      result.current.importHistory(JSON.stringify(importData));
    });

    expect(result.current.requestHistory.length).toBe(1);
    expect(result.current.requestHistory[0]?.model).toBe('claude-3-opus');
  });

  it('should respect maxHistory limit', () => {
    const { result } = renderHook(() => useDevtools({ maxHistory: 2 }));

    act(() => {
      result.current.trackRequest({
        model: 'gpt-4o',
        provider: 'openai',
        inputTokens: 100,
        outputTokens: 50,
        cachedTokens: 0,
        cost: 0.003,
        latency: 200,
      });
      result.current.trackRequest({
        model: 'gpt-4o-mini',
        provider: 'openai',
        inputTokens: 100,
        outputTokens: 50,
        cachedTokens: 0,
        cost: 0.001,
        latency: 150,
      });
      result.current.trackRequest({
        model: 'claude-3-opus',
        provider: 'anthropic',
        inputTokens: 200,
        outputTokens: 100,
        cachedTokens: 0,
        cost: 0.009,
        latency: 300,
      });
    });

    expect(result.current.requestHistory.length).toBe(2);
    // First request should be gone, keeping the 2 most recent
    expect(result.current.requestHistory[0]?.model).toBe('gpt-4o-mini');
    expect(result.current.requestHistory[1]?.model).toBe('claude-3-opus');
  });

  it('should persist to localStorage when persistKey is provided', () => {
    const { result } = renderHook(() => useDevtools({ persistKey: 'test-key' }));

    act(() => {
      result.current.trackRequest({
        model: 'gpt-4o',
        provider: 'openai',
        inputTokens: 100,
        outputTokens: 50,
        cachedTokens: 0,
        cost: 0.003,
        latency: 200,
      });
    });

    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'devtools_test-key',
      expect.any(String)
    );
  });

  it('should calculate session stats correctly', () => {
    const { result } = renderHook(() => useDevtools());

    act(() => {
      result.current.trackRequest({
        model: 'gpt-4o',
        provider: 'openai',
        inputTokens: 100,
        outputTokens: 50,
        cachedTokens: 20,
        cost: 0.003,
        latency: 200,
      });
      result.current.trackRequest({
        model: 'gpt-4o',
        provider: 'openai',
        inputTokens: 150,
        outputTokens: 75,
        cachedTokens: 30,
        cost: 0.004,
        latency: 300,
      });
    });

    const stats = result.current.sessionStats;
    expect(stats.requestCount).toBe(2);
    expect(stats.inputTokens).toBe(250);
    expect(stats.outputTokens).toBe(125);
    expect(stats.cachedTokens).toBe(50);
    expect(stats.cost).toBe(0.007);
  });

  it('should generate unique request IDs', () => {
    const { result } = renderHook(() => useDevtools());

    act(() => {
      result.current.trackRequest({
        model: 'gpt-4o',
        provider: 'openai',
        inputTokens: 100,
        outputTokens: 50,
        cachedTokens: 0,
        cost: 0.003,
        latency: 200,
      });
      result.current.trackRequest({
        model: 'gpt-4o',
        provider: 'openai',
        inputTokens: 100,
        outputTokens: 50,
        cachedTokens: 0,
        cost: 0.003,
        latency: 200,
      });
    });

    const ids = result.current.requestHistory.map(r => r.id);
    expect(ids[0]).not.toBe(ids[1]);
    expect(ids[0]).toMatch(/^req_\d+_[a-z0-9]+$/);
  });
});

describe('DevtoolsMetrics calculation', () => {
  it('should handle empty history', () => {
    const { result } = renderHook(() => useDevtools());

    const metrics = result.current.metrics;
    expect(metrics.totalRequests).toBe(0);
    expect(metrics.cacheHitRate).toBe(0);
    expect(metrics.avgLatency).toBe(0);
    expect(metrics.tokensPerSecond).toBe(0);
  });

  it('should calculate tokens per second', () => {
    const { result } = renderHook(() => useDevtools());

    act(() => {
      // 150 tokens in 0.3 seconds = 500 tokens/sec
      result.current.trackRequest({
        model: 'gpt-4o',
        provider: 'openai',
        inputTokens: 100,
        outputTokens: 50,
        cachedTokens: 0,
        cost: 0.003,
        latency: 300,
      });
    });

    expect(result.current.metrics.tokensPerSecond).toBe(500);
  });
});
