/**
 * @module hooks
 * React hooks for token optimization
 */

export {
  useTokenBudget,
  type UseTokenBudgetOptions,
  type UseTokenBudgetReturn,
} from './useTokenBudget.js';

export {
  useCostTracker,
  type UseCostTrackerOptions,
  type UseCostTrackerReturn,
} from './useCostTracker.js';

export {
  usePromptOptimizer,
  type UsePromptOptimizerOptions,
  type UsePromptOptimizerReturn,
} from './usePromptOptimizer.js';

export {
  useOptimizedChat,
  type UseOptimizedChatOptions,
  type UseOptimizedChatReturn,
  type RequestStats,
} from './useOptimizedChat.js';

export {
  useDevtools,
  type UseDevtoolsOptions,
  type UseDevtoolsReturn,
} from './useDevtools.js';

export {
  useCostPreview,
  type UseCostPreviewOptions,
  type UseCostPreviewReturn,
  type ModelComparison,
} from './useCostPreview.js';

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
} from './useModelRouter.js';

export {
  useBudgetGuardrails,
  type UseBudgetGuardrailsOptions,
  type UseBudgetGuardrailsReturn,
  type BudgetPeriod,
  type BudgetLimit,
  type BudgetPeriodStatus,
  type BudgetAlert,
} from './useBudgetGuardrails.js';
