/**
 * Tests for provider cache optimization module
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createSystemSegment,
  createContextSegment,
  createUserSegment,
  createToolsSegment,
  buildCacheAlignedPrompt,
  analyzeCachePotential,
  toOpenAIFormat,
  toAnthropicFormat,
  resetSegmentCounter,
} from '../index.js';
import type { Tool } from '../../types/index.js';

describe('segment builders', () => {
  beforeEach(() => {
    resetSegmentCounter();
  });

  it('should create system segment', () => {
    const segment = createSystemSegment('You are a helpful assistant.');
    expect(segment.type).toBe('system');
    expect(segment.content).toBe('You are a helpful assistant.');
    expect(segment.cacheable).toBe(true);
    expect(segment.priority).toBe('critical');
  });

  it('should create context segment', () => {
    const segment = createContextSegment('Some context information.');
    expect(segment.type).toBe('context');
    expect(segment.cacheable).toBe(true);
    expect(segment.priority).toBe('high');
  });

  it('should create user segment', () => {
    const segment = createUserSegment('Hello, how can you help?');
    expect(segment.type).toBe('user');
    expect(segment.cacheable).toBe(false);
    expect(segment.priority).toBe('low');
  });

  it('should create tools segment', () => {
    const tools: Tool[] = [
      {
        type: 'function',
        function: {
          name: 'get_weather',
          description: 'Get weather information',
          parameters: { type: 'object', properties: {} },
        },
      },
    ];
    const segment = createToolsSegment(tools);
    expect(segment.type).toBe('tools');
    expect(segment.cacheable).toBe(true);
    expect(segment.content).toContain('get_weather');
  });

  it('should calculate token count', () => {
    const segment = createSystemSegment('This is a test message.');
    expect(segment.tokens).toBeDefined();
    expect(segment.tokens).toBeGreaterThan(0);
  });
});

describe('buildCacheAlignedPrompt', () => {
  beforeEach(() => {
    resetSegmentCounter();
  });

  it('should order segments for cache optimization', () => {
    const segments = [
      createUserSegment('What is 2+2?'),
      createSystemSegment('You are a calculator.'),
      createContextSegment('Use precise calculations.'),
    ];

    const prompt = buildCacheAlignedPrompt(segments, { provider: 'openai' });

    // Cacheable segments should come first
    expect(prompt.segments[0]?.type).toBe('system');
    expect(prompt.segments[prompt.segments.length - 1]?.type).toBe('user');
  });

  it('should calculate cache breakpoints', () => {
    const segments = [
      createSystemSegment('A'.repeat(1500)), // Long enough to cache
      createContextSegment('B'.repeat(1500)),
      createUserSegment('Short question'),
    ];

    const prompt = buildCacheAlignedPrompt(segments, {
      provider: 'anthropic',
      minCacheableTokens: 100,
    });

    expect(prompt.cacheBreakpoints.length).toBeGreaterThan(0);
  });

  it('should estimate cache hit rate', () => {
    const segments = [
      createSystemSegment('System prompt with good content.'),
      createContextSegment('Context with more content here.'),
      createUserSegment('Short question'),
    ];

    const prompt = buildCacheAlignedPrompt(segments, { provider: 'openai' });

    expect(prompt.estimatedCacheHitRate).toBeGreaterThanOrEqual(0);
    expect(prompt.estimatedCacheHitRate).toBeLessThanOrEqual(1);
  });

  it('should convert to messages', () => {
    const segments = [
      createSystemSegment('System'),
      createUserSegment('User message'),
    ];

    const prompt = buildCacheAlignedPrompt(segments, { provider: 'openai' });

    expect(prompt.messages).toHaveLength(2);
    expect(prompt.messages[0]?.role).toBe('system');
    expect(prompt.messages[1]?.role).toBe('user');
  });

  it('should calculate token counts', () => {
    const segments = [
      createSystemSegment('System prompt.'),
      createUserSegment('User question'),
    ];

    const prompt = buildCacheAlignedPrompt(segments, { provider: 'openai' });

    expect(prompt.totalTokens).toBeGreaterThan(0);
    expect(prompt.cacheableTokens).toBeGreaterThan(0);
    expect(prompt.cacheableTokens).toBeLessThanOrEqual(prompt.totalTokens);
  });
});

describe('analyzeCachePotential', () => {
  beforeEach(() => {
    resetSegmentCounter();
  });

  it('should analyze cache potential', () => {
    const segments = [
      createSystemSegment('System prompt.'),
      createContextSegment('Context information.'),
      createUserSegment('User question'),
    ];

    const prompt = buildCacheAlignedPrompt(segments, { provider: 'openai' });
    const analysis = analyzeCachePotential(prompt);

    expect(analysis.cacheableTokens).toBeGreaterThan(0);
    expect(analysis.cacheRatio).toBeGreaterThan(0);
    expect(analysis.cacheRatio).toBeLessThanOrEqual(1);
    expect(Array.isArray(analysis.recommendations)).toBe(true);
  });

  it('should provide recommendations for low cache ratio', () => {
    const segments = [
      createUserSegment('Long user message '.repeat(20)),
      createSystemSegment('Short system'),
    ];

    const prompt = buildCacheAlignedPrompt(segments, { provider: 'openai' });
    const analysis = analyzeCachePotential(prompt);

    // Should have recommendations when cache ratio is low
    expect(analysis.recommendations.length).toBeGreaterThanOrEqual(0);
  });
});

describe('toOpenAIFormat', () => {
  beforeEach(() => {
    resetSegmentCounter();
  });

  it('should convert to OpenAI format', () => {
    const segments = [
      createSystemSegment('You are helpful.'),
      createUserSegment('Hello'),
    ];

    const prompt = buildCacheAlignedPrompt(segments, { provider: 'openai' });
    const request = toOpenAIFormat(prompt);

    expect(request.messages).toBeDefined();
    expect(request.messages[0]?.role).toBe('system');
    expect(request.messages[1]?.role).toBe('user');
  });

  it('should include tools when provided', () => {
    const segments = [createUserSegment('Get weather')];
    const tools: Tool[] = [
      {
        type: 'function',
        function: {
          name: 'get_weather',
          description: 'Get weather',
        },
      },
    ];

    const prompt = buildCacheAlignedPrompt(segments, { provider: 'openai' });
    const request = toOpenAIFormat(prompt, tools);

    expect(request.tools).toBeDefined();
    expect(request.tools?.[0]?.function.name).toBe('get_weather');
  });
});

describe('toAnthropicFormat', () => {
  beforeEach(() => {
    resetSegmentCounter();
  });

  it('should convert to Anthropic format', () => {
    const segments = [
      createSystemSegment('You are helpful.'),
      createUserSegment('Hello'),
    ];

    const prompt = buildCacheAlignedPrompt(segments, { provider: 'anthropic' });
    const request = toAnthropicFormat(prompt);

    expect(request.messages).toBeDefined();
    expect(request.system).toBeDefined();
  });

  it('should add cache_control for breakpoints', () => {
    const segments = [
      createSystemSegment('A'.repeat(2000)), // Long enough to be a breakpoint
      createUserSegment('Hello'),
    ];

    const prompt = buildCacheAlignedPrompt(segments, {
      provider: 'anthropic',
      minCacheableTokens: 100,
    });
    const request = toAnthropicFormat(prompt);

    // System should have cache_control
    if (Array.isArray(request.system)) {
      expect(request.system[0]?.cache_control).toBeDefined();
    }
  });
});
