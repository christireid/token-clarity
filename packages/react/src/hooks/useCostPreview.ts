/**
 * @module hooks/useCostPreview
 * Hook for previewing token costs before sending requests
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  estimateTokens,
  estimateChatTokens,
  estimateCost,
  type ChatMessage,
  type Provider,
  type CostEstimate,
} from '@token-optimizer/core';

/**
 * Options for useCostPreview hook
 */
export interface UseCostPreviewOptions {
  /** Model to estimate for */
  model: string;
  /** Provider name */
  provider?: Provider;
  /** Debounce delay in ms (default: 150) */
  debounceMs?: number;
  /** Whether to estimate on mount */
  estimateOnMount?: boolean;
  /** System prompt (counted as input) */
  systemPrompt?: string;
  /** Existing chat history to include */
  chatHistory?: ChatMessage[];
  /** Expected output tokens (estimate) */
  expectedOutputTokens?: number;
  /** Cached tokens count (if known) */
  cachedTokens?: number;
}

/**
 * Return type for useCostPreview hook
 */
export interface UseCostPreviewReturn {
  /** Estimated input tokens */
  inputTokens: number;
  /** Estimated output tokens */
  outputTokens: number;
  /** Total estimated tokens */
  totalTokens: number;
  /** Cost estimate */
  costEstimate: CostEstimate | null;
  /** Formatted cost string */
  formattedCost: string;
  /** Is currently estimating */
  isEstimating: boolean;
  /** Update the input text to estimate */
  setInput: (text: string) => void;
  /** Manually trigger estimation */
  estimate: (text?: string) => void;
  /** Compare costs across multiple models */
  compareModels: (models: string[]) => ModelComparison[];
  /** Get cost for a specific token count */
  getCostForTokens: (inputTokens: number, outputTokens: number) => CostEstimate | null;
}

/**
 * Model comparison result
 */
export interface ModelComparison {
  model: string;
  cost: CostEstimate | null;
  savingsVsCurrent: number;
  isRecommended: boolean;
}

/**
 * Format cost as currency string
 */
function formatCost(cost: number): string {
  if (cost < 0.0001) return '$0.0000';
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(4)}`;
}

/**
 * useCostPreview - Estimate token costs before sending a request
 *
 * @param options - Configuration options
 * @returns Cost preview data and controls
 *
 * @example
 * ```tsx
 * function ChatInput() {
 *   const [message, setMessage] = useState('');
 *   const { inputTokens, formattedCost, setInput } = useCostPreview({
 *     model: 'gpt-4o',
 *     systemPrompt: 'You are a helpful assistant',
 *   });
 *
 *   useEffect(() => {
 *     setInput(message);
 *   }, [message, setInput]);
 *
 *   return (
 *     <div>
 *       <textarea value={message} onChange={(e) => setMessage(e.target.value)} />
 *       <span>~{inputTokens} tokens • {formattedCost}</span>
 *     </div>
 *   );
 * }
 * ```
 */
export function useCostPreview(options: UseCostPreviewOptions): UseCostPreviewReturn {
  const {
    model,
    debounceMs = 150,
    estimateOnMount = false,
    systemPrompt = '',
    chatHistory = [],
    expectedOutputTokens = 500,
    cachedTokens = 0,
  } = options;

  const [inputText, setInputText] = useState('');
  const [inputTokens, setInputTokens] = useState(0);
  const [outputTokens, setOutputTokens] = useState(expectedOutputTokens);
  const [costEstimate, setCostEstimate] = useState<CostEstimate | null>(null);
  const [isEstimating, setIsEstimating] = useState(false);

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Calculate system + history tokens (these are relatively stable)
  const baseTokens = useMemo(() => {
    let tokens = 0;
    if (systemPrompt) {
      tokens += estimateTokens(systemPrompt);
    }
    if (chatHistory.length > 0) {
      tokens += estimateChatTokens(chatHistory);
    }
    return tokens;
  }, [systemPrompt, chatHistory]);

  // Perform estimation
  const performEstimate = useCallback(
    (text: string) => {
      setIsEstimating(true);

      try {
        // Estimate new message tokens
        const newMessageTokens = text ? estimateTokens(text) : 0;
        const totalInputTokens = baseTokens + newMessageTokens;

        setInputTokens(totalInputTokens);

        // Calculate cost
        const estimate = estimateCost(model, totalInputTokens, outputTokens, cachedTokens);
        setCostEstimate(estimate);
      } catch (error) {
        console.warn('Cost preview estimation failed:', error);
        setCostEstimate(null);
      } finally {
        setIsEstimating(false);
      }
    },
    [model, baseTokens, outputTokens, cachedTokens]
  );

  // Debounced input setter
  const setInput = useCallback(
    (text: string) => {
      setInputText(text);

      // Clear existing timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // Set new debounce timer
      debounceTimerRef.current = setTimeout(() => {
        performEstimate(text);
      }, debounceMs);
    },
    [debounceMs, performEstimate]
  );

  // Manual estimate trigger
  const estimate = useCallback(
    (text?: string) => {
      const textToEstimate = text ?? inputText;
      performEstimate(textToEstimate);
    },
    [inputText, performEstimate]
  );

  // Compare costs across models
  const compareModels = useCallback(
    (models: string[]): ModelComparison[] => {
      const totalInput = inputTokens || baseTokens;
      const currentCost = costEstimate?.totalCost ?? 0;

      return models.map((m) => {
        try {
          const cost = estimateCost(m, totalInput, outputTokens, cachedTokens);
          const savings = currentCost - cost.totalCost;
          return {
            model: m,
            cost,
            savingsVsCurrent: savings,
            isRecommended: savings > 0,
          };
        } catch {
          return {
            model: m,
            cost: null,
            savingsVsCurrent: 0,
            isRecommended: false,
          };
        }
      });
    },
    [inputTokens, baseTokens, outputTokens, cachedTokens, costEstimate]
  );

  // Get cost for specific token counts
  const getCostForTokens = useCallback(
    (input: number, output: number): CostEstimate | null => {
      try {
        return estimateCost(model, input, output, cachedTokens);
      } catch {
        return null;
      }
    },
    [model, cachedTokens]
  );

  // Estimate on mount if requested
  useEffect(() => {
    if (estimateOnMount) {
      performEstimate('');
    }
  }, [estimateOnMount, performEstimate]);

  // Cleanup debounce timer
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Update output tokens when prop changes
  useEffect(() => {
    setOutputTokens(expectedOutputTokens);
  }, [expectedOutputTokens]);

  // Formatted cost
  const formattedCost = useMemo(() => {
    return costEstimate ? formatCost(costEstimate.totalCost) : '$0.0000';
  }, [costEstimate]);

  return {
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    costEstimate,
    formattedCost,
    isEstimating,
    setInput,
    estimate,
    compareModels,
    getCostForTokens,
  };
}
