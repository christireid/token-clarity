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

export {
  useDevtools,
  type UseDevtoolsOptions,
  type UseDevtoolsReturn,
} from './hooks/useDevtools.js';

export {
  useCostPreview,
  type UseCostPreviewOptions,
  type UseCostPreviewReturn,
  type ModelComparison,
} from './hooks/useCostPreview.js';

export {
  useModelRouter,
  defaultModelTiers,
  type UseModelRouterOptions,
  type UseModelRouterReturn,
  type TaskComplexity,
  type ModelTier,
  type RoutingStrategy,
  type ComplexityHints,
  type RoutingResult,
} from './hooks/useModelRouter.js';

export {
  useBudgetGuardrails,
  type UseBudgetGuardrailsOptions,
  type UseBudgetGuardrailsReturn,
  type BudgetPeriod,
  type BudgetLimit,
  type BudgetPeriodStatus,
  type BudgetAlert,
} from './hooks/useBudgetGuardrails.js';

// Context
export {
  TokenOptimizerContext,
  TokenOptimizerProvider,
  useTokenOptimizerContext,
  type TokenOptimizerConfig,
  type TokenOptimizerContextValue,
  type TokenOptimizerProviderProps,
} from './context/TokenOptimizerContext.js';

// Components
export {
  TokenDevtoolsPanel,
  type TokenDevtoolsPanelProps,
  type DevtoolsRequestEntry,
  type DevtoolsMetrics,
  type DevtoolsPanelPosition,
  type DevtoolsTab,
} from './components/TokenDevtoolsPanel.js';

// New composable devtools
export {
  DevtoolsPanel,
  type DevtoolsPanelProps,
  DevtoolsProvider,
  useDevtoolsContext,
  useOptionalDevtoolsContext,
  type DevtoolsProviderProps,
  type DevtoolsContextValue,
  type DevtoolsBudgetStatus,
  type BudgetPeriodStatus as DevtoolsBudgetPeriodStatus,
  darkTheme,
  lightTheme,
  mergeTheme,
  getTheme,
  baseStyles,
  icons,
  type DevtoolsTheme,
  type DevtoolsThemeColors,
  formatCurrency,
  formatCompact,
  formatDuration,
  formatPercent,
  formatRelativeTime,
  OverviewTab,
  RequestsTab,
  BreakdownTab,
  CacheTab,
  CompareTab,
} from './components/devtools/index.js';
