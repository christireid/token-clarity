/**
 * @module budget/manager
 * Token budget manager implementation
 */

import type { ChatMessage } from '../types/index.js';
import type { Tokenizer } from '../tokenizers/types.js';
import { estimateTokens, estimateChatTokens } from '../tokenizers/estimation.js';
import type {
  TokenBudget,
  BudgetStatus,
  BudgetStatusLevel,
  BudgetManager,
  TrimResult,
  TrimOptions,
} from './types.js';
import { DEFAULT_BUDGET, TASK_OUTPUT_RATIOS } from './presets.js';

/**
 * Determine status level based on utilization and thresholds
 */
function getStatusLevel(
  utilization: number,
  warningThreshold: number,
  criticalThreshold: number
): BudgetStatusLevel {
  if (utilization > 1) return 'exceeded';
  if (utilization >= criticalThreshold) return 'critical';
  if (utilization >= warningThreshold) return 'warning';
  return 'ok';
}

/**
 * Create a budget status object
 */
function createBudgetStatus(
  inputTokens: number,
  outputTokens: number,
  budget: TokenBudget
): BudgetStatus {
  const totalTokens = inputTokens + outputTokens;
  const maxTotal = budget.maxTotalTokens ?? budget.maxInputTokens + budget.maxOutputTokens;

  const inputUtilization = inputTokens / budget.maxInputTokens;
  const outputUtilization = outputTokens / budget.maxOutputTokens;
  const totalUtilization = totalTokens / maxTotal;

  const warningThreshold = budget.warningThreshold ?? 0.8;
  const criticalThreshold = budget.criticalThreshold ?? 0.95;

  // Overall status is worst of input, output, and total
  const inputStatus = getStatusLevel(inputUtilization, warningThreshold, criticalThreshold);
  const outputStatus = getStatusLevel(outputUtilization, warningThreshold, criticalThreshold);
  const totalStatus = getStatusLevel(totalUtilization, warningThreshold, criticalThreshold);

  const statusOrder: BudgetStatusLevel[] = ['ok', 'warning', 'critical', 'exceeded'];
  const statuses = [inputStatus, outputStatus, totalStatus];
  const worstStatus = statuses.reduce((worst, current) =>
    statusOrder.indexOf(current) > statusOrder.indexOf(worst) ? current : worst
  );

  return {
    inputTokens,
    outputTokens,
    totalTokens,
    inputUtilization,
    outputUtilization,
    totalUtilization,
    status: worstStatus,
    remaining: {
      input: Math.max(0, budget.maxInputTokens - inputTokens),
      output: Math.max(0, budget.maxOutputTokens - outputTokens),
      total: Math.max(0, maxTotal - totalTokens),
    },
  };
}

/**
 * Create a token budget manager.
 *
 * @param budget - Token budget configuration
 * @param tokenizer - Optional tokenizer for accurate counting
 * @returns Budget manager instance
 *
 * @example
 * ```ts
 * const manager = createBudgetManager({
 *   maxInputTokens: 4096,
 *   maxOutputTokens: 1024,
 * });
 *
 * const status = manager.checkBudget(2000, 500);
 * console.log(status.status); // 'ok'
 * ```
 */
export function createBudgetManager(
  budget: TokenBudget,
  tokenizer?: Tokenizer
): BudgetManager {
  let currentBudget: TokenBudget = {
    ...DEFAULT_BUDGET,
    ...budget,
  };

  /**
   * Count tokens using tokenizer or estimation
   */
  function countTokens(text: string): number {
    return tokenizer?.count(text) ?? estimateTokens(text);
  }

  /**
   * Count tokens for chat messages
   */
  function countChatTokens(messages: ChatMessage[]): number {
    return tokenizer?.countChat(messages) ?? estimateChatTokens(messages);
  }

  return {
    get budget(): TokenBudget {
      return { ...currentBudget };
    },

    checkBudget(inputTokens: number, estimatedOutput = 0): BudgetStatus {
      return createBudgetStatus(inputTokens, estimatedOutput, currentBudget);
    },

    validateMessages(messages: ChatMessage[]): BudgetStatus {
      const inputTokens = countChatTokens(messages);
      return createBudgetStatus(inputTokens, 0, currentBudget);
    },

    trimToFit(messages: ChatMessage[], options: TrimOptions = {}): TrimResult {
      const {
        reserveForOutput = currentBudget.maxOutputTokens,
        preserveSystem = true,
        minRecentMessages = 1,
        strategy = 'oldest-first',
      } = options;

      // Calculate available input budget
      const maxTotal =
        currentBudget.maxTotalTokens ??
        currentBudget.maxInputTokens + currentBudget.maxOutputTokens;
      const maxInput = Math.min(
        currentBudget.maxInputTokens,
        maxTotal - reserveForOutput
      );

      // Separate system and conversation messages
      const systemMessages = preserveSystem
        ? messages.filter(m => m.role === 'system')
        : [];
      const conversationMessages = preserveSystem
        ? messages.filter(m => m.role !== 'system')
        : [...messages];

      // Calculate system message tokens
      const systemTokens = countChatTokens(systemMessages);

      // If system messages alone exceed budget, we can't proceed
      if (systemTokens >= maxInput) {
        return {
          messages: systemMessages,
          removed: conversationMessages,
          status: createBudgetStatus(systemTokens, reserveForOutput, currentBudget),
          tokensSaved: countChatTokens(conversationMessages),
        };
      }

      const availableForConversation = maxInput - systemTokens;
      const kept: ChatMessage[] = [];
      const removed: ChatMessage[] = [];
      let currentTokens = 0;

      if (strategy === 'oldest-first') {
        // Start from newest, add messages until budget exhausted
        for (let i = conversationMessages.length - 1; i >= 0; i--) {
          const message = conversationMessages[i]!;
          const messageTokens = countChatTokens([message]);

          if (currentTokens + messageTokens <= availableForConversation) {
            kept.unshift(message);
            currentTokens += messageTokens;
          } else if (kept.length >= minRecentMessages) {
            removed.unshift(message);
          } else {
            // Force keep minimum recent messages even if over budget
            kept.unshift(message);
            currentTokens += messageTokens;
          }
        }

        // Add back removed messages in original order
        removed.reverse();
        for (let i = 0; i < conversationMessages.length - kept.length; i++) {
          const msg = conversationMessages[i];
          if (msg && !removed.includes(msg)) {
            removed.unshift(msg);
          }
        }
        removed.sort(
          (a, b) =>
            conversationMessages.indexOf(a) - conversationMessages.indexOf(b)
        );
      } else {
        // For other strategies, fall back to oldest-first for now
        // TODO: Implement importance-based and summarization strategies
        for (let i = conversationMessages.length - 1; i >= 0; i--) {
          const message = conversationMessages[i]!;
          const messageTokens = countChatTokens([message]);

          if (currentTokens + messageTokens <= availableForConversation) {
            kept.unshift(message);
            currentTokens += messageTokens;
          } else {
            removed.unshift(message);
          }
        }
      }

      const finalMessages = [...systemMessages, ...kept];
      const finalTokens = systemTokens + currentTokens;
      const tokensSaved = countChatTokens(removed);

      return {
        messages: finalMessages,
        removed,
        status: createBudgetStatus(finalTokens, reserveForOutput, currentBudget),
        tokensSaved,
      };
    },

    calculateMaxOutputTokens(
      inputTokens: number,
      taskType: 'chat' | 'code' | 'summary' | 'analysis' = 'chat'
    ): number {
      const maxTotal =
        currentBudget.maxTotalTokens ??
        currentBudget.maxInputTokens + currentBudget.maxOutputTokens;
      const available = maxTotal - inputTokens;

      if (available <= 0) return 0;

      const ratio = TASK_OUTPUT_RATIOS[taskType] ?? 0.5;
      const suggested = Math.floor(available * ratio);

      // Cap at model's max output
      return Math.min(suggested, currentBudget.maxOutputTokens);
    },

    updateBudget(updates: Partial<TokenBudget>): void {
      currentBudget = {
        ...currentBudget,
        ...updates,
      };
    },
  };
}
