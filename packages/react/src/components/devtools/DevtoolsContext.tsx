/**
 * @module components/devtools/DevtoolsContext
 * Context provider for devtools state and configuration
 */

import {
  createContext,
  useContext,
  useState,
  useMemo,
  useCallback,
  type ReactNode,
} from 'react';
import type { SessionStats } from '@token-optimizer/core';
import { getTheme, type DevtoolsTheme } from './theme.js';

/**
 * Request entry for the history log
 */
export interface DevtoolsRequestEntry {
  id: string;
  timestamp: number;
  model: string;
  provider: string;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  cost: number;
  latency: number;
  cacheHit?: boolean;
  error?: string;
}

/**
 * Aggregated metrics for display
 */
export interface DevtoolsMetrics {
  totalRequests: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCachedTokens: number;
  totalCost: number;
  totalSavings: number;
  cacheHitRate: number;
  avgLatency: number;
  tokensPerSecond: number;
  byModel: Record<string, { requests: number; tokens: number; cost: number }>;
  byProvider: Record<string, { requests: number; tokens: number; cost: number }>;
}

/**
 * Panel position options
 */
export type DevtoolsPanelPosition =
  | 'bottom-right'
  | 'bottom-left'
  | 'top-right'
  | 'top-left'
  | 'center';

/**
 * Tab options for the panel
 */
export type DevtoolsTab = 'overview' | 'requests' | 'breakdown' | 'cache' | 'compare' | 'config';

/**
 * Budget status for a time period
 */
export interface BudgetPeriodStatus {
  spent: number;
  limit: number | null;
  status: 'ok' | 'warning' | 'exceeded';
}

/**
 * Complete budget status
 */
export interface DevtoolsBudgetStatus {
  daily: BudgetPeriodStatus;
  monthly: BudgetPeriodStatus;
}

/**
 * Devtools context value
 */
export interface DevtoolsContextValue {
  // State
  isCollapsed: boolean;
  activeTab: DevtoolsTab;
  theme: DevtoolsTheme;

  // Data
  sessionStats?: SessionStats;
  requestHistory: DevtoolsRequestEntry[];
  metrics: DevtoolsMetrics;
  budgetStatus?: DevtoolsBudgetStatus;

  // Actions
  setIsCollapsed: (collapsed: boolean) => void;
  setActiveTab: (tab: DevtoolsTab) => void;
  toggleCollapse: () => void;
  onRequestClick?: (request: DevtoolsRequestEntry) => void;
  onReset?: () => void;
}

const DevtoolsContext = createContext<DevtoolsContextValue | null>(null);

/**
 * Props for DevtoolsProvider
 */
export interface DevtoolsProviderProps {
  children: ReactNode;
  sessionStats?: SessionStats;
  requestHistory?: DevtoolsRequestEntry[];
  customMetrics?: Partial<DevtoolsMetrics>;
  defaultTab?: DevtoolsTab;
  defaultCollapsed?: boolean;
  themeMode?: 'light' | 'dark' | 'auto';
  customTheme?: Partial<DevtoolsTheme>;
  budgetStatus?: DevtoolsBudgetStatus;
  onRequestClick?: (request: DevtoolsRequestEntry) => void;
  onReset?: () => void;
}

/**
 * Calculate metrics from session stats and request history
 */
function calculateMetrics(
  sessionStats?: SessionStats,
  requestHistory: DevtoolsRequestEntry[] = [],
  customMetrics?: Partial<DevtoolsMetrics>
): DevtoolsMetrics {
  const base: DevtoolsMetrics = {
    totalRequests: sessionStats?.requestCount ?? 0,
    totalInputTokens: sessionStats?.inputTokens ?? 0,
    totalOutputTokens: sessionStats?.outputTokens ?? 0,
    totalCachedTokens: sessionStats?.cachedTokens ?? 0,
    totalCost: sessionStats?.cost ?? 0,
    totalSavings: sessionStats?.savings ?? 0,
    cacheHitRate: 0,
    avgLatency: 0,
    tokensPerSecond: 0,
    byModel: {},
    byProvider: {},
  };

  if (requestHistory.length > 0) {
    let totalLatency = 0;
    let cacheHits = 0;

    for (const req of requestHistory) {
      totalLatency += req.latency;
      if (req.cachedTokens > 0) cacheHits++;

      // By model
      if (!base.byModel[req.model]) {
        base.byModel[req.model] = { requests: 0, tokens: 0, cost: 0 };
      }
      const modelMetrics = base.byModel[req.model]!;
      modelMetrics.requests++;
      modelMetrics.tokens += req.inputTokens + req.outputTokens;
      modelMetrics.cost += req.cost;

      // By provider
      if (!base.byProvider[req.provider]) {
        base.byProvider[req.provider] = { requests: 0, tokens: 0, cost: 0 };
      }
      const providerMetrics = base.byProvider[req.provider]!;
      providerMetrics.requests++;
      providerMetrics.tokens += req.inputTokens + req.outputTokens;
      providerMetrics.cost += req.cost;
    }

    base.cacheHitRate = cacheHits / requestHistory.length;
    base.avgLatency = totalLatency / requestHistory.length;

    const totalTokens = base.totalInputTokens + base.totalOutputTokens;
    const totalTime = totalLatency / 1000;
    base.tokensPerSecond = totalTime > 0 ? totalTokens / totalTime : 0;
  }

  return { ...base, ...customMetrics };
}

/**
 * DevtoolsProvider - Context provider for devtools state
 */
export function DevtoolsProvider({
  children,
  sessionStats,
  requestHistory = [],
  customMetrics,
  defaultTab = 'overview',
  defaultCollapsed = false,
  themeMode = 'auto',
  customTheme,
  budgetStatus,
  onRequestClick,
  onReset,
}: DevtoolsProviderProps): JSX.Element {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const [activeTab, setActiveTab] = useState<DevtoolsTab>(defaultTab);

  const theme = useMemo(
    () => getTheme(themeMode, customTheme),
    [themeMode, customTheme]
  );

  const metrics = useMemo(
    () => calculateMetrics(sessionStats, requestHistory, customMetrics),
    [sessionStats, requestHistory, customMetrics]
  );

  const toggleCollapse = useCallback(() => {
    setIsCollapsed((prev) => !prev);
  }, []);

  const value = useMemo<DevtoolsContextValue>(
    () => ({
      isCollapsed,
      activeTab,
      theme,
      sessionStats,
      requestHistory,
      metrics,
      budgetStatus,
      setIsCollapsed,
      setActiveTab,
      toggleCollapse,
      onRequestClick,
      onReset,
    }),
    [
      isCollapsed,
      activeTab,
      theme,
      sessionStats,
      requestHistory,
      metrics,
      budgetStatus,
      toggleCollapse,
      onRequestClick,
      onReset,
    ]
  );

  return (
    <DevtoolsContext.Provider value={value}>
      {children}
    </DevtoolsContext.Provider>
  );
}

/**
 * Hook to access devtools context
 */
export function useDevtoolsContext(): DevtoolsContextValue {
  const context = useContext(DevtoolsContext);
  if (!context) {
    throw new Error('useDevtoolsContext must be used within a DevtoolsProvider');
  }
  return context;
}

/**
 * Hook that optionally accesses devtools context (returns null if not in provider)
 */
export function useOptionalDevtoolsContext(): DevtoolsContextValue | null {
  return useContext(DevtoolsContext);
}
