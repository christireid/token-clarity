/**
 * @module components
 * React components for token optimization
 */

// Legacy TokenDevtoolsPanel (for backwards compatibility)
export {
  TokenDevtoolsPanel,
  type TokenDevtoolsPanelProps,
  type DevtoolsRequestEntry,
  type DevtoolsMetrics,
  type DevtoolsPanelPosition,
  type DevtoolsTab,
} from './TokenDevtoolsPanel.js';

// New composable devtools
export {
  // Main panel
  DevtoolsPanel,
  type DevtoolsPanelProps,
  // Context
  DevtoolsProvider,
  useDevtoolsContext,
  useOptionalDevtoolsContext,
  type DevtoolsProviderProps,
  type DevtoolsContextValue,
  type DevtoolsBudgetStatus,
  type BudgetPeriodStatus,
  // Theme
  darkTheme,
  lightTheme,
  mergeTheme,
  getTheme,
  baseStyles,
  icons,
  type DevtoolsTheme,
  type DevtoolsThemeColors,
  // Utilities
  formatCurrency,
  formatCompact,
  formatDuration,
  formatPercent,
  formatRelativeTime,
  // Individual tabs
  OverviewTab,
  RequestsTab,
  BreakdownTab,
  CacheTab,
  CompareTab,
} from './devtools/index.js';
