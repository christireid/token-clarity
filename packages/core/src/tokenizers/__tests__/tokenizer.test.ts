/**
 * Tests for tokenizer module
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  estimateTokens,
  estimateChatTokens,
  createEstimationTokenizer,
  isWithinTokenLimit,
  normalizeModelName,
  DEFAULT_CHAT_OVERHEAD,
} from '../index.js';
import type { ChatMessage } from '../../types/index.js';

describe('estimateTokens', () => {
  it('should return 0 for empty string', () => {
    expect(estimateTokens('')).toBe(0);
  });

  it('should estimate tokens for simple text', () => {
    const text = 'Hello, world!';
    const tokens = estimateTokens(text);
    expect(tokens).toBeGreaterThan(0);
    expect(tokens).toBeLessThan(10);
  });

  it('should estimate tokens within reasonable range for English text', () => {
    const text = 'The quick brown fox jumps over the lazy dog.';
    const tokens = estimateTokens(text);
    // Actual GPT-4 tokens: ~10
    expect(tokens).toBeGreaterThanOrEqual(8);
    expect(tokens).toBeLessThanOrEqual(15);
  });

  it('should handle long text', () => {
    const text = 'This is a test. '.repeat(100);
    const tokens = estimateTokens(text);
    expect(tokens).toBeGreaterThan(100);
  });

  it('should account for code blocks', () => {
    const textWithCode = 'Here is code:\n```javascript\nconst x = 1;\n```';
    const textWithoutCode = 'Here is code: const x = 1;';
    const tokensWithCode = estimateTokens(textWithCode);
    const tokensWithoutCode = estimateTokens(textWithoutCode);
    expect(tokensWithCode).toBeGreaterThanOrEqual(tokensWithoutCode);
  });

  it('should handle URLs', () => {
    const textWithUrl = 'Visit https://example.com/path/to/page';
    const tokens = estimateTokens(textWithUrl);
    expect(tokens).toBeGreaterThan(5);
  });
});

describe('estimateChatTokens', () => {
  it('should return 0 for empty messages array', () => {
    expect(estimateChatTokens([])).toBe(0);
  });

  it('should include message overhead', () => {
    const messages: ChatMessage[] = [
      { role: 'user', content: 'Hi' },
    ];
    const tokens = estimateChatTokens(messages);
    // Should be content tokens + overhead
    expect(tokens).toBeGreaterThan(estimateTokens('Hi'));
  });

  it('should accumulate tokens for multiple messages', () => {
    const singleMessage: ChatMessage[] = [
      { role: 'user', content: 'Hello' },
    ];
    const multipleMessages: ChatMessage[] = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there!' },
      { role: 'user', content: 'How are you?' },
    ];

    const singleTokens = estimateChatTokens(singleMessage);
    const multipleTokens = estimateChatTokens(multipleMessages);

    expect(multipleTokens).toBeGreaterThan(singleTokens);
  });

  it('should handle messages with names', () => {
    const withName: ChatMessage[] = [
      { role: 'user', content: 'Hello', name: 'John' },
    ];
    const withoutName: ChatMessage[] = [
      { role: 'user', content: 'Hello' },
    ];

    const tokensWithName = estimateChatTokens(withName);
    const tokensWithoutName = estimateChatTokens(withoutName);

    expect(tokensWithName).toBeGreaterThan(tokensWithoutName);
  });
});

describe('createEstimationTokenizer', () => {
  let tokenizer: ReturnType<typeof createEstimationTokenizer>;

  beforeEach(() => {
    tokenizer = createEstimationTokenizer();
  });

  it('should have model set to estimation', () => {
    expect(tokenizer.model).toBe('estimation');
  });

  it('should count tokens', () => {
    expect(tokenizer.count('Hello, world!')).toBeGreaterThan(0);
  });

  it('should count chat tokens', () => {
    const messages: ChatMessage[] = [
      { role: 'user', content: 'Hello' },
    ];
    expect(tokenizer.countChat(messages)).toBeGreaterThan(0);
  });

  it('should check if within limit', () => {
    expect(tokenizer.isWithinLimit('Hello', 100)).toBe(true);
    expect(tokenizer.isWithinLimit('Hello', 0)).toBe(false);
  });

  it('should truncate to limit', () => {
    const longText = 'This is a very long text that should be truncated. '.repeat(20);
    const truncated = tokenizer.truncateToLimit(longText, 10);
    expect(tokenizer.count(truncated)).toBeLessThanOrEqual(12); // Allow some tolerance
    expect(truncated.length).toBeLessThan(longText.length);
  });

  it('should not truncate if within limit', () => {
    const shortText = 'Hello';
    expect(tokenizer.truncateToLimit(shortText, 100)).toBe(shortText);
  });

  it('should throw when trying to decode', () => {
    expect(() => tokenizer.decode([1, 2, 3])).toThrow();
  });

  it('should encode to synthetic token array', () => {
    const tokens = tokenizer.encode('Hello');
    expect(Array.isArray(tokens)).toBe(true);
    expect(tokens.length).toBe(tokenizer.count('Hello'));
  });
});

describe('isWithinTokenLimit', () => {
  it('should return true for text within limit', () => {
    expect(isWithinTokenLimit('Hello', 100)).toBe(true);
  });

  it('should return false for text exceeding limit', () => {
    const longText = 'word '.repeat(1000);
    expect(isWithinTokenLimit(longText, 10)).toBe(false);
  });
});

describe('normalizeModelName', () => {
  it('should normalize OpenAI model names', () => {
    expect(normalizeModelName('gpt-4o-2024-01-01')).toBe('gpt-4o');
    expect(normalizeModelName('gpt-4o-mini-2024')).toBe('gpt-4o-mini');
    expect(normalizeModelName('gpt-4-turbo-preview')).toBe('gpt-4-turbo');
    expect(normalizeModelName('gpt-3.5-turbo-16k')).toBe('gpt-3.5-turbo');
  });

  it('should normalize Anthropic model names', () => {
    expect(normalizeModelName('claude-3-opus-20240229')).toBe('claude-3-opus');
    expect(normalizeModelName('claude-3-5-sonnet-20241022')).toBe('claude-3-5-sonnet');
    expect(normalizeModelName('claude-3.5-sonnet')).toBe('claude-3-5-sonnet');
  });

  it('should normalize Google model names', () => {
    expect(normalizeModelName('gemini-1.5-pro-latest')).toBe('gemini-1.5-pro');
    expect(normalizeModelName('gemini-pro-vision')).toBe('gemini-pro');
  });

  it('should handle case insensitivity', () => {
    expect(normalizeModelName('GPT-4O')).toBe('gpt-4o');
    expect(normalizeModelName('CLAUDE-3-OPUS')).toBe('claude-3-opus');
  });

  it('should fall back to gpt-4 for unknown models', () => {
    expect(normalizeModelName('unknown-model')).toBe('gpt-4');
  });
});

describe('DEFAULT_CHAT_OVERHEAD', () => {
  it('should have expected structure', () => {
    expect(DEFAULT_CHAT_OVERHEAD.perMessage).toBeGreaterThan(0);
    expect(DEFAULT_CHAT_OVERHEAD.conversationOverhead).toBeGreaterThan(0);
    expect(typeof DEFAULT_CHAT_OVERHEAD.nameOverhead).toBe('number');
    expect(DEFAULT_CHAT_OVERHEAD.toolCallOverhead).toBeGreaterThan(0);
  });
});
