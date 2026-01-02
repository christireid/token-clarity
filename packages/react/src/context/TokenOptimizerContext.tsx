/**
 * @module context/TokenOptimizerContext
 * React context for global token optimizer configuration
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useEffect,
  type ReactNode,
} from 'react';
import {
  createTokenizer,
  createUsageTracker,
  getAllPricing,
  updatePricing,
  type Tokenizer,
  type ModelPricing,
  type Provider,
  type SessionStats,
} from '@token-optimizer/core';

/**
 * Global token optimizer configuration
 */
export interface TokenOptimizerConfig {
  /** Default model for tokenization */
  defaultModel: string;
  /** Default AI provider */
  defaultProvider: Provider;
  /** Global budget limits */
  globalBudget?: {
    /** Daily budget in USD */
    daily?: number;
    /** Monthly budget in USD */
    monthly?: number;
  };
  /** Enable analytics tracking */
  enableAnalytics?: boolean;
  /** Storage key for persisting data */
  storageKey?: string;
}

/**
 * Token optimizer context value
 */
export interface TokenOptimizerContextValue {
  /** Current configuration */
  config: TokenOptimizerConfig;
  /** Total amount spent */
  totalSpent: number;
  /** Total amount saved from optimizations */
  totalSaved: number;
  /** Total number of requests */
  totalRequests: number;
  /** Current session statistics */
  sessionStats: SessionStats;
  /** Model pricing data */
  pricing: Record<string, ModelPricing>;
  /** Update pricing for a model */
  updatePricing: (model: string, pricing: ModelPricing) => void;
  /** Get a tokenizer for a model (cached) */
  getTokenizer: (model: string) => Promise<Tokenizer>;
  /** Track a request */
  trackRequest: (usage: {
    model: string;
    inputTokens: number;
    outputTokens: number;
    cachedTokens?: number;
    cost: number;
  }) => void;
  /** Reset tracking data */
  resetTracking: () => void;
  /** Budget status */
  budgetStatus: {
    daily: { spent: number; limit: number | null; status: 'ok' | 'warning' | 'exceeded' };
    monthly: { spent: number; limit: number | null; status: 'ok' | 'warning' | 'exceeded' };
  };
}

/**
 * Token optimizer context
 */
export const TokenOptimizerContext = createContext<TokenOptimizerContextValue | null>(null);

/**
 * Props for TokenOptimizerProvider
 */
export interface TokenOptimizerProviderProps {
  /** Child components */
  children: ReactNode;
  /** Configuration */
  config: TokenOptimizerConfig;
}

/**
 * Provider component for global token optimizer state.
 *
 * @param props - Provider props
 * @returns Provider component
 *
 * @example
 * ```tsx
 * function App() {
 *   return (
 *     <TokenOptimizerProvider
 *       config={{
 *         defaultModel: 'gpt-4o',
 *         defaultProvider: 'openai',
 *         globalBudget: {
 *           daily: 10.00,
 *           monthly: 100.00,
 *         },
 *       }}
 *     >
 *       <MyApp />
 *     </TokenOptimizerProvider>
 *   );
 * }
 * ```
 */
export function TokenOptimizerProvider({
  children,
  config,
}: TokenOptimizerProviderProps): JSX.Element {
  // Tokenizer cache
  const tokenizerCache = useMemo(() => new Map<string, Promise<Tokenizer>>(), []);

  // Usage tracker
  const tracker = useMemo(
    () =>
      createUsageTracker({
        persistKey: config.storageKey ?? 'token-optimizer-global',
      }),
    [config.storageKey]
  );

  // State
  const [pricing, setPricing] = useState(() => getAllPricing());
  const [stats, setStats] = useState<SessionStats>(() => tracker.getSessionStats());
  const [dailySpent, setDailySpent] = useState(0);
  const [monthlySpent, setMonthlySpent] = useState(0);

  // Calculate daily/monthly spending
  useEffect(() => {
    const historicalStats = tracker.getHistoricalStats(30);
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const thisMonth = today?.slice(0, 7);

    let dailyTotal = 0;
    let monthlyTotal = 0;

    for (const day of historicalStats.dailyStats) {
      if (day.date === today) {
        dailyTotal = day.cost;
      }
      if (day.date.startsWith(thisMonth ?? '')) {
        monthlyTotal += day.cost;
      }
    }

    setDailySpent(dailyTotal);
    setMonthlySpent(monthlyTotal);
  }, [tracker, stats]);

  // Get tokenizer (cached)
  const getTokenizer = useCallback(
    async (model: string): Promise<Tokenizer> => {
      const cached = tokenizerCache.get(model);
      if (cached) {
        return cached;
      }

      const promise = createTokenizer(model as Parameters<typeof createTokenizer>[0]);
      tokenizerCache.set(model, promise);
      return promise;
    },
    [tokenizerCache]
  );

  // Update pricing
  const handleUpdatePricing = useCallback((model: string, newPricing: ModelPricing) => {
    updatePricing(model, newPricing);
    setPricing(getAllPricing());
  }, []);

  // Track request
  const trackRequest = useCallback(
    (usage: {
      model: string;
      inputTokens: number;
      outputTokens: number;
      cachedTokens?: number;
      cost: number;
    }) => {
      tracker.trackRequest({
        ...usage,
        totalTokens: usage.inputTokens + usage.outputTokens,
      });
      setStats(tracker.getSessionStats());
    },
    [tracker]
  );

  // Reset tracking
  const resetTracking = useCallback(() => {
    tracker.reset();
    setStats(tracker.getSessionStats());
    setDailySpent(0);
    setMonthlySpent(0);
  }, [tracker]);

  // Budget status
  const budgetStatus = useMemo(() => {
    const dailyLimit = config.globalBudget?.daily ?? null;
    const monthlyLimit = config.globalBudget?.monthly ?? null;

    const getDailyStatus = (): 'ok' | 'warning' | 'exceeded' => {
      if (!dailyLimit) return 'ok';
      if (dailySpent > dailyLimit) return 'exceeded';
      if (dailySpent > dailyLimit * 0.8) return 'warning';
      return 'ok';
    };

    const getMonthlyStatus = (): 'ok' | 'warning' | 'exceeded' => {
      if (!monthlyLimit) return 'ok';
      if (monthlySpent > monthlyLimit) return 'exceeded';
      if (monthlySpent > monthlyLimit * 0.8) return 'warning';
      return 'ok';
    };

    return {
      daily: { spent: dailySpent, limit: dailyLimit, status: getDailyStatus() },
      monthly: { spent: monthlySpent, limit: monthlyLimit, status: getMonthlyStatus() },
    };
  }, [dailySpent, monthlySpent, config.globalBudget]);

  // Context value
  const value = useMemo<TokenOptimizerContextValue>(
    () => ({
      config,
      totalSpent: stats.cost,
      totalSaved: stats.savings,
      totalRequests: stats.requestCount,
      sessionStats: stats,
      pricing,
      updatePricing: handleUpdatePricing,
      getTokenizer,
      trackRequest,
      resetTracking,
      budgetStatus,
    }),
    [config, stats, pricing, handleUpdatePricing, getTokenizer, trackRequest, resetTracking, budgetStatus]
  );

  return (
    <TokenOptimizerContext.Provider value={value}>
      {children}
    </TokenOptimizerContext.Provider>
  );
}

/**
 * Hook to access token optimizer context.
 *
 * @returns Token optimizer context value
 * @throws Error if used outside of TokenOptimizerProvider
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { totalSpent, budgetStatus } = useTokenOptimizerContext();
 *
 *   return (
 *     <div>
 *       <p>Total spent: ${totalSpent.toFixed(4)}</p>
 *       {budgetStatus.daily.status === 'warning' && (
 *         <p>Approaching daily budget limit!</p>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */
export function useTokenOptimizerContext(): TokenOptimizerContextValue {
  const context = useContext(TokenOptimizerContext);

  if (!context) {
    throw new Error(
      'useTokenOptimizerContext must be used within a TokenOptimizerProvider'
    );
  }

  return context;
}
