/**
 * @module policy/trim
 * Pure functions for trimming messages to fit within token budgets
 */

import type { ChatMessage } from '../types/index.js';
import { estimateChatTokens } from '../tokenizers/estimation.js';
import type {
  PrioritizedMessage,
  TokenBudget,
  TrimResult,
  TrimByPriorityOptions,
  MessagePriority,
} from './types.js';

/**
 * Default priority order for trimming (first items are removed first)
 */
const DEFAULT_PRIORITY_ORDER: MessagePriority[] = [
  'optional',
  'low',
  'medium',
  'high',
  'required',
];

/**
 * Priority weights for scoring
 */
const PRIORITY_WEIGHTS: Record<MessagePriority, number> = {
  required: 1.0,
  high: 0.8,
  medium: 0.5,
  low: 0.3,
  optional: 0.1,
};

/**
 * Estimate tokens for a single message including overhead
 */
function estimateMessageTokens(message: ChatMessage): number {
  return estimateChatTokens([message]);
}

/**
 * Trim messages using oldest-first strategy.
 * Removes the oldest messages first while preserving system messages.
 *
 * @param messages - Messages to trim
 * @param budget - Token budget
 * @returns Trim result
 *
 * @example
 * ```ts
 * const result = trimOldestFirst(messages, { maxTokens: 4000 });
 * console.log(`Kept ${result.messages.length} messages`);
 * console.log(`Saved ${result.tokensSaved} tokens`);
 * ```
 */
export function trimOldestFirst(
  messages: ChatMessage[],
  budget: TokenBudget
): TrimResult {
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

  // Separate system messages (preserved) from conversation
  const systemMessages = messages.filter(m => m.role === 'system');
  const conversationMessages = messages.filter(m => m.role !== 'system');

  const kept: ChatMessage[] = [...systemMessages];
  const removed: ChatMessage[] = [];
  let currentTokens = estimateChatTokens(systemMessages);

  // Add messages from newest to oldest until budget is reached
  for (let i = conversationMessages.length - 1; i >= 0; i--) {
    const message = conversationMessages[i]!;
    const messageTokens = estimateMessageTokens(message);

    if (currentTokens + messageTokens <= effectiveMax) {
      kept.unshift(message); // Insert at beginning to maintain order
      currentTokens += messageTokens;
    } else {
      // All older messages go to removed
      removed.unshift(...conversationMessages.slice(0, i + 1));
      break;
    }
  }

  // Restore system messages at the beginning
  const finalMessages = [...systemMessages, ...kept.filter(m => m.role !== 'system')];

  return {
    messages: finalMessages,
    removed,
    tokensBefore,
    tokensAfter: currentTokens,
    tokensSaved: tokensBefore - currentTokens,
    fitsWithinBudget: currentTokens <= effectiveMax,
  };
}

/**
 * Trim messages by priority.
 * Removes lowest priority messages first.
 *
 * @param messages - Messages with priority metadata
 * @param budget - Token budget
 * @param options - Trimming options
 * @returns Trim result
 *
 * @example
 * ```ts
 * const messages: PrioritizedMessage[] = [
 *   { role: 'system', content: '...', priority: 'required' },
 *   { role: 'user', content: '...', priority: 'high' },
 *   { role: 'assistant', content: '...', priority: 'low' },
 * ];
 *
 * const result = trimByPriority(messages, { maxTokens: 4000 });
 * ```
 */
export function trimByPriority(
  messages: PrioritizedMessage[],
  budget: TokenBudget,
  options: TrimByPriorityOptions = {}
): TrimResult<PrioritizedMessage> {
  const {
    priorityOrder = DEFAULT_PRIORITY_ORDER,
    preservePinned = true,
    preserveSystem = true,
    preserveRecent = 0,
    preserveFirst = 0,
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

  // Identify protected messages
  const isProtected = (msg: PrioritizedMessage, index: number): boolean => {
    if (preservePinned && msg.pinned) return true;
    if (preserveSystem && msg.role === 'system') return true;
    if (preserveRecent > 0 && index >= messages.length - preserveRecent) return true;
    if (preserveFirst > 0) {
      const nonSystemIndex = messages
        .filter(m => m.role !== 'system')
        .indexOf(msg);
      if (nonSystemIndex >= 0 && nonSystemIndex < preserveFirst) return true;
    }
    return false;
  };

  // Score messages (lower score = remove first)
  const scored = messages.map((msg, index) => ({
    message: msg,
    index,
    protected: isProtected(msg, index),
    score: getMessageScore(msg, priorityOrder),
    tokens: estimateMessageTokens(msg),
  }));

  // Sort by protection status, then by score (ascending = lowest score first to remove)
  const sortedForRemoval = [...scored].sort((a, b) => {
    if (a.protected !== b.protected) return a.protected ? 1 : -1;
    return a.score - b.score;
  });

  // Remove messages until we fit budget
  const toRemove = new Set<number>();
  let currentTokens = tokensBefore;

  for (const item of sortedForRemoval) {
    if (currentTokens <= effectiveMax) break;
    if (item.protected) continue;

    toRemove.add(item.index);
    currentTokens -= item.tokens;
  }

  const kept = messages.filter((_, i) => !toRemove.has(i));
  const removed = messages.filter((_, i) => toRemove.has(i));

  return {
    messages: kept,
    removed,
    tokensBefore,
    tokensAfter: currentTokens,
    tokensSaved: tokensBefore - currentTokens,
    fitsWithinBudget: currentTokens <= effectiveMax,
  };
}

/**
 * Calculate score for a message based on priority
 */
function getMessageScore(
  message: PrioritizedMessage,
  priorityOrder: MessagePriority[]
): number {
  // Custom weight takes precedence
  if (message.weight !== undefined) {
    return message.weight;
  }

  const priority = message.priority ?? 'medium';

  // Score based on position in priority order (higher = keep longer)
  const orderIndex = priorityOrder.indexOf(priority);
  if (orderIndex >= 0) {
    return (orderIndex + 1) / priorityOrder.length;
  }

  return PRIORITY_WEIGHTS[priority] ?? 0.5;
}

/**
 * Trim messages while preserving conversation pairs.
 * Ensures user-assistant pairs stay together.
 *
 * @param messages - Messages to trim
 * @param budget - Token budget
 * @returns Trim result
 */
export function trimPreservingPairs(
  messages: ChatMessage[],
  budget: TokenBudget
): TrimResult {
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

  // Group messages into pairs
  const systemMessages = messages.filter(m => m.role === 'system');
  const conversationMessages = messages.filter(m => m.role !== 'system');

  const pairs: ChatMessage[][] = [];
  let currentPair: ChatMessage[] = [];

  for (const msg of conversationMessages) {
    currentPair.push(msg);
    if (msg.role === 'assistant') {
      pairs.push(currentPair);
      currentPair = [];
    }
  }
  // Don't forget incomplete pair at the end
  if (currentPair.length > 0) {
    pairs.push(currentPair);
  }

  // Add pairs from newest to oldest
  const kept: ChatMessage[] = [...systemMessages];
  const removed: ChatMessage[] = [];
  let currentTokens = estimateChatTokens(systemMessages);

  for (let i = pairs.length - 1; i >= 0; i--) {
    const pair = pairs[i]!;
    const pairTokens = estimateChatTokens(pair);

    if (currentTokens + pairTokens <= effectiveMax) {
      kept.splice(systemMessages.length, 0, ...pair);
      currentTokens += pairTokens;
    } else {
      // All older pairs go to removed
      for (let j = 0; j <= i; j++) {
        removed.push(...pairs[j]!);
      }
      break;
    }
  }

  return {
    messages: kept,
    removed,
    tokensBefore,
    tokensAfter: currentTokens,
    tokensSaved: tokensBefore - currentTokens,
    fitsWithinBudget: currentTokens <= effectiveMax,
  };
}

/**
 * Smart trim that uses multiple strategies.
 * Tries to maximize context quality within budget.
 *
 * @param messages - Messages with optional priority
 * @param budget - Token budget
 * @returns Trim result
 */
export function smartTrim(
  messages: PrioritizedMessage[],
  budget: TokenBudget
): TrimResult<PrioritizedMessage> {
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

  // Calculate how much we need to trim
  const tokensToTrim = tokensBefore - effectiveMax;

  // If we only need to trim a little, use oldest-first
  if (tokensToTrim < tokensBefore * 0.2) {
    const basic = trimOldestFirst(messages, budget);
    return {
      ...basic,
      messages: basic.messages as PrioritizedMessage[],
      removed: basic.removed as PrioritizedMessage[],
    };
  }

  // Otherwise, use priority-based trimming
  return trimByPriority(messages, budget, {
    preserveSystem: true,
    preserveRecent: 2,
    preservePinned: true,
  });
}

/**
 * Count tokens that would be removed by trimming
 *
 * @param messages - Messages to check
 * @param budget - Token budget
 * @returns Tokens that would be trimmed
 */
export function estimateTrimTokens(
  messages: ChatMessage[],
  budget: TokenBudget
): number {
  const effectiveMax = budget.maxTokens - (budget.reserveForOutput ?? 0);
  const currentTokens = estimateChatTokens(messages);
  return Math.max(0, currentTokens - effectiveMax);
}
