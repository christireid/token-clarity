/**
 * @module compression/history
 * Conversation history compression and summarization
 */

import type { ChatMessage } from '../types/index.js';
import { estimateTokens } from '../tokenizers/estimation.js';
import type {
  SummarizeOptions,
  SummarizeResult,
  ImportanceOptions,
  ScoredMessage,
} from './types.js';

/**
 * Count named entities in text (simple heuristic)
 */
function countEntities(text: string): number {
  // Match capitalized words that aren't at sentence start
  const matches = text.match(/(?<!\.\s)[A-Z][a-z]+(?:\s[A-Z][a-z]+)*/g) ?? [];
  return matches.length;
}

/**
 * Check if message contains code
 */
function containsCode(text: string): boolean {
  return /```[\s\S]*?```|`[^`]+`/.test(text);
}

/**
 * Check if message is a question
 */
function isQuestion(text: string): boolean {
  return /\?/.test(text);
}

/**
 * Score a message based on importance
 */
function scoreMessage(
  message: ChatMessage,
  index: number,
  total: number,
  options: ImportanceOptions
): number {
  const {
    recencyWeight = 0.3,
    questionWeight = 0.2,
    entityWeight = 0.2,
    codeWeight = 0.15,
    lengthWeight = 0.15,
  } = options;

  let score = 0;

  // Recency: newer messages are more relevant
  const recency = index / Math.max(total - 1, 1);
  score += recency * recencyWeight;

  // Questions are often important
  if (isQuestion(message.content)) {
    score += questionWeight;
  }

  // Named entities indicate important context
  const entities = countEntities(message.content);
  const entityScore = Math.min(entities / 5, 1); // Cap at 5 entities
  score += entityScore * entityWeight;

  // Code blocks are often important
  if (containsCode(message.content)) {
    score += codeWeight;
  }

  // Moderate length messages often contain more substance
  const tokens = estimateTokens(message.content);
  const lengthScore =
    tokens < 10 ? 0.3 : tokens < 50 ? 0.7 : tokens < 200 ? 1 : 0.8;
  score += lengthScore * lengthWeight;

  // System messages are always important
  if (message.role === 'system') {
    score = 1;
  }

  return Math.min(score, 1);
}

/**
 * Select the most important messages within a token budget.
 *
 * @param messages - Array of chat messages
 * @param budget - Maximum tokens to use
 * @param options - Importance scoring options
 * @returns Selected messages in chronological order
 *
 * @example
 * ```ts
 * const selected = selectImportantMessages(messages, 2000, {
 *   recencyWeight: 0.4,
 *   questionWeight: 0.3,
 * });
 * ```
 */
export function selectImportantMessages(
  messages: ChatMessage[],
  budget: number,
  options: ImportanceOptions = {}
): ChatMessage[] {
  // Score all messages
  const scored: ScoredMessage[] = messages.map((message, index) => ({
    message,
    score: scoreMessage(message, index, messages.length, options),
    tokens: estimateTokens(message.content) + 4, // +4 for message overhead
    index,
  }));

  // Always include system messages first
  const systemMessages = scored.filter(s => s.message.role === 'system');
  const nonSystemMessages = scored.filter(s => s.message.role !== 'system');

  // Sort non-system by score (descending)
  nonSystemMessages.sort((a, b) => b.score - a.score);

  // Select messages within budget
  let usedTokens = systemMessages.reduce((sum, s) => sum + s.tokens, 0);
  const selected: ScoredMessage[] = [...systemMessages];

  for (const msg of nonSystemMessages) {
    if (usedTokens + msg.tokens <= budget) {
      selected.push(msg);
      usedTokens += msg.tokens;
    }
  }

  // Restore chronological order
  selected.sort((a, b) => a.index - b.index);

  return selected.map(s => s.message);
}

/**
 * Create a brief summary of messages.
 * This is a simple extractive approach - for better summaries,
 * use an LLM-based summarizer.
 *
 * @param messages - Messages to summarize
 * @returns Brief summary string
 */
function createBriefSummary(messages: ChatMessage[]): string {
  if (messages.length === 0) return '';

  // Extract key elements from each message
  const elements: string[] = [];

  for (const msg of messages) {
    if (msg.role === 'user') {
      // Extract first sentence or question
      const firstSentence = msg.content.split(/[.!?]/)[0];
      if (firstSentence && firstSentence.length < 200) {
        elements.push(`User asked about: ${firstSentence.trim()}`);
      }
    } else if (msg.role === 'assistant') {
      // Extract first sentence of response
      const firstSentence = msg.content.split(/[.!?]/)[0];
      if (firstSentence && firstSentence.length < 200) {
        elements.push(`Assistant discussed: ${firstSentence.trim()}`);
      }
    }
  }

  // Take first few elements
  return elements.slice(0, 5).join('. ') + '.';
}

/**
 * Summarize conversation history to fit within a token budget.
 *
 * @param messages - Messages to summarize
 * @param options - Summarization options
 * @returns Summarization result
 *
 * @example
 * ```ts
 * const result = summarizeHistory(messages, {
 *   maxTokens: 500,
 *   preserveRecent: 3,
 * });
 *
 * // Use result.summary + result.recentMessages for context
 * ```
 */
export function summarizeHistory(
  messages: ChatMessage[],
  options: SummarizeOptions
): SummarizeResult {
  const {
    maxTokens,
    preserveRecent = 2,
    preserveSystem = true,
    style = 'brief',
  } = options;

  if (messages.length === 0) {
    return {
      summary: '',
      recentMessages: [],
      totalTokens: 0,
      summarizedCount: 0,
      originalCount: 0,
    };
  }

  // Separate system messages
  const systemMessages = preserveSystem
    ? messages.filter(m => m.role === 'system')
    : [];

  const conversationMessages = preserveSystem
    ? messages.filter(m => m.role !== 'system')
    : [...messages];

  // Calculate tokens for system and recent messages
  const systemTokens = systemMessages.reduce(
    (sum, m) => sum + estimateTokens(m.content) + 4,
    0
  );

  // Handle special case where preserveRecent is 0 (slice(-0) = slice(0) = whole array)
  const recentMessages = preserveRecent > 0
    ? conversationMessages.slice(-preserveRecent)
    : [];
  const recentTokens = recentMessages.reduce(
    (sum, m) => sum + estimateTokens(m.content) + 4,
    0
  );

  // Messages to summarize
  const toSummarize = preserveRecent > 0
    ? conversationMessages.slice(0, -preserveRecent)
    : conversationMessages;

  if (toSummarize.length === 0) {
    return {
      summary: '',
      recentMessages: [...systemMessages, ...recentMessages],
      totalTokens: systemTokens + recentTokens,
      summarizedCount: 0,
      originalCount: messages.length,
    };
  }

  // Calculate remaining budget for summary
  const summaryBudget = Math.max(0, maxTokens - systemTokens - recentTokens);

  // Create summary based on style
  let summary = '';

  switch (style) {
    case 'brief':
      summary = createBriefSummary(toSummarize);
      break;

    case 'bullet-points': {
      const points = toSummarize.slice(0, 5).map(m => {
        const firstLine = m.content.split('\n')[0]?.slice(0, 100) ?? '';
        return `- ${m.role}: ${firstLine}`;
      });
      summary = 'Previous conversation:\n' + points.join('\n');
      break;
    }

    case 'detailed':
    default:
      summary = createBriefSummary(toSummarize);
  }

  // Truncate summary if needed
  const summaryTokens = estimateTokens(summary);
  if (summaryTokens > summaryBudget && summaryBudget > 0) {
    // Simple truncation - cut to fit
    const ratio = summaryBudget / summaryTokens;
    const targetLength = Math.floor(summary.length * ratio);
    summary = summary.slice(0, targetLength) + '...';
  }

  const finalSummaryTokens = estimateTokens(summary);

  return {
    summary,
    recentMessages: [...systemMessages, ...recentMessages],
    totalTokens: systemTokens + recentTokens + finalSummaryTokens,
    summarizedCount: toSummarize.length,
    originalCount: messages.length,
  };
}

/**
 * Sliding window context management.
 * Keeps recent messages and optionally summarizes older ones.
 *
 * @param messages - All messages
 * @param windowSize - Number of recent messages to keep
 * @param includeSummary - Whether to summarize older messages
 * @returns Messages with optional summary prepended
 */
export function slidingWindowContext(
  messages: ChatMessage[],
  windowSize: number,
  includeSummary = true
): ChatMessage[] {
  const systemMessages = messages.filter(m => m.role === 'system');
  const conversationMessages = messages.filter(m => m.role !== 'system');

  if (conversationMessages.length <= windowSize) {
    return messages;
  }

  const recentMessages = conversationMessages.slice(-windowSize);
  const olderMessages = conversationMessages.slice(0, -windowSize);

  const result: ChatMessage[] = [...systemMessages];

  if (includeSummary && olderMessages.length > 0) {
    const summaryResult = summarizeHistory(olderMessages, {
      maxTokens: 500,
      preserveRecent: 0,
      style: 'brief',
    });

    if (summaryResult.summary) {
      result.push({
        role: 'system',
        content: `[Previous conversation summary: ${summaryResult.summary}]`,
      });
    }
  }

  result.push(...recentMessages);

  return result;
}
