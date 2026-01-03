/**
 * @module policy/pack
 * Functions for packing messages into context windows efficiently
 */

import type { ChatMessage } from '../types/index.js';
import { estimateChatTokens } from '../tokenizers/estimation.js';
import type {
  PrioritizedMessage,
  PackOptions,
  PackResult,
  MessageSegment,
} from './types.js';

/**
 * Pack messages into a context window efficiently.
 * Maximizes content quality within token budget.
 *
 * @param messages - Messages to pack
 * @param options - Packing options
 * @returns Pack result with messages and overflow
 *
 * @example
 * ```ts
 * const result = packContext(messages, {
 *   maxTokens: 4000,
 *   reserveForOutput: 1000,
 *   strategy: 'priority',
 * });
 *
 * console.log(`Using ${result.tokensUsed} tokens (${result.utilization * 100}%)`);
 * ```
 */
export function packContext(
  messages: PrioritizedMessage[],
  options: PackOptions
): PackResult<PrioritizedMessage> {
  const { maxTokens, reserveForOutput = 0, strategy = 'recency', systemFirst = true } = options;

  const effectiveMax = maxTokens - reserveForOutput;

  // Separate system messages
  const systemMessages = messages.filter(m => m.role === 'system');
  const nonSystemMessages = messages.filter(m => m.role !== 'system');

  // Start with system messages if requested
  const packed: PrioritizedMessage[] = systemFirst ? [...systemMessages] : [];
  const overflow: PrioritizedMessage[] = [];
  let tokensUsed = systemFirst ? estimateChatTokens(systemMessages) : 0;

  // Sort remaining messages by strategy
  const sorted = sortByStrategy(nonSystemMessages, strategy);

  // Pack messages
  for (const message of sorted) {
    const messageTokens = estimateChatTokens([message]);

    if (tokensUsed + messageTokens <= effectiveMax) {
      packed.push(message);
      tokensUsed += messageTokens;
    } else {
      overflow.push(message);
    }
  }

  // Ensure messages maintain original order
  const originalOrder = new Map(messages.map((m, i) => [m, i]));
  packed.sort((a, b) => (originalOrder.get(a) ?? 0) - (originalOrder.get(b) ?? 0));

  return {
    messages: packed,
    overflow,
    utilization: tokensUsed / effectiveMax,
    tokensUsed,
    tokensRemaining: effectiveMax - tokensUsed,
  };
}

/**
 * Sort messages by packing strategy
 */
function sortByStrategy(
  messages: PrioritizedMessage[],
  strategy: 'priority' | 'recency' | 'mixed'
): PrioritizedMessage[] {
  switch (strategy) {
    case 'priority':
      return [...messages].sort((a, b) => {
        const priorityOrder = ['required', 'high', 'medium', 'low', 'optional'];
        const aIndex = priorityOrder.indexOf(a.priority ?? 'medium');
        const bIndex = priorityOrder.indexOf(b.priority ?? 'medium');
        return aIndex - bIndex;
      });

    case 'recency':
      // Already in chronological order, prefer recent
      return [...messages].reverse();

    case 'mixed':
      // Combine priority and recency
      return [...messages].sort((a, b) => {
        const priorityOrder = ['required', 'high', 'medium', 'low', 'optional'];
        const aIndex = priorityOrder.indexOf(a.priority ?? 'medium');
        const bIndex = priorityOrder.indexOf(b.priority ?? 'medium');

        // Primary sort by priority
        if (aIndex !== bIndex) return aIndex - bIndex;

        // Secondary sort by recency (original index)
        const originalIndex = (msg: PrioritizedMessage) =>
          messages.indexOf(msg);
        return originalIndex(b) - originalIndex(a);
      });
  }
}

/**
 * Segment messages for cache-aware processing.
 * Groups messages into cacheable and dynamic segments.
 *
 * @param messages - Messages to segment
 * @returns Array of message segments
 *
 * @example
 * ```ts
 * const segments = segmentMessages(messages);
 * segments.forEach(seg => {
 *   console.log(`${seg.type}: ${seg.tokens} tokens, cacheable: ${seg.cacheable}`);
 * });
 * ```
 */
export function segmentMessages(messages: ChatMessage[]): MessageSegment[] {
  const segments: MessageSegment[] = [];
  let currentSegment: MessageSegment | null = null;

  for (const message of messages) {
    const type = getMessageType(message);
    const cacheable = type === 'system' || type === 'static';

    if (currentSegment && currentSegment.type === type) {
      // Add to current segment
      currentSegment.messages.push(message);
      currentSegment.tokens = estimateChatTokens(currentSegment.messages);
    } else {
      // Start new segment
      if (currentSegment) {
        segments.push(currentSegment);
      }
      currentSegment = {
        messages: [message],
        tokens: estimateChatTokens([message]),
        cacheable,
        type,
      };
    }
  }

  if (currentSegment) {
    segments.push(currentSegment);
  }

  return segments;
}

/**
 * Determine message type for segmentation
 */
function getMessageType(message: ChatMessage): 'system' | 'static' | 'dynamic' {
  if (message.role === 'system') return 'system';

  // Heuristics for static content
  const content = message.content;
  if (
    content.length > 1000 && // Long content
    !content.includes('{{') && // No templates
    !/\b(today|now|current|latest)\b/i.test(content) // No temporal refs
  ) {
    return 'static';
  }

  return 'dynamic';
}

/**
 * Merge segments for efficient processing.
 * Combines adjacent segments of the same type.
 *
 * @param segments - Segments to merge
 * @returns Merged segments
 */
export function mergeSegments(segments: MessageSegment[]): MessageSegment[] {
  if (segments.length === 0) return [];

  const merged: MessageSegment[] = [];
  let current = { ...segments[0]!, messages: [...segments[0]!.messages] };

  for (let i = 1; i < segments.length; i++) {
    const segment = segments[i]!;

    if (segment.type === current.type) {
      current.messages.push(...segment.messages);
      current.tokens = estimateChatTokens(current.messages);
    } else {
      merged.push(current);
      current = { ...segment, messages: [...segment.messages] };
    }
  }

  merged.push(current);
  return merged;
}

/**
 * Calculate optimal message distribution across multiple turns.
 * Useful for chunking long contexts.
 *
 * @param messages - Messages to distribute
 * @param maxTokensPerTurn - Maximum tokens per turn
 * @returns Array of message arrays for each turn
 */
export function distributeAcrossTurns(
  messages: ChatMessage[],
  maxTokensPerTurn: number
): ChatMessage[][] {
  const turns: ChatMessage[][] = [];
  let currentTurn: ChatMessage[] = [];
  let currentTokens = 0;

  // System messages go in every turn
  const systemMessages = messages.filter(m => m.role === 'system');
  const systemTokens = estimateChatTokens(systemMessages);
  const conversationMessages = messages.filter(m => m.role !== 'system');

  for (const message of conversationMessages) {
    const messageTokens = estimateChatTokens([message]);

    if (currentTokens + messageTokens + systemTokens > maxTokensPerTurn) {
      if (currentTurn.length > 0) {
        turns.push([...systemMessages, ...currentTurn]);
        currentTurn = [];
        currentTokens = 0;
      }
    }

    currentTurn.push(message);
    currentTokens += messageTokens;
  }

  if (currentTurn.length > 0) {
    turns.push([...systemMessages, ...currentTurn]);
  }

  return turns;
}

/**
 * Interleave messages from multiple sources by priority.
 *
 * @param sources - Named sources with their messages
 * @param priorities - Priority for each source (higher = more important)
 * @param maxMessages - Maximum total messages to include
 * @returns Interleaved messages
 */
export function interleaveByPriority(
  sources: Record<string, ChatMessage[]>,
  priorities: Record<string, number>,
  maxMessages: number
): ChatMessage[] {
  // Create weighted pool
  type WeightedMessage = { message: ChatMessage; source: string; priority: number };
  const pool: WeightedMessage[] = [];

  for (const [source, messages] of Object.entries(sources)) {
    const priority = priorities[source] ?? 1;
    for (const message of messages) {
      pool.push({ message, source, priority });
    }
  }

  // Sort by priority (descending)
  pool.sort((a, b) => b.priority - a.priority);

  // Take top messages
  return pool.slice(0, maxMessages).map(w => w.message);
}

/**
 * Calculate context window utilization metrics.
 *
 * @param messages - Current messages
 * @param maxTokens - Maximum context tokens
 * @returns Utilization metrics
 */
export function calculateUtilization(
  messages: ChatMessage[],
  maxTokens: number
): {
  totalTokens: number;
  utilization: number;
  headroom: number;
  systemTokens: number;
  conversationTokens: number;
  averageMessageTokens: number;
} {
  const systemMessages = messages.filter(m => m.role === 'system');
  const conversationMessages = messages.filter(m => m.role !== 'system');

  const systemTokens = estimateChatTokens(systemMessages);
  const conversationTokens = estimateChatTokens(conversationMessages);
  const totalTokens = systemTokens + conversationTokens;

  return {
    totalTokens,
    utilization: totalTokens / maxTokens,
    headroom: maxTokens - totalTokens,
    systemTokens,
    conversationTokens,
    averageMessageTokens: messages.length > 0 ? totalTokens / messages.length : 0,
  };
}
