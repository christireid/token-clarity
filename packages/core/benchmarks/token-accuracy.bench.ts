/**
 * Token counting accuracy benchmarks
 *
 * These benchmarks ensure that our token counting remains accurate
 * and doesn't regress across versions.
 */

import { describe, bench, expect } from 'vitest';
import {
  estimateTokens,
  estimateChatTokens,
  estimateCost,
} from '../src/index.js';

// Test data
const SHORT_TEXT = 'Hello, world!';
const MEDIUM_TEXT = `
  The quick brown fox jumps over the lazy dog.
  This is a test of the token counting system.
  It should accurately count tokens for various text lengths.
`.repeat(10);
const LONG_TEXT = MEDIUM_TEXT.repeat(50);

const SIMPLE_MESSAGES = [
  { role: 'system' as const, content: 'You are a helpful assistant.' },
  { role: 'user' as const, content: 'Hello!' },
  { role: 'assistant' as const, content: 'Hi there! How can I help you today?' },
];

const COMPLEX_MESSAGES = [
  { role: 'system' as const, content: 'You are a helpful coding assistant.' },
  { role: 'user' as const, content: 'Can you write a function that calculates fibonacci numbers?' },
  { role: 'assistant' as const, content: `Sure! Here's a function that calculates fibonacci numbers:

\`\`\`typescript
function fibonacci(n: number): number {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}
\`\`\`

This is a recursive implementation. For better performance, you could use memoization or an iterative approach.` },
  { role: 'user' as const, content: 'Can you optimize it?' },
  { role: 'assistant' as const, content: `Here's an optimized version using memoization:

\`\`\`typescript
const memo = new Map<number, number>();

function fibonacci(n: number): number {
  if (n <= 1) return n;
  if (memo.has(n)) return memo.get(n)!;

  const result = fibonacci(n - 1) + fibonacci(n - 2);
  memo.set(n, result);
  return result;
}
\`\`\`

This version has O(n) time complexity instead of O(2^n).` },
];

describe('Token Counting Performance', () => {
  bench('estimate tokens - short text', () => {
    estimateTokens(SHORT_TEXT);
  });

  bench('estimate tokens - medium text', () => {
    estimateTokens(MEDIUM_TEXT);
  });

  bench('estimate tokens - long text', () => {
    estimateTokens(LONG_TEXT);
  });

  bench('estimate chat tokens - simple messages', () => {
    estimateChatTokens(SIMPLE_MESSAGES);
  });

  bench('estimate chat tokens - complex messages', () => {
    estimateChatTokens(COMPLEX_MESSAGES);
  });
});

describe('Token Counting Accuracy', () => {
  bench('accuracy check - known values', () => {
    // These are known token counts that should not regress
    const shortTokens = estimateTokens(SHORT_TEXT);
    expect(shortTokens).toBeGreaterThan(0);
    expect(shortTokens).toBeLessThan(10); // "Hello, world!" is ~3-4 tokens

    const mediumTokens = estimateTokens(MEDIUM_TEXT);
    expect(mediumTokens).toBeGreaterThan(200);
    expect(mediumTokens).toBeLessThan(600);
  });
});

describe('Cost Estimation Performance', () => {
  bench('estimate cost - gpt-4o', () => {
    estimateCost('gpt-4o', 1000, 500, 100);
  });

  bench('estimate cost - claude-3-opus', () => {
    estimateCost('claude-3-opus-20240229', 1000, 500, 100);
  });

  bench('estimate cost - all supported models', () => {
    const models = [
      'gpt-4o',
      'gpt-4o-mini',
      'gpt-4-turbo',
      'gpt-3.5-turbo',
      'claude-3-opus-20240229',
      'claude-3-sonnet-20240229',
      'claude-3-haiku-20240307',
      'gemini-1.5-pro',
      'gemini-1.5-flash',
    ];

    for (const model of models) {
      estimateCost(model, 1000, 500, 100);
    }
  });
});

describe('Cost Estimation Accuracy', () => {
  bench('accuracy check - gpt-4o cost', () => {
    const cost = estimateCost('gpt-4o', 1000, 500);

    // GPT-4o pricing: $2.50/1M input, $10/1M output
    // 1000 input tokens = $0.0025
    // 500 output tokens = $0.005
    // Total = $0.0075
    expect(cost.totalCost).toBeGreaterThan(0.006);
    expect(cost.totalCost).toBeLessThan(0.009);
  });

  bench('accuracy check - cached tokens savings', () => {
    const withoutCache = estimateCost('gpt-4o', 1000, 500, 0);
    const withCache = estimateCost('gpt-4o', 1000, 500, 500);

    // Cached tokens should reduce cost
    expect(withCache.totalCost).toBeLessThan(withoutCache.totalCost);

    // Savings should be calculated
    expect(withCache.savings?.fromCache).toBeGreaterThan(0);
  });
});
