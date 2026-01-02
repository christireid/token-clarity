/**
 * @module hooks/useOptimizedChat
 * Composite hook for optimized chat with all token optimizations
 */

import { useState, useCallback, useMemo } from 'react';
import {
  estimateCost,
  type ChatMessage,
  type BudgetStatus,
  type Tool,
  type Provider,
  type CostEstimate,
} from '@token-optimizer/core';
import { useTokenBudget } from './useTokenBudget.js';
import { useCostTracker } from './useCostTracker.js';
import { usePromptOptimizer } from './usePromptOptimizer.js';

/**
 * Options for useOptimizedChat hook
 */
export interface UseOptimizedChatOptions {
  /** API endpoint for chat requests */
  api: string;
  /** Model to use */
  model: string;
  /** AI provider */
  provider: Provider;
  /** Enable cache alignment optimization */
  enableCacheAlignment?: boolean;
  /** Enable token budget management */
  enableBudgetManagement?: boolean;
  /** Enable cost tracking */
  enableCostTracking?: boolean;
  /** Enable automatic message trimming */
  enableAutoTrim?: boolean;
  /** Maximum input tokens */
  maxInputTokens?: number;
  /** Maximum output tokens */
  maxOutputTokens?: number;
  /** Cost budget in USD */
  costBudget?: number;
  /** System prompt */
  systemPrompt?: string;
  /** Available tools */
  tools?: Tool[];
  /** Callback for token usage */
  onTokenUsage?: (usage: { inputTokens: number; outputTokens: number; cachedTokens: number }) => void;
  /** Callback for cost updates */
  onCostUpdate?: (cost: CostEstimate) => void;
  /** Callback for budget warnings */
  onBudgetWarning?: (status: BudgetStatus) => void;
}

/**
 * Request statistics
 */
export interface RequestStats {
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  cost: number;
  latency: number;
}

/**
 * Return type for useOptimizedChat hook
 */
export interface UseOptimizedChatReturn {
  /** Chat messages */
  messages: ChatMessage[];
  /** Current input value */
  input: string;
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: Error | null;
  /** Set input value */
  setInput: (input: string) => void;
  /** Send a message */
  sendMessage: (content?: string) => Promise<void>;
  /** Clear all messages */
  clearMessages: () => void;
  /** Current token budget status */
  tokenBudget: BudgetStatus;
  /** Cost tracking statistics */
  costTracker: {
    sessionCost: number;
    totalSavings: number;
    requestCount: number;
  };
  /** Last request statistics */
  lastRequest: RequestStats | null;
  /** Add a message manually */
  addMessage: (message: ChatMessage) => void;
  /** Remove a message by index */
  removeMessage: (index: number) => void;
}

/**
 * Composite React hook for optimized chat.
 * Combines token budgets, cost tracking, and cache alignment.
 *
 * @param options - Chat configuration options
 * @returns Chat utilities with optimization
 *
 * @example
 * ```tsx
 * function ChatApp() {
 *   const {
 *     messages,
 *     input,
 *     setInput,
 *     sendMessage,
 *     isLoading,
 *     tokenBudget,
 *     costTracker,
 *   } = useOptimizedChat({
 *     api: '/api/chat',
 *     model: 'gpt-4o',
 *     provider: 'openai',
 *     systemPrompt: 'You are a helpful assistant.',
 *     enableCacheAlignment: true,
 *     enableCostTracking: true,
 *   });
 *
 *   return (
 *     <div>
 *       <MessageList messages={messages} />
 *       <input
 *         value={input}
 *         onChange={e => setInput(e.target.value)}
 *         onKeyPress={e => e.key === 'Enter' && sendMessage()}
 *       />
 *       <div>Budget: {tokenBudget.status}</div>
 *       <div>Cost: ${costTracker.sessionCost.toFixed(4)}</div>
 *     </div>
 *   );
 * }
 * ```
 */
export function useOptimizedChat(options: UseOptimizedChatOptions): UseOptimizedChatReturn {
  const {
    api,
    model,
    provider,
    enableCacheAlignment = true,
    enableBudgetManagement = true,
    enableCostTracking = true,
    enableAutoTrim = true,
    maxInputTokens,
    maxOutputTokens,
    costBudget,
    systemPrompt,
    tools,
    onTokenUsage,
    onCostUpdate,
    onBudgetWarning,
  } = options;

  // State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [lastRequest, setLastRequest] = useState<RequestStats | null>(null);

  // Token budget hook
  const budget = useTokenBudget({
    model,
    maxInputTokens,
    maxOutputTokens,
    onWarning: onBudgetWarning,
    onCritical: onBudgetWarning,
    onExceeded: onBudgetWarning,
  });

  // Cost tracking hook
  const cost = useCostTracker({
    model,
    budgetLimit: costBudget,
    persistKey: `token-optimizer-${model}`,
  });

  // Prompt optimizer hook
  const promptOptimizer = usePromptOptimizer({
    provider,
    model,
    systemPrompt,
    tools,
    maxInputTokens,
  });

  // Send message
  const sendMessage = useCallback(async (content?: string) => {
    const messageContent = content ?? input;
    if (!messageContent.trim()) return;

    setIsLoading(true);
    setError(null);
    const startTime = Date.now();

    try {
      // Add user message
      const userMessage: ChatMessage = { role: 'user', content: messageContent };
      const currentMessages = [...messages, userMessage];

      // Apply optimizations
      let optimizedMessages = currentMessages;

      if (enableBudgetManagement && enableAutoTrim) {
        const trimResult = budget.trimMessages(currentMessages);
        optimizedMessages = trimResult.messages;
      }

      // Build request
      let requestBody: Record<string, unknown>;

      if (enableCacheAlignment) {
        const historyMessages = optimizedMessages.slice(0, -1);
        const optimizedPrompt = promptOptimizer.buildPrompt(
          historyMessages,
          messageContent
        );
        const providerRequest = promptOptimizer.toProviderRequest(optimizedPrompt);
        requestBody = providerRequest as Record<string, unknown>;
      } else {
        requestBody = { messages: optimizedMessages };
      }

      // Make API request
      const response = await fetch(api, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json() as {
        content?: string;
        choices?: Array<{ message?: { content?: string } }>;
        usage?: {
          prompt_tokens?: number;
          completion_tokens?: number;
          prompt_tokens_details?: { cached_tokens?: number };
        };
      };

      // Extract usage information
      const usage = {
        inputTokens: data.usage?.prompt_tokens ?? budget.countMessages(optimizedMessages),
        outputTokens: data.usage?.completion_tokens ?? budget.countTokens(
          data.content ?? data.choices?.[0]?.message?.content ?? ''
        ),
        cachedTokens: data.usage?.prompt_tokens_details?.cached_tokens ?? 0,
      };

      // Track cost
      if (enableCostTracking) {
        const costEstimate = cost.trackRequest(usage);
        onCostUpdate?.(costEstimate);
      }

      onTokenUsage?.(usage);

      // Update messages with response
      const assistantContent = data.content ?? data.choices?.[0]?.message?.content ?? '';
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: assistantContent,
      };

      setMessages([...currentMessages, assistantMessage]);
      setInput('');

      // Record request stats
      const requestCost = estimateCost(
        model,
        usage.inputTokens,
        usage.outputTokens,
        usage.cachedTokens
      );

      setLastRequest({
        ...usage,
        cost: requestCost.totalCost,
        latency: Date.now() - startTime,
      });
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, [
    input,
    messages,
    api,
    model,
    budget,
    cost,
    promptOptimizer,
    enableBudgetManagement,
    enableAutoTrim,
    enableCacheAlignment,
    enableCostTracking,
    onTokenUsage,
    onCostUpdate,
  ]);

  // Clear messages
  const clearMessages = useCallback(() => {
    setMessages([]);
    setLastRequest(null);
  }, []);

  // Add message manually
  const addMessage = useCallback((message: ChatMessage) => {
    setMessages(prev => [...prev, message]);
  }, []);

  // Remove message by index
  const removeMessage = useCallback((index: number) => {
    setMessages(prev => prev.filter((_, i) => i !== index));
  }, []);

  // Current budget status
  const tokenBudget = useMemo(() => {
    const messageTokens = budget.countMessages(messages);
    return budget.checkBudget(messageTokens, maxOutputTokens);
  }, [budget, messages, maxOutputTokens]);

  return {
    messages,
    input,
    isLoading,
    error,
    setInput,
    sendMessage,
    clearMessages,
    tokenBudget,
    costTracker: {
      sessionCost: cost.sessionCost,
      totalSavings: cost.totalSavings,
      requestCount: cost.requestCount,
    },
    lastRequest,
    addMessage,
    removeMessage,
  };
}
