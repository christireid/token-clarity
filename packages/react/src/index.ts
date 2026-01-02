/**
 * @module @token-optimizer/react
 *
 * React hooks and components for AI token optimization.
 * Provides easy-to-use hooks for budget management, cost tracking, and cache optimization.
 *
 * @example
 * ```tsx
 * import {
 *   TokenOptimizerProvider,
 *   useTokenBudget,
 *   useCostTracker,
 *   useOptimizedChat,
 * } from '@token-optimizer/react';
 *
 * // Wrap your app with the provider
 * function App() {
 *   return (
 *     <TokenOptimizerProvider config={{ defaultModel: 'gpt-4o', defaultProvider: 'openai' }}>
 *       <Chat />
 *     </TokenOptimizerProvider>
 *   );
 * }
 *
 * // Use hooks in your components
 * function Chat() {
 *   const { messages, sendMessage, costTracker } = useOptimizedChat({
 *     api: '/api/chat',
 *     model: 'gpt-4o',
 *     provider: 'openai',
 *   });
 *
 *   return <div>Cost: ${costTracker.sessionCost.toFixed(4)}</div>;
 * }
 * ```
 */

// Re-export core types that are commonly needed
export type {
  ChatMessage,
  Tool,
  TokenizerModel,
  Provider,
  TokenUsage,
  BudgetStatus,
  CostEstimate,
  Tokenizer,
} from '@token-optimizer/core';

// Hooks
export {
  useTokenBudget,
  type UseTokenBudgetOptions,
  type UseTokenBudgetReturn,
} from './hooks/useTokenBudget.js';

export {
  useCostTracker,
  type UseCostTrackerOptions,
  type UseCostTrackerReturn,
} from './hooks/useCostTracker.js';

export {
  usePromptOptimizer,
  type UsePromptOptimizerOptions,
  type UsePromptOptimizerReturn,
} from './hooks/usePromptOptimizer.js';

export {
  useOptimizedChat,
  type UseOptimizedChatOptions,
  type UseOptimizedChatReturn,
  type RequestStats,
} from './hooks/useOptimizedChat.js';

// Context
export {
  TokenOptimizerContext,
  TokenOptimizerProvider,
  useTokenOptimizerContext,
  type TokenOptimizerConfig,
  type TokenOptimizerContextValue,
  type TokenOptimizerProviderProps,
} from './context/TokenOptimizerContext.js';
