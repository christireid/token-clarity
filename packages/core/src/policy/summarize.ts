/**
 * @module policy/summarize
 * Functions for summarizing messages to reduce token count
 */

import type { ChatMessage } from '../types/index.js';
import { estimateTokens, estimateChatTokens } from '../tokenizers/estimation.js';
import type {
  SummarizeAndTrimOptions,
  TrimResult,
  TokenBudget,
  Summarizer,
} from './types.js';

/**
 * Default extractive summarizer that extracts key points.
 * Use this as a fallback when no external summarizer is provided.
 *
 * @param messages - Messages to summarize
 * @returns Promise resolving to summary text
 *
 * @example
 * ```ts
 * const summary = await extractiveSummarizer(messages);
 * ```
 */
export function extractiveSummarizer(messages: ChatMessage[]): Promise<string> {
  // Extract key content from messages
  const content = messages
    .filter(m => m.role !== 'system')
    .map(m => m.content)
    .join('\n');

  // Simple extractive summary
  const sentences = content.split(/[.!?]+/).filter(s => s.trim());
  const keyPoints = sentences.slice(0, Math.min(3, sentences.length));

  return Promise.resolve(
    'Previous conversation summary:\n' +
    keyPoints.map(s => `- ${s.trim()}`).join('\n')
  );
}

/**
 * Summarize old messages and trim to fit budget.
 * Keeps recent messages intact while summarizing older ones.
 *
 * @param messages - Messages to process
 * @param budget - Token budget
 * @param options - Summarization options
 * @returns Trimmed messages with summary
 *
 * @example
 * ```ts
 * const result = await summarizeAndTrim(
 *   messages,
 *   { maxTokens: 4000, reserveForOutput: 1000 },
 *   {
 *     summarizer: async (msgs) => {
 *       // Call your summarization API
 *       return await callSummarizerAPI(msgs);
 *     },
 *     preserveRecent: 4,
 *   }
 * );
 * ```
 */
export async function summarizeAndTrim(
  messages: ChatMessage[],
  budget: TokenBudget,
  options: SummarizeAndTrimOptions
): Promise<TrimResult> {
  const {
    summarizer,
    summaryRole = 'system',
    summaryPrefix = 'Previous conversation summary:',
    preserveRecent = 2,
    maxSummaryTokens = 500,
  } = options;

  const effectiveMax = budget.maxTokens - (budget.reserveForOutput ?? 0);
  const tokensBefore = estimateChatTokens(messages);

  if (tokensBefore <= effectiveMax) {
    return {
      messages: [...messages],
      removed: [],
      tokensBefore,
      tokensAfter: tokensBefore,
      tokensSaved: 0,
      fitsWithinBudget: true,
    };
  }

  // Separate system messages, old messages, and recent messages
  const systemMessages = messages.filter(m => m.role === 'system');
  const conversationMessages = messages.filter(m => m.role !== 'system');

  const recentMessages = preserveRecent > 0
    ? conversationMessages.slice(-preserveRecent)
    : [];
  const oldMessages = preserveRecent > 0
    ? conversationMessages.slice(0, -preserveRecent)
    : conversationMessages;

  // If no old messages to summarize, just trim
  if (oldMessages.length === 0) {
    return {
      messages: [...systemMessages, ...recentMessages],
      removed: [],
      tokensBefore,
      tokensAfter: estimateChatTokens([...systemMessages, ...recentMessages]),
      tokensSaved: 0,
      fitsWithinBudget: true,
    };
  }

  // Generate summary of old messages
  const summary = await summarizer(oldMessages);

  // Truncate summary if too long
  const truncatedSummary = truncateToTokens(summary, maxSummaryTokens);

  const summaryMessage: ChatMessage = {
    role: summaryRole,
    content: summaryPrefix ? `${summaryPrefix}\n${truncatedSummary}` : truncatedSummary,
  };

  // Build final message list
  const finalMessages = summaryRole === 'system'
    ? [...systemMessages, summaryMessage, ...recentMessages]
    : [...systemMessages, summaryMessage, ...recentMessages];

  const tokensAfter = estimateChatTokens(finalMessages);

  return {
    messages: finalMessages,
    removed: oldMessages,
    tokensBefore,
    tokensAfter,
    tokensSaved: tokensBefore - tokensAfter,
    fitsWithinBudget: tokensAfter <= effectiveMax,
  };
}

/**
 * Truncate text to fit within token limit
 */
function truncateToTokens(text: string, maxTokens: number): string {
  const currentTokens = estimateTokens(text);
  if (currentTokens <= maxTokens) return text;

  // Estimate character ratio
  const ratio = maxTokens / currentTokens;
  const targetLength = Math.floor(text.length * ratio * 0.95); // 5% buffer

  return text.slice(0, targetLength) + '...';
}

/**
 * Create a summarizer from an async function
 *
 * @param fn - Async function that takes content and returns summary
 * @returns Summarizer function
 */
export function createSummarizer(
  fn: (content: string) => Promise<string>
): Summarizer {
  return async (messages: ChatMessage[]) => {
    const content = messages
      .map(m => `[${m.role}]: ${m.content}`)
      .join('\n\n');
    return fn(content);
  };
}

/**
 * Sliding window with summary.
 * Maintains a rolling summary while keeping recent messages.
 *
 * @param messages - All messages
 * @param windowSize - Number of recent messages to keep
 * @param summarizer - Function to summarize old messages
 * @returns Messages with summary replacing old content
 *
 * @example
 * ```ts
 * const sliding = await slidingWindowWithSummary(
 *   messages,
 *   6, // Keep last 6 messages
 *   async (msgs) => await summarize(msgs)
 * );
 * ```
 */
export async function slidingWindowWithSummary(
  messages: ChatMessage[],
  windowSize: number,
  summarizer: Summarizer
): Promise<ChatMessage[]> {
  const systemMessages = messages.filter(m => m.role === 'system');
  const conversationMessages = messages.filter(m => m.role !== 'system');

  if (conversationMessages.length <= windowSize) {
    return messages;
  }

  const recentMessages = conversationMessages.slice(-windowSize);
  const oldMessages = conversationMessages.slice(0, -windowSize);

  const summary = await summarizer(oldMessages);

  const summaryMessage: ChatMessage = {
    role: 'assistant',
    content: `[Summary of previous ${oldMessages.length} messages]\n${summary}`,
  };

  return [...systemMessages, summaryMessage, ...recentMessages];
}

/**
 * Incremental summarization that builds on previous summary.
 *
 * @param previousSummary - Previous summary (or empty for first run)
 * @param newMessages - New messages to incorporate
 * @param summarizer - Summarizer function
 * @returns Updated summary
 */
export async function incrementalSummarize(
  previousSummary: string,
  newMessages: ChatMessage[],
  summarizer: Summarizer
): Promise<string> {
  if (!previousSummary) {
    return summarizer(newMessages);
  }

  // Create a context message with the previous summary
  const contextMessage: ChatMessage = {
    role: 'assistant',
    content: `Previous summary: ${previousSummary}`,
  };

  // Summarize the combined context
  return summarizer([contextMessage, ...newMessages]);
}

/**
 * Extract key entities and facts from messages for summarization
 *
 * @param messages - Messages to extract from
 * @returns Key entities and facts
 */
export function extractKeyInfo(messages: ChatMessage[]): {
  entities: string[];
  facts: string[];
  questions: string[];
  decisions: string[];
} {
  const content = messages.map(m => m.content).join(' ');

  // Extract patterns
  const entities = [...new Set(
    (content.match(/[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*/g) ?? [])
  )];

  const facts = content
    .split(/[.!]/)
    .filter(s => s.includes(' is ') || s.includes(' was ') || s.includes(' are '))
    .map(s => s.trim())
    .filter(s => s.length > 20 && s.length < 200)
    .slice(0, 5);

  const questions = content
    .split(/[?]/)
    .filter(s => s.trim().length > 10)
    .map(s => s.trim() + '?')
    .slice(0, 5);

  const decisions = content
    .split(/[.]/)
    .filter(s =>
      s.includes('will ') ||
      s.includes('should ') ||
      s.includes('decided') ||
      s.includes('agreed')
    )
    .map(s => s.trim())
    .slice(0, 3);

  return { entities, facts, questions, decisions };
}

/**
 * Compress messages using extractive summarization
 *
 * @param messages - Messages to compress
 * @param ratio - Compression ratio (0-1)
 * @returns Compressed messages
 */
export function compressMessages(
  messages: ChatMessage[],
  ratio: number = 0.5
): ChatMessage[] {
  return messages.map(msg => {
    const sentences = msg.content.split(/(?<=[.!?])\s+/);
    const targetCount = Math.max(1, Math.ceil(sentences.length * ratio));
    const compressed = sentences.slice(0, targetCount).join(' ');

    return {
      ...msg,
      content: compressed,
    };
  });
}
