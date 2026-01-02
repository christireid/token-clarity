/**
 * @module hooks/useTokenBudget
 * React hook for token budget management
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  createTokenizer,
  createBudgetManager,
  estimateTokens,
  getModelBudget,
  type Tokenizer,
  type BudgetStatus,
  type TrimResult,
  type ChatMessage,
  type TokenizerModel,
} from '@token-optimizer/core';

/**
 * Options for useTokenBudget hook
 */
export interface UseTokenBudgetOptions {
  /** Model to use for tokenization */
  model: string;
  /** Maximum input tokens (overrides model default) */
  maxInputTokens?: number;
  /** Maximum output tokens (overrides model default) */
  maxOutputTokens?: number;
  /** Warning threshold (0-1) */
  warningThreshold?: number;
  /** Critical threshold (0-1) */
  criticalThreshold?: number;
  /** Automatically trim messages when over budget */
  autoTrim?: boolean;
  /** Callback when warning threshold is reached */
  onWarning?: (status: BudgetStatus) => void;
  /** Callback when critical threshold is reached */
  onCritical?: (status: BudgetStatus) => void;
  /** Callback when budget is exceeded */
  onExceeded?: (status: BudgetStatus) => void;
}

/**
 * Return type for useTokenBudget hook
 */
export interface UseTokenBudgetReturn {
  /** Current budget status */
  status: BudgetStatus;
  /** Loaded tokenizer (null while loading) */
  tokenizer: Tokenizer | null;
  /** Whether tokenizer is still loading */
  isLoading: boolean;
  /** Count tokens in text */
  countTokens: (text: string) => number;
  /** Count tokens in chat messages */
  countMessages: (messages: ChatMessage[]) => number;
  /** Check if content fits within budget */
  checkBudget: (inputTokens: number, outputEstimate?: number) => BudgetStatus;
  /** Trim messages to fit budget */
  trimMessages: (messages: ChatMessage[], reserveForOutput?: number) => TrimResult;
  /** Remaining input tokens */
  remainingInput: number;
  /** Remaining output tokens */
  remainingOutput: number;
  /** Current utilization percentage */
  utilizationPercent: number;
  /** Update the input token count */
  setInputTokens: (tokens: number) => void;
  /** Update the estimated output tokens */
  setOutputTokens: (tokens: number) => void;
}

/**
 * React hook for token budget management.
 * Provides real-time token counting, budget tracking, and message trimming.
 *
 * @param options - Budget configuration options
 * @returns Budget management utilities
 *
 * @example
 * ```tsx
 * function ChatInput() {
 *   const [input, setInput] = useState('');
 *   const { countTokens, status, remainingInput } = useTokenBudget({
 *     model: 'gpt-4o',
 *     onWarning: () => console.log('Approaching limit!'),
 *   });
 *
 *   const inputTokens = countTokens(input);
 *
 *   return (
 *     <div>
 *       <textarea value={input} onChange={e => setInput(e.target.value)} />
 *       <div>Tokens: {inputTokens} / {remainingInput} remaining</div>
 *       <div>Status: {status.status}</div>
 *     </div>
 *   );
 * }
 * ```
 */
export function useTokenBudget(options: UseTokenBudgetOptions): UseTokenBudgetReturn {
  const {
    model,
    maxInputTokens,
    maxOutputTokens,
    warningThreshold = 0.8,
    criticalThreshold = 0.95,
    onWarning,
    onCritical,
    onExceeded,
  } = options;

  // Get model budget defaults
  const modelBudget = useMemo(() => getModelBudget(model, {
    maxInputTokens,
    maxOutputTokens,
    warningThreshold,
    criticalThreshold,
  }), [model, maxInputTokens, maxOutputTokens, warningThreshold, criticalThreshold]);

  // State
  const [tokenizer, setTokenizer] = useState<Tokenizer | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentInput, setCurrentInput] = useState(0);
  const [currentOutput, setCurrentOutput] = useState(0);

  // Load tokenizer
  useEffect(() => {
    let mounted = true;
    setIsLoading(true);

    createTokenizer(model as TokenizerModel)
      .then(t => {
        if (mounted) {
          setTokenizer(t);
          setIsLoading(false);
        }
      })
      .catch(() => {
        // Fall back to estimation tokenizer
        if (mounted) {
          setIsLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [model]);

  // Create budget manager
  const budgetManager = useMemo(
    () => createBudgetManager(modelBudget, tokenizer ?? undefined),
    [modelBudget, tokenizer]
  );

  // Token counting
  const countTokens = useCallback(
    (text: string): number => {
      return tokenizer?.count(text) ?? estimateTokens(text);
    },
    [tokenizer]
  );

  const countMessages = useCallback(
    (messages: ChatMessage[]): number => {
      return tokenizer?.countChat(messages) ??
        messages.reduce((sum, m) => sum + estimateTokens(m.content) + 4, 2);
    },
    [tokenizer]
  );

  // Budget checking with callbacks
  const checkBudget = useCallback(
    (inputTokens: number, outputEstimate = 0): BudgetStatus => {
      const status = budgetManager.checkBudget(inputTokens, outputEstimate);

      // Trigger appropriate callbacks
      if (status.status === 'exceeded') {
        onExceeded?.(status);
      } else if (status.status === 'critical') {
        onCritical?.(status);
      } else if (status.status === 'warning') {
        onWarning?.(status);
      }

      setCurrentInput(inputTokens);
      setCurrentOutput(outputEstimate);

      return status;
    },
    [budgetManager, onWarning, onCritical, onExceeded]
  );

  // Message trimming
  const trimMessages = useCallback(
    (messages: ChatMessage[], reserveForOutput?: number): TrimResult => {
      return budgetManager.trimToFit(messages, {
        reserveForOutput: reserveForOutput ?? modelBudget.maxOutputTokens,
        preserveSystem: true,
      });
    },
    [budgetManager, modelBudget.maxOutputTokens]
  );

  // Current status
  const status = useMemo(
    () => budgetManager.checkBudget(currentInput, currentOutput),
    [budgetManager, currentInput, currentOutput]
  );

  return {
    status,
    tokenizer,
    isLoading,
    countTokens,
    countMessages,
    checkBudget,
    trimMessages,
    remainingInput: status.remaining.input,
    remainingOutput: status.remaining.output,
    utilizationPercent: status.inputUtilization * 100,
    setInputTokens: setCurrentInput,
    setOutputTokens: setCurrentOutput,
  };
}
