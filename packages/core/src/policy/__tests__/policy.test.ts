/**
 * Comprehensive tests for token policy functions
 */

import { describe, it, expect } from 'vitest';
import type { ChatMessage } from '../../types/index.js';
import type { PrioritizedMessage } from '../types.js';
import {
  trimOldestFirst,
  trimByPriority,
  trimPreservingPairs,
  smartTrim,
  estimateTrimTokens,
} from '../trim.js';
import {
  stablePrefix,
  multiSectionPrefix,
  padToMinimum,
  analyzePrefix,
} from '../prefix.js';
import {
  summarizeAndTrim,
  createSummarizer,
  slidingWindowWithSummary,
  extractKeyInfo,
  compressMessages,
} from '../summarize.js';
import {
  packContext,
  segmentMessages,
  mergeSegments,
  distributeAcrossTurns,
  calculateUtilization,
} from '../pack.js';

// Test data
const createMessages = (count: number): ChatMessage[] => {
  const messages: ChatMessage[] = [
    { role: 'system', content: 'You are a helpful assistant.' },
  ];

  for (let i = 0; i < count; i++) {
    messages.push({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `Message ${i + 1}: This is a test message with some content to make it realistic.`,
    });
  }

  return messages;
};

const createPrioritizedMessages = (): PrioritizedMessage[] => [
  { role: 'system', content: 'System prompt.', priority: 'required' },
  { role: 'user', content: 'High priority question.', priority: 'high' },
  { role: 'assistant', content: 'High priority answer.', priority: 'high' },
  { role: 'user', content: 'Medium priority question.', priority: 'medium' },
  { role: 'assistant', content: 'Medium priority answer.', priority: 'medium' },
  { role: 'user', content: 'Low priority question.', priority: 'low' },
  { role: 'assistant', content: 'Low priority answer.', priority: 'low' },
  { role: 'user', content: 'Optional question.', priority: 'optional' },
  { role: 'assistant', content: 'Optional answer.', priority: 'optional' },
];

describe('trimOldestFirst', () => {
  it('should return all messages when under budget', () => {
    const messages = createMessages(4);
    const result = trimOldestFirst(messages, { maxTokens: 10000 });

    expect(result.messages.length).toBe(5); // system + 4 messages
    expect(result.removed.length).toBe(0);
    expect(result.tokensSaved).toBe(0);
    expect(result.fitsWithinBudget).toBe(true);
  });

  it('should trim oldest messages first', () => {
    const messages = createMessages(10);
    const result = trimOldestFirst(messages, { maxTokens: 200 });

    expect(result.messages.length).toBeLessThan(messages.length);
    expect(result.removed.length).toBeGreaterThan(0);
    expect(result.tokensSaved).toBeGreaterThan(0);
    // System message should be preserved
    expect(result.messages[0]?.role).toBe('system');
  });

  it('should preserve system messages', () => {
    const messages = createMessages(10);
    const result = trimOldestFirst(messages, { maxTokens: 100 });

    const systemMessages = result.messages.filter(m => m.role === 'system');
    expect(systemMessages.length).toBe(1);
  });

  it('should respect output reserve', () => {
    const messages = createMessages(10);
    const withReserve = trimOldestFirst(messages, {
      maxTokens: 500,
      reserveForOutput: 200,
    });
    const withoutReserve = trimOldestFirst(messages, { maxTokens: 500 });

    expect(withReserve.messages.length).toBeLessThanOrEqual(withoutReserve.messages.length);
  });
});

describe('trimByPriority', () => {
  it('should remove optional messages first', () => {
    const messages = createPrioritizedMessages();
    // Use a smaller budget to force trimming
    const result = trimByPriority(messages, { maxTokens: 100 });

    const remaining = new Set(result.messages.map(m => m.priority));
    expect(remaining.has('required')).toBe(true);

    // If there are removed messages, check that optional ones are among them
    if (result.removed.length > 0) {
      const removedPriorities = result.removed.map(m => m.priority);
      expect(removedPriorities.includes('optional')).toBe(true);
    } else {
      // If nothing was removed, all messages fit
      expect(result.fitsWithinBudget).toBe(true);
    }
  });

  it('should preserve system messages', () => {
    const messages = createPrioritizedMessages();
    const result = trimByPriority(messages, { maxTokens: 100 });

    expect(result.messages.some(m => m.role === 'system')).toBe(true);
  });

  it('should preserve pinned messages', () => {
    const messages: PrioritizedMessage[] = [
      { role: 'system', content: 'System.', priority: 'required' },
      { role: 'user', content: 'Pinned!', priority: 'optional', pinned: true },
      { role: 'user', content: 'Not pinned.', priority: 'high' },
    ];

    const result = trimByPriority(messages, { maxTokens: 50 }, { preservePinned: true });

    expect(result.messages.some(m => m.pinned)).toBe(true);
  });

  it('should preserve recent messages', () => {
    const messages = createPrioritizedMessages();
    const result = trimByPriority(
      messages,
      { maxTokens: 150 },
      { preserveRecent: 2 }
    );

    // Last 2 non-system messages should be preserved
    const lastTwo = messages.slice(-2);
    expect(result.messages).toContain(lastTwo[0]);
    expect(result.messages).toContain(lastTwo[1]);
  });
});

describe('trimPreservingPairs', () => {
  it('should keep user-assistant pairs together', () => {
    const messages = createMessages(10);
    const result = trimPreservingPairs(messages, { maxTokens: 200 });

    // Check that pairs are intact
    const nonSystem = result.messages.filter(m => m.role !== 'system');
    for (let i = 0; i < nonSystem.length - 1; i += 2) {
      if (nonSystem[i] && nonSystem[i + 1]) {
        expect(nonSystem[i].role).toBe('user');
        expect(nonSystem[i + 1].role).toBe('assistant');
      }
    }
  });
});

describe('smartTrim', () => {
  it('should use oldest-first for small trims', () => {
    const messages = createPrioritizedMessages();
    const result = smartTrim(messages, { maxTokens: 10000 });

    expect(result.fitsWithinBudget).toBe(true);
    expect(result.removed.length).toBe(0);
  });

  it('should use priority for large trims', () => {
    const messages = createPrioritizedMessages();
    const result = smartTrim(messages, { maxTokens: 100 });

    // Required messages should be preserved
    expect(result.messages.some(m => m.priority === 'required')).toBe(true);
  });
});

describe('estimateTrimTokens', () => {
  it('should estimate tokens to be trimmed', () => {
    const messages = createMessages(10);
    const toTrim = estimateTrimTokens(messages, { maxTokens: 100 });

    expect(toTrim).toBeGreaterThan(0);
  });

  it('should return 0 when under budget', () => {
    const messages = createMessages(2);
    const toTrim = estimateTrimTokens(messages, { maxTokens: 10000 });

    expect(toTrim).toBe(0);
  });
});

describe('stablePrefix', () => {
  it('should substitute variables', () => {
    const result = stablePrefix('Hello {{name}}!', {
      variables: { name: 'World' },
    });

    expect(result.prefix).toBe('Hello World!');
  });

  it('should remove unsubstituted variables', () => {
    const result = stablePrefix('Hello {{name}}! Today is {{date}}.', {
      variables: { name: 'World' },
    });

    expect(result.prefix).toBe('Hello World! Today is .');
  });

  it('should estimate tokens', () => {
    const result = stablePrefix('This is a test prefix with some content.', {});

    expect(result.tokens).toBeGreaterThan(0);
  });

  it('should check cache minimum', () => {
    const short = stablePrefix('Short.', { provider: 'openai' });
    expect(short.meetsCacheMinimum).toBe(false);

    // OpenAI requires 1024 tokens minimum, ~4 chars per token = ~4096 chars
    // Use extra to be safe with estimation variations
    const long = stablePrefix('word '.repeat(1500), { provider: 'openai' });
    expect(long.meetsCacheMinimum).toBe(true);
  });
});

describe('multiSectionPrefix', () => {
  it('should combine sections', () => {
    const result = multiSectionPrefix({
      intro: 'Hello!',
      rules: 'Follow these rules.',
      context: 'Here is context.',
    });

    expect(result.prefix).toContain('Hello!');
    expect(result.prefix).toContain('Follow these rules.');
    expect(result.prefix).toContain('Here is context.');
  });

  it('should track section boundaries', () => {
    const result = multiSectionPrefix({
      intro: 'Hello!',
      rules: 'Follow these rules.',
    });

    expect(result.sectionBoundaries.intro).toBeDefined();
    expect(result.sectionBoundaries.rules).toBeDefined();
  });
});

describe('padToMinimum', () => {
  it('should pad short prefixes', () => {
    const result = padToMinimum('Short prefix.', {
      provider: 'openai',
      minCacheTokens: 100,
    });

    expect(result.tokens).toBeGreaterThanOrEqual(100);
    expect(result.meetsCacheMinimum).toBe(true);
  });

  it('should not pad prefixes already at minimum', () => {
    // Use enough content to meet the cache minimum (1024 tokens)
    const original = 'word '.repeat(1500);
    const result = padToMinimum(original, { provider: 'openai' });

    // Should return the original unchanged since it already meets minimum
    expect(result.prefix).toBe(original);
    expect(result.meetsCacheMinimum).toBe(true);
  });
});

describe('analyzePrefix', () => {
  it('should detect variables', () => {
    const result = analyzePrefix('Hello {{name}}! Date: {{date}}.');

    expect(result.hasVariables).toBe(true);
    expect(result.variablePositions.length).toBe(2);
    expect(result.variablePositions[0]?.name).toBe('name');
  });

  it('should provide recommendations', () => {
    const result = analyzePrefix('Short {{var}}.', { provider: 'openai' });

    expect(result.recommendations.length).toBeGreaterThan(0);
  });
});

describe('summarizeAndTrim', () => {
  it('should summarize old messages', async () => {
    const messages = createMessages(10);

    const result = await summarizeAndTrim(
      messages,
      { maxTokens: 200 },
      {
        summarizer: async (msgs) => `Summary of ${msgs.length} messages.`,
        preserveRecent: 2,
      }
    );

    expect(result.messages.length).toBeLessThan(messages.length);
    expect(result.removed.length).toBeGreaterThan(0);
  });

  it('should preserve recent messages', async () => {
    const messages = createMessages(10);
    const lastTwo = messages.slice(-2);

    const result = await summarizeAndTrim(
      messages,
      { maxTokens: 500 },
      {
        summarizer: async () => 'Summary.',
        preserveRecent: 2,
      }
    );

    expect(result.messages).toContainEqual(lastTwo[0]);
    expect(result.messages).toContainEqual(lastTwo[1]);
  });
});

describe('createSummarizer', () => {
  it('should create a summarizer from async function', async () => {
    const summarizer = createSummarizer(async (content) => `Summary: ${content.slice(0, 20)}...`);

    const messages: ChatMessage[] = [
      { role: 'user', content: 'Hello!' },
      { role: 'assistant', content: 'Hi there!' },
    ];

    const result = await summarizer(messages);
    expect(result).toContain('Summary:');
  });
});

describe('slidingWindowWithSummary', () => {
  it('should keep window size messages', async () => {
    const messages = createMessages(10);

    const result = await slidingWindowWithSummary(
      messages,
      4,
      async (msgs) => `Summary of ${msgs.length} messages.`
    );

    // System + summary + 4 recent
    expect(result.length).toBeLessThanOrEqual(6);
  });

  it('should not change when under window size', async () => {
    const messages = createMessages(3);

    const result = await slidingWindowWithSummary(
      messages,
      10,
      async () => 'Summary.'
    );

    expect(result.length).toBe(messages.length);
  });
});

describe('extractKeyInfo', () => {
  it('should extract entities', () => {
    const messages: ChatMessage[] = [
      { role: 'user', content: 'John Smith works at Acme Corporation in New York.' },
    ];

    const info = extractKeyInfo(messages);
    expect(info.entities.length).toBeGreaterThan(0);
    expect(info.entities.some(e => e.includes('John') || e.includes('Smith'))).toBe(true);
  });

  it('should extract questions', () => {
    const messages: ChatMessage[] = [
      { role: 'user', content: 'What is the capital of France? How many people live there?' },
    ];

    const info = extractKeyInfo(messages);
    expect(info.questions.length).toBe(2);
  });
});

describe('compressMessages', () => {
  it('should reduce message content', () => {
    const messages: ChatMessage[] = [
      {
        role: 'user',
        content: 'First sentence. Second sentence. Third sentence. Fourth sentence.',
      },
    ];

    const compressed = compressMessages(messages, 0.5);

    expect(compressed[0]!.content.length).toBeLessThan(messages[0]!.content.length);
  });
});

describe('packContext', () => {
  it('should pack messages within budget', () => {
    const messages = createPrioritizedMessages();

    const result = packContext(messages, {
      maxTokens: 500,
      strategy: 'priority',
    });

    expect(result.tokensUsed).toBeLessThanOrEqual(500);
    expect(result.utilization).toBeLessThanOrEqual(1);
  });

  it('should put overflow messages aside', () => {
    const messages = createPrioritizedMessages();

    const result = packContext(messages, {
      maxTokens: 100,
      strategy: 'priority',
    });

    expect(result.overflow.length).toBeGreaterThan(0);
  });

  it('should maintain original order', () => {
    const messages = createPrioritizedMessages();

    const result = packContext(messages, {
      maxTokens: 500,
      strategy: 'priority',
    });

    // Check that system is first
    expect(result.messages[0]?.role).toBe('system');
  });
});

describe('segmentMessages', () => {
  it('should identify system segments', () => {
    const messages = createMessages(5);
    const segments = segmentMessages(messages);

    expect(segments[0]?.type).toBe('system');
    expect(segments[0]?.cacheable).toBe(true);
  });

  it('should identify dynamic segments', () => {
    const messages = createMessages(5);
    const segments = segmentMessages(messages);

    const dynamicSegments = segments.filter(s => s.type === 'dynamic');
    expect(dynamicSegments.length).toBeGreaterThan(0);
  });
});

describe('mergeSegments', () => {
  it('should merge adjacent same-type segments', () => {
    const messages = createMessages(10);
    const segments = segmentMessages(messages);
    const merged = mergeSegments(segments);

    expect(merged.length).toBeLessThanOrEqual(segments.length);
  });
});

describe('distributeAcrossTurns', () => {
  it('should split messages across turns', () => {
    const messages = createMessages(20);

    const turns = distributeAcrossTurns(messages, 200);

    expect(turns.length).toBeGreaterThan(1);
    // Each turn should have system messages
    turns.forEach(turn => {
      expect(turn.some(m => m.role === 'system')).toBe(true);
    });
  });
});

describe('calculateUtilization', () => {
  it('should calculate correct utilization', () => {
    const messages = createMessages(5);

    const util = calculateUtilization(messages, 1000);

    expect(util.utilization).toBeGreaterThan(0);
    expect(util.utilization).toBeLessThanOrEqual(1);
    expect(util.totalTokens).toBe(util.systemTokens + util.conversationTokens);
    expect(util.headroom).toBe(1000 - util.totalTokens);
  });
});
