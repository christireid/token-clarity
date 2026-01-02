/**
 * Tests for compression module
 */

import { describe, it, expect } from 'vitest';
import {
  compressExtractive,
  quickCompress,
  selectImportantMessages,
  summarizeHistory,
  slidingWindowContext,
} from '../index.js';
import type { ChatMessage } from '../../types/index.js';

describe('compressExtractive', () => {
  it('should compress text to target ratio', () => {
    const text = 'This is the first sentence. This is the second sentence. ' +
      'This is the third sentence. This is the fourth sentence. ' +
      'This is the fifth sentence.';

    const result = compressExtractive(text, { targetRatio: 0.5 });

    expect(result.compressed.length).toBeLessThan(result.original.length);
    expect(result.compressionRatio).toBeLessThanOrEqual(1);
    expect(result.compressedTokens).toBeLessThanOrEqual(result.originalTokens);
  });

  it('should return empty result for empty input', () => {
    const result = compressExtractive('');

    expect(result.compressed).toBe('');
    expect(result.compressionRatio).toBe(1);
  });

  it('should preserve structure when requested', () => {
    const text = '# Header\n\nFirst paragraph. Second sentence.\n\n' +
      '- List item one\n- List item two';

    const result = compressExtractive(text, {
      targetRatio: 0.7,
      preserveStructure: true,
    });

    expect(result.compressed).toBeDefined();
  });

  it('should handle short text', () => {
    const text = 'Short.';
    const result = compressExtractive(text, { targetRatio: 0.5 });

    expect(result.compressed).toBeDefined();
  });
});

describe('quickCompress', () => {
  it('should quickly compress text', () => {
    const text = 'First sentence. Second sentence. Third sentence. ' +
      'Fourth sentence. Fifth sentence.';

    const compressed = quickCompress(text, 0.5);

    expect(compressed.length).toBeLessThan(text.length);
  });

  it('should include first and last sentences', () => {
    const text = 'First. Second. Third. Fourth. Fifth.';
    const compressed = quickCompress(text, 0.5);

    expect(compressed).toContain('First');
    expect(compressed).toContain('Fifth');
  });

  it('should handle single sentence', () => {
    const text = 'Just one sentence.';
    const compressed = quickCompress(text, 0.5);

    expect(compressed).toBe('Just one sentence.');
  });
});

describe('selectImportantMessages', () => {
  it('should select messages within budget', () => {
    const messages: ChatMessage[] = [
      { role: 'user', content: 'First question?' },
      { role: 'assistant', content: 'First answer.' },
      { role: 'user', content: 'Second question?' },
      { role: 'assistant', content: 'Second answer.' },
      { role: 'user', content: 'Third question?' },
    ];

    const selected = selectImportantMessages(messages, 50);

    expect(selected.length).toBeLessThanOrEqual(messages.length);
  });

  it('should prioritize recent messages', () => {
    const messages: ChatMessage[] = [
      { role: 'user', content: 'Old message' },
      { role: 'assistant', content: 'Old response' },
      { role: 'user', content: 'New message' },
    ];

    const selected = selectImportantMessages(messages, 30, {
      recencyWeight: 0.9,
    });

    // Most recent should be included
    expect(selected.some(m => m.content === 'New message')).toBe(true);
  });

  it('should always include system messages', () => {
    const messages: ChatMessage[] = [
      { role: 'system', content: 'System prompt' },
      { role: 'user', content: 'User message' },
    ];

    const selected = selectImportantMessages(messages, 100);

    expect(selected.some(m => m.role === 'system')).toBe(true);
  });

  it('should prioritize questions', () => {
    const messages: ChatMessage[] = [
      { role: 'user', content: 'Statement without question mark' },
      { role: 'user', content: 'Is this a question?' },
    ];

    const selected = selectImportantMessages(messages, 20, {
      questionWeight: 0.9,
    });

    expect(selected.some(m => m.content.includes('?'))).toBe(true);
  });
});

describe('summarizeHistory', () => {
  it('should summarize conversation history', () => {
    const messages: ChatMessage[] = [
      { role: 'user', content: 'What is machine learning?' },
      { role: 'assistant', content: 'Machine learning is a subset of AI...' },
      { role: 'user', content: 'How does it work?' },
      { role: 'assistant', content: 'It works by training models on data...' },
      { role: 'user', content: 'What are some examples?' },
    ];

    const result = summarizeHistory(messages, {
      maxTokens: 100,
      preserveRecent: 2,
    });

    expect(result.summary).toBeDefined();
    expect(result.recentMessages.length).toBe(2);
    expect(result.summarizedCount).toBeGreaterThan(0);
  });

  it('should preserve system messages', () => {
    const messages: ChatMessage[] = [
      { role: 'system', content: 'You are helpful.' },
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there!' },
      { role: 'user', content: 'How are you?' },
    ];

    const result = summarizeHistory(messages, {
      maxTokens: 100,
      preserveRecent: 1,
      preserveSystem: true,
    });

    expect(result.recentMessages.some(m => m.role === 'system')).toBe(true);
  });

  it('should handle empty messages', () => {
    const result = summarizeHistory([], { maxTokens: 100 });

    expect(result.summary).toBe('');
    expect(result.recentMessages).toHaveLength(0);
    expect(result.summarizedCount).toBe(0);
  });
});

describe('slidingWindowContext', () => {
  it('should keep recent messages', () => {
    const messages: ChatMessage[] = [
      { role: 'user', content: 'Message 1' },
      { role: 'assistant', content: 'Response 1' },
      { role: 'user', content: 'Message 2' },
      { role: 'assistant', content: 'Response 2' },
      { role: 'user', content: 'Message 3' },
    ];

    const windowed = slidingWindowContext(messages, 3);

    expect(windowed.length).toBeLessThanOrEqual(messages.length + 1); // +1 for potential summary
    expect(windowed.some(m => m.content === 'Message 3')).toBe(true);
  });

  it('should return all messages if within window', () => {
    const messages: ChatMessage[] = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi!' },
    ];

    const windowed = slidingWindowContext(messages, 5);

    expect(windowed).toHaveLength(2);
  });

  it('should include summary when requested', () => {
    const messages: ChatMessage[] = [
      { role: 'user', content: 'First message' },
      { role: 'assistant', content: 'First response' },
      { role: 'user', content: 'Second message' },
      { role: 'assistant', content: 'Second response' },
      { role: 'user', content: 'Third message' },
    ];

    const windowed = slidingWindowContext(messages, 2, true);

    // Should have summary + recent messages
    expect(windowed.some(m => m.content.includes('summary'))).toBe(true);
  });

  it('should preserve system messages', () => {
    const messages: ChatMessage[] = [
      { role: 'system', content: 'System prompt' },
      { role: 'user', content: 'Message 1' },
      { role: 'assistant', content: 'Response 1' },
      { role: 'user', content: 'Message 2' },
      { role: 'assistant', content: 'Response 2' },
    ];

    const windowed = slidingWindowContext(messages, 2);

    expect(windowed[0]?.role).toBe('system');
  });
});
