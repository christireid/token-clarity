/**
 * @module components/TokenDevtoolsPanel
 * Developer tools panel for monitoring token usage, costs, and optimizations
 *
 * @deprecated This component is deprecated. Use `DevtoolsPanel` from
 * `@token-optimizer/react/components` instead, which provides a composable
 * architecture with better customization options.
 *
 * Migration guide:
 * ```tsx
 * // Before (deprecated)
 * import { TokenDevtoolsPanel } from '@token-optimizer/react';
 *
 * // After (recommended)
 * import { DevtoolsProvider, DevtoolsPanel } from '@token-optimizer/react';
 *
 * <DevtoolsProvider>
 *   <DevtoolsPanel />
 * </DevtoolsProvider>
 * ```
 *
 * This component will be removed in v1.0.0.
 */

import {
  useState,
  useCallback,
  useMemo,
  useRef,
  type ReactNode,
  type CSSProperties,
} from 'react';
import type { SessionStats } from '@token-optimizer/core';
import {
  formatCurrency,
  formatCompact,
  formatDuration,
  formatPercent,
  formatRelativeTime,
  getPositionStyles,
} from './devtools/utils.js';

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
  /** Total requests made */
  totalRequests: number;
  /** Total input tokens */
  totalInputTokens: number;
  /** Total output tokens */
  totalOutputTokens: number;
  /** Total cached tokens */
  totalCachedTokens: number;
  /** Total cost in USD */
  totalCost: number;
  /** Total savings from cache */
  totalSavings: number;
  /** Cache hit rate (0-1) */
  cacheHitRate: number;
  /** Average latency in ms */
  avgLatency: number;
  /** Tokens per second */
  tokensPerSecond: number;
  /** Breakdown by model */
  byModel: Record<string, { requests: number; tokens: number; cost: number }>;
  /** Breakdown by provider */
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
export type DevtoolsTab = 'overview' | 'requests' | 'breakdown' | 'cache' | 'config';

/**
 * Props for TokenDevtoolsPanel
 */
export interface TokenDevtoolsPanelProps {
  /** Session statistics from context or hook */
  sessionStats?: SessionStats;
  /** Request history */
  requestHistory?: DevtoolsRequestEntry[];
  /** Custom metrics */
  metrics?: Partial<DevtoolsMetrics>;
  /** Panel position */
  position?: DevtoolsPanelPosition;
  /** Default tab to show */
  defaultTab?: DevtoolsTab;
  /** Whether panel starts collapsed */
  defaultCollapsed?: boolean;
  /** Minimum width when expanded */
  minWidth?: number;
  /** Maximum width when expanded */
  maxWidth?: number;
  /** Height when expanded */
  height?: number;
  /** Custom z-index */
  zIndex?: number;
  /** Theme: 'light' or 'dark' */
  theme?: 'light' | 'dark' | 'auto';
  /** Disable the panel entirely */
  disabled?: boolean;
  /** Only show in development */
  devOnly?: boolean;
  /** Custom class name */
  className?: string;
  /** Custom styles */
  style?: CSSProperties;
  /** Render custom header content */
  renderHeader?: () => ReactNode;
  /** Render custom footer content */
  renderFooter?: () => ReactNode;
  /** Callback when a request is clicked */
  onRequestClick?: (request: DevtoolsRequestEntry) => void;
  /** Callback when reset is clicked */
  onReset?: () => void;
  /** Budget configuration for warnings */
  budget?: {
    daily?: number;
    monthly?: number;
    perRequest?: number;
  };
  /** Current budget status */
  budgetStatus?: {
    daily: { spent: number; limit: number | null; status: 'ok' | 'warning' | 'exceeded' };
    monthly: { spent: number; limit: number | null; status: 'ok' | 'warning' | 'exceeded' };
  };
}

// CSS styles as objects for inline styling (no external CSS required)
const baseStyles: Record<string, CSSProperties> = {
  container: {
    position: 'fixed',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    fontSize: '12px',
    lineHeight: 1.4,
    borderRadius: '8px',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
    overflow: 'hidden',
    transition: 'all 0.2s ease',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 12px',
    cursor: 'pointer',
    userSelect: 'none',
    borderBottom: '1px solid',
  },
  headerTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontWeight: 600,
    fontSize: '13px',
  },
  headerStats: {
    display: 'flex',
    gap: '12px',
    fontSize: '11px',
    opacity: 0.8,
  },
  tabs: {
    display: 'flex',
    borderBottom: '1px solid',
    padding: '0 8px',
  },
  tab: {
    padding: '8px 12px',
    cursor: 'pointer',
    borderBottom: '2px solid transparent',
    fontSize: '11px',
    fontWeight: 500,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  tabActive: {
    borderBottomColor: '#3b82f6',
  },
  content: {
    padding: '12px',
    overflowY: 'auto',
    overflowX: 'hidden',
  },
  section: {
    marginBottom: '16px',
  },
  sectionTitle: {
    fontSize: '11px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: '8px',
    opacity: 0.7,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '8px',
  },
  stat: {
    padding: '8px',
    borderRadius: '4px',
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  statLabel: {
    fontSize: '10px',
    textTransform: 'uppercase',
    opacity: 0.6,
  },
  statValue: {
    fontSize: '16px',
    fontWeight: 700,
  },
  statSubtext: {
    fontSize: '10px',
    opacity: 0.5,
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '11px',
  },
  th: {
    textAlign: 'left',
    padding: '6px 8px',
    fontWeight: 600,
    borderBottom: '1px solid',
    fontSize: '10px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  td: {
    padding: '6px 8px',
    borderBottom: '1px solid',
  },
  row: {
    cursor: 'pointer',
    transition: 'background 0.1s',
  },
  badge: {
    display: 'inline-block',
    padding: '2px 6px',
    borderRadius: '4px',
    fontSize: '10px',
    fontWeight: 600,
  },
  progressBar: {
    height: '4px',
    borderRadius: '2px',
    overflow: 'hidden',
    marginTop: '4px',
  },
  progressFill: {
    height: '100%',
    transition: 'width 0.3s ease',
  },
  button: {
    padding: '6px 12px',
    borderRadius: '4px',
    border: 'none',
    cursor: 'pointer',
    fontSize: '11px',
    fontWeight: 500,
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    transition: 'background 0.1s',
  },
  collapsed: {
    width: '48px',
    height: '48px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
};

// Theme colors
const themes = {
  dark: {
    bg: '#1e1e2e',
    bgSecondary: '#2a2a3e',
    bgHover: '#3a3a4e',
    text: '#e0e0e0',
    textSecondary: '#a0a0b0',
    border: '#3a3a4e',
    accent: '#3b82f6',
    success: '#22c55e',
    warning: '#f59e0b',
    error: '#ef4444',
  },
  light: {
    bg: '#ffffff',
    bgSecondary: '#f5f5f5',
    bgHover: '#ebebeb',
    text: '#1a1a2e',
    textSecondary: '#6b6b7b',
    border: '#e0e0e0',
    accent: '#3b82f6',
    success: '#16a34a',
    warning: '#d97706',
    error: '#dc2626',
  },
};

// Formatting functions imported from './devtools/utils.js' above

/**
 * Icon components using unicode/emoji
 */
const icons = {
  token: '🪙',
  cost: '💰',
  cache: '⚡',
  chart: '📊',
  clock: '⏱️',
  warning: '⚠️',
  error: '❌',
  success: '✓',
  expand: '↗',
  collapse: '↘',
  close: '×',
  reset: '↺',
  settings: '⚙',
};

/**
 * TokenDevtoolsPanel - A comprehensive developer tools panel for monitoring
 * token usage, costs, cache performance, and request history.
 *
 * @deprecated Use `DevtoolsPanel` from `@token-optimizer/react/components` instead.
 * This component will be removed in v1.0.0. See the module-level JSDoc for migration guide.
 *
 * @param props - Panel configuration props
 * @returns React component
 *
 * @example
 * ```tsx
 * // DEPRECATED - use DevtoolsProvider + DevtoolsPanel instead
 * import { TokenDevtoolsPanel } from '@token-optimizer/react';
 *
 * function App() {
 *   const { sessionStats, requestHistory } = useTokenOptimizerContext();
 *
 *   return (
 *     <div>
 *       <MyApp />
 *       <TokenDevtoolsPanel
 *         sessionStats={sessionStats}
 *         requestHistory={requestHistory}
 *         position="bottom-right"
 *         theme="dark"
 *       />
 *     </div>
 *   );
 * }
 * ```
 */
export function TokenDevtoolsPanel({
  sessionStats,
  requestHistory = [],
  metrics: customMetrics,
  position = 'bottom-right',
  defaultTab = 'overview',
  defaultCollapsed = false,
  minWidth = 320,
  maxWidth = 480,
  height = 400,
  zIndex = 9999,
  theme: themeProp = 'auto',
  disabled = false,
  devOnly = true,
  className,
  style,
  renderHeader,
  renderFooter,
  onRequestClick,
  onReset,
  budgetStatus,
}: TokenDevtoolsPanelProps): JSX.Element | null {
  // State
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const [activeTab, setActiveTab] = useState<DevtoolsTab>(defaultTab);
  const panelRef = useRef<HTMLDivElement>(null);

  // Determine theme
  const effectiveTheme = useMemo(() => {
    if (themeProp === 'auto') {
      if (typeof window !== 'undefined') {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }
      return 'dark';
    }
    return themeProp;
  }, [themeProp]);

  const colors = themes[effectiveTheme];

  // Calculate metrics from session stats and request history
  const metrics: DevtoolsMetrics = useMemo(() => {
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

      base.cacheHitRate = requestHistory.length > 0 ? cacheHits / requestHistory.length : 0;
      base.avgLatency = requestHistory.length > 0 ? totalLatency / requestHistory.length : 0;

      const totalTokens = base.totalInputTokens + base.totalOutputTokens;
      const totalTime = totalLatency / 1000; // Convert to seconds
      base.tokensPerSecond = totalTime > 0 ? totalTokens / totalTime : 0;
    }

    return { ...base, ...customMetrics };
  }, [sessionStats, requestHistory, customMetrics]);

  // Check if should render (dev only mode)
  if (disabled) return null;
  if (devOnly && typeof process !== 'undefined' && process.env?.NODE_ENV === 'production') {
    return null;
  }

  // Toggle collapse
  const toggleCollapse = useCallback(() => {
    setIsCollapsed((prev) => !prev);
  }, []);

  // Handle reset
  const handleReset = useCallback(() => {
    onReset?.();
  }, [onReset]);

  // Collapsed view
  if (isCollapsed) {
    return (
      <div
        ref={panelRef}
        className={className}
        style={{
          ...baseStyles.collapsed,
          ...getPositionStyles(position),
          backgroundColor: colors.bg,
          color: colors.text,
          zIndex,
          boxShadow: '0 2px 12px rgba(0, 0, 0, 0.2)',
          ...style,
        }}
        onClick={toggleCollapse}
        title="Token Devtools"
      >
        <span style={{ fontSize: '20px' }}>{icons.token}</span>
      </div>
    );
  }

  // Tab components
  const tabs: { id: DevtoolsTab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'requests', label: 'Requests' },
    { id: 'breakdown', label: 'Breakdown' },
    { id: 'cache', label: 'Cache' },
  ];

  // Render overview tab
  const renderOverview = () => (
    <div style={baseStyles.content}>
      {/* Quick stats */}
      <div style={baseStyles.section}>
        <div style={{ ...baseStyles.sectionTitle, color: colors.textSecondary }}>
          Session Overview
        </div>
        <div style={baseStyles.grid}>
          <div style={{ ...baseStyles.stat, backgroundColor: colors.bgSecondary }}>
            <span style={{ ...baseStyles.statLabel, color: colors.textSecondary }}>
              Requests
            </span>
            <span style={{ ...baseStyles.statValue, color: colors.text }}>
              {metrics.totalRequests}
            </span>
          </div>
          <div style={{ ...baseStyles.stat, backgroundColor: colors.bgSecondary }}>
            <span style={{ ...baseStyles.statLabel, color: colors.textSecondary }}>
              Total Cost
            </span>
            <span style={{ ...baseStyles.statValue, color: colors.accent }}>
              {formatCurrency(metrics.totalCost)}
            </span>
          </div>
          <div style={{ ...baseStyles.stat, backgroundColor: colors.bgSecondary }}>
            <span style={{ ...baseStyles.statLabel, color: colors.textSecondary }}>
              Tokens Used
            </span>
            <span style={{ ...baseStyles.statValue, color: colors.text }}>
              {formatCompact(metrics.totalInputTokens + metrics.totalOutputTokens)}
            </span>
            <span style={{ ...baseStyles.statSubtext, color: colors.textSecondary }}>
              {formatCompact(metrics.totalInputTokens)} in / {formatCompact(metrics.totalOutputTokens)} out
            </span>
          </div>
          <div style={{ ...baseStyles.stat, backgroundColor: colors.bgSecondary }}>
            <span style={{ ...baseStyles.statLabel, color: colors.textSecondary }}>
              Savings
            </span>
            <span style={{ ...baseStyles.statValue, color: colors.success }}>
              {formatCurrency(metrics.totalSavings)}
            </span>
            <span style={{ ...baseStyles.statSubtext, color: colors.textSecondary }}>
              {formatCompact(metrics.totalCachedTokens)} cached
            </span>
          </div>
        </div>
      </div>

      {/* Performance */}
      <div style={baseStyles.section}>
        <div style={{ ...baseStyles.sectionTitle, color: colors.textSecondary }}>
          Performance
        </div>
        <div style={baseStyles.grid}>
          <div style={{ ...baseStyles.stat, backgroundColor: colors.bgSecondary }}>
            <span style={{ ...baseStyles.statLabel, color: colors.textSecondary }}>
              Avg Latency
            </span>
            <span style={{ ...baseStyles.statValue, color: colors.text }}>
              {formatDuration(metrics.avgLatency)}
            </span>
          </div>
          <div style={{ ...baseStyles.stat, backgroundColor: colors.bgSecondary }}>
            <span style={{ ...baseStyles.statLabel, color: colors.textSecondary }}>
              Cache Hit Rate
            </span>
            <span style={{ ...baseStyles.statValue, color: colors.text }}>
              {formatPercent(metrics.cacheHitRate)}
            </span>
          </div>
        </div>
      </div>

      {/* Budget status */}
      {budgetStatus && (
        <div style={baseStyles.section}>
          <div style={{ ...baseStyles.sectionTitle, color: colors.textSecondary }}>
            Budget
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {budgetStatus.daily.limit && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ color: colors.textSecondary }}>Daily</span>
                  <span style={{
                    color: budgetStatus.daily.status === 'exceeded'
                      ? colors.error
                      : budgetStatus.daily.status === 'warning'
                        ? colors.warning
                        : colors.text,
                  }}>
                    {formatCurrency(budgetStatus.daily.spent)} / {formatCurrency(budgetStatus.daily.limit)}
                  </span>
                </div>
                <div style={{ ...baseStyles.progressBar, backgroundColor: colors.bgSecondary }}>
                  <div
                    style={{
                      ...baseStyles.progressFill,
                      width: `${Math.min(100, (budgetStatus.daily.spent / budgetStatus.daily.limit) * 100)}%`,
                      backgroundColor: budgetStatus.daily.status === 'exceeded'
                        ? colors.error
                        : budgetStatus.daily.status === 'warning'
                          ? colors.warning
                          : colors.accent,
                    }}
                  />
                </div>
              </div>
            )}
            {budgetStatus.monthly.limit && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ color: colors.textSecondary }}>Monthly</span>
                  <span style={{
                    color: budgetStatus.monthly.status === 'exceeded'
                      ? colors.error
                      : budgetStatus.monthly.status === 'warning'
                        ? colors.warning
                        : colors.text,
                  }}>
                    {formatCurrency(budgetStatus.monthly.spent)} / {formatCurrency(budgetStatus.monthly.limit)}
                  </span>
                </div>
                <div style={{ ...baseStyles.progressBar, backgroundColor: colors.bgSecondary }}>
                  <div
                    style={{
                      ...baseStyles.progressFill,
                      width: `${Math.min(100, (budgetStatus.monthly.spent / budgetStatus.monthly.limit) * 100)}%`,
                      backgroundColor: budgetStatus.monthly.status === 'exceeded'
                        ? colors.error
                        : budgetStatus.monthly.status === 'warning'
                          ? colors.warning
                          : colors.accent,
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );

  // Render requests tab
  const renderRequests = () => (
    <div style={{ ...baseStyles.content, padding: 0 }}>
      {requestHistory.length === 0 ? (
        <div style={{ padding: '24px', textAlign: 'center', color: colors.textSecondary }}>
          No requests yet
        </div>
      ) : (
        <table style={baseStyles.table}>
          <thead>
            <tr style={{ backgroundColor: colors.bgSecondary }}>
              <th style={{ ...baseStyles.th, borderColor: colors.border, color: colors.textSecondary }}>Time</th>
              <th style={{ ...baseStyles.th, borderColor: colors.border, color: colors.textSecondary }}>Model</th>
              <th style={{ ...baseStyles.th, borderColor: colors.border, color: colors.textSecondary }}>Tokens</th>
              <th style={{ ...baseStyles.th, borderColor: colors.border, color: colors.textSecondary }}>Cost</th>
              <th style={{ ...baseStyles.th, borderColor: colors.border, color: colors.textSecondary }}>Latency</th>
            </tr>
          </thead>
          <tbody>
            {requestHistory.slice().reverse().slice(0, 50).map((req) => (
              <tr
                key={req.id}
                style={{
                  ...baseStyles.row,
                  backgroundColor: req.error ? `${colors.error}20` : 'transparent',
                }}
                onClick={() => onRequestClick?.(req)}
              >
                <td style={{ ...baseStyles.td, borderColor: colors.border, color: colors.textSecondary }}>
                  {formatRelativeTime(req.timestamp)}
                </td>
                <td style={{ ...baseStyles.td, borderColor: colors.border, color: colors.text }}>
                  <span>{req.model}</span>
                  {req.cachedTokens > 0 && (
                    <span
                      style={{
                        ...baseStyles.badge,
                        marginLeft: '4px',
                        backgroundColor: `${colors.success}30`,
                        color: colors.success,
                      }}
                    >
                      {icons.cache}
                    </span>
                  )}
                </td>
                <td style={{ ...baseStyles.td, borderColor: colors.border, color: colors.text }}>
                  {formatCompact(req.inputTokens + req.outputTokens)}
                </td>
                <td style={{ ...baseStyles.td, borderColor: colors.border, color: colors.accent }}>
                  {formatCurrency(req.cost)}
                </td>
                <td style={{ ...baseStyles.td, borderColor: colors.border, color: colors.text }}>
                  {formatDuration(req.latency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );

  // Render breakdown tab
  const renderBreakdown = () => (
    <div style={baseStyles.content}>
      {/* By Model */}
      <div style={baseStyles.section}>
        <div style={{ ...baseStyles.sectionTitle, color: colors.textSecondary }}>
          By Model
        </div>
        {Object.keys(metrics.byModel).length === 0 ? (
          <div style={{ color: colors.textSecondary, fontSize: '11px' }}>No data</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {Object.entries(metrics.byModel)
              .sort((a, b) => b[1].cost - a[1].cost)
              .map(([model, data]) => (
                <div
                  key={model}
                  style={{
                    padding: '8px',
                    backgroundColor: colors.bgSecondary,
                    borderRadius: '4px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <div style={{ color: colors.text, fontWeight: 500 }}>{model}</div>
                    <div style={{ color: colors.textSecondary, fontSize: '10px' }}>
                      {data.requests} requests • {formatCompact(data.tokens)} tokens
                    </div>
                  </div>
                  <div style={{ color: colors.accent, fontWeight: 600 }}>
                    {formatCurrency(data.cost)}
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* By Provider */}
      <div style={baseStyles.section}>
        <div style={{ ...baseStyles.sectionTitle, color: colors.textSecondary }}>
          By Provider
        </div>
        {Object.keys(metrics.byProvider).length === 0 ? (
          <div style={{ color: colors.textSecondary, fontSize: '11px' }}>No data</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {Object.entries(metrics.byProvider)
              .sort((a, b) => b[1].cost - a[1].cost)
              .map(([provider, data]) => (
                <div
                  key={provider}
                  style={{
                    padding: '8px',
                    backgroundColor: colors.bgSecondary,
                    borderRadius: '4px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <div style={{ color: colors.text, fontWeight: 500, textTransform: 'capitalize' }}>
                      {provider}
                    </div>
                    <div style={{ color: colors.textSecondary, fontSize: '10px' }}>
                      {data.requests} requests • {formatCompact(data.tokens)} tokens
                    </div>
                  </div>
                  <div style={{ color: colors.accent, fontWeight: 600 }}>
                    {formatCurrency(data.cost)}
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );

  // Render cache tab
  const renderCache = () => (
    <div style={baseStyles.content}>
      <div style={baseStyles.section}>
        <div style={{ ...baseStyles.sectionTitle, color: colors.textSecondary }}>
          Cache Performance
        </div>
        <div style={baseStyles.grid}>
          <div style={{ ...baseStyles.stat, backgroundColor: colors.bgSecondary }}>
            <span style={{ ...baseStyles.statLabel, color: colors.textSecondary }}>
              Hit Rate
            </span>
            <span style={{ ...baseStyles.statValue, color: colors.success }}>
              {formatPercent(metrics.cacheHitRate)}
            </span>
          </div>
          <div style={{ ...baseStyles.stat, backgroundColor: colors.bgSecondary }}>
            <span style={{ ...baseStyles.statLabel, color: colors.textSecondary }}>
              Tokens Cached
            </span>
            <span style={{ ...baseStyles.statValue, color: colors.text }}>
              {formatCompact(metrics.totalCachedTokens)}
            </span>
          </div>
          <div style={{ ...baseStyles.stat, backgroundColor: colors.bgSecondary }}>
            <span style={{ ...baseStyles.statLabel, color: colors.textSecondary }}>
              Cost Saved
            </span>
            <span style={{ ...baseStyles.statValue, color: colors.success }}>
              {formatCurrency(metrics.totalSavings)}
            </span>
          </div>
          <div style={{ ...baseStyles.stat, backgroundColor: colors.bgSecondary }}>
            <span style={{ ...baseStyles.statLabel, color: colors.textSecondary }}>
              Efficiency
            </span>
            <span style={{ ...baseStyles.statValue, color: colors.text }}>
              {metrics.totalCost > 0
                ? formatPercent(metrics.totalSavings / (metrics.totalCost + metrics.totalSavings))
                : '0%'}
            </span>
          </div>
        </div>
      </div>

      <div style={baseStyles.section}>
        <div style={{ ...baseStyles.sectionTitle, color: colors.textSecondary }}>
          Cache Tips
        </div>
        <div
          style={{
            padding: '12px',
            backgroundColor: colors.bgSecondary,
            borderRadius: '4px',
            color: colors.textSecondary,
            fontSize: '11px',
            lineHeight: 1.6,
          }}
        >
          <div style={{ marginBottom: '8px' }}>
            {icons.cache} <strong style={{ color: colors.text }}>Improve cache hit rate:</strong>
          </div>
          <ul style={{ margin: 0, paddingLeft: '16px' }}>
            <li>Keep system prompts stable and at the start</li>
            <li>Use consistent message ordering</li>
            <li>Minimize dynamic content in prefix</li>
            <li>Enable semantic caching for similar queries</li>
          </ul>
        </div>
      </div>
    </div>
  );

  return (
    <div
      ref={panelRef}
      className={className}
      style={{
        ...baseStyles.container,
        ...getPositionStyles(position),
        width: maxWidth,
        minWidth,
        backgroundColor: colors.bg,
        color: colors.text,
        zIndex,
        border: `1px solid ${colors.border}`,
        ...style,
      }}
    >
      {/* Header */}
      <div
        style={{
          ...baseStyles.header,
          backgroundColor: colors.bgSecondary,
          borderColor: colors.border,
        }}
        onClick={toggleCollapse}
      >
        <div style={baseStyles.headerTitle}>
          <span>{icons.token}</span>
          <span>Token Devtools</span>
        </div>
        <div style={baseStyles.headerStats}>
          <span>{formatCurrency(metrics.totalCost)}</span>
          <span>{formatCompact(metrics.totalInputTokens + metrics.totalOutputTokens)} tok</span>
          <span
            style={{ cursor: 'pointer', fontSize: '16px' }}
            title="Collapse"
          >
            {icons.collapse}
          </span>
        </div>
      </div>

      {/* Custom header */}
      {renderHeader?.()}

      {/* Tabs */}
      <div style={{ ...baseStyles.tabs, borderColor: colors.border, backgroundColor: colors.bg }}>
        {tabs.map((tab) => (
          <div
            key={tab.id}
            style={{
              ...baseStyles.tab,
              ...(activeTab === tab.id ? baseStyles.tabActive : {}),
              color: activeTab === tab.id ? colors.accent : colors.textSecondary,
            }}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </div>
        ))}
        <div style={{ flex: 1 }} />
        <button
          style={{
            ...baseStyles.button,
            backgroundColor: 'transparent',
            color: colors.textSecondary,
            padding: '4px 8px',
          }}
          onClick={handleReset}
          title="Reset tracking"
        >
          {icons.reset}
        </button>
      </div>

      {/* Tab content */}
      <div style={{ height, overflowY: 'auto' }}>
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'requests' && renderRequests()}
        {activeTab === 'breakdown' && renderBreakdown()}
        {activeTab === 'cache' && renderCache()}
      </div>

      {/* Custom footer */}
      {renderFooter?.()}
    </div>
  );
}

export default TokenDevtoolsPanel;
