/**
 * @module components/devtools
 * Composable devtools components
 */

// Main panel
export { DevtoolsPanel, type DevtoolsPanelProps } from './DevtoolsPanel.js';

// Context
export {
  DevtoolsProvider,
  useDevtoolsContext,
  useOptionalDevtoolsContext,
  type DevtoolsProviderProps,
  type DevtoolsContextValue,
  type DevtoolsRequestEntry,
  type DevtoolsMetrics,
  type DevtoolsPanelPosition,
  type DevtoolsTab,
  type DevtoolsBudgetStatus,
  type BudgetPeriodStatus,
} from './DevtoolsContext.js';

// Theme
export {
  darkTheme,
  lightTheme,
  mergeTheme,
  getTheme,
  baseStyles,
  icons,
  type DevtoolsTheme,
  type DevtoolsThemeColors,
} from './theme.js';

// Utilities
export {
  formatCurrency,
  formatCompact,
  formatDuration,
  formatPercent,
  formatRelativeTime,
  getPositionStyles,
  calculateSavingsPercent,
  getStatusColor,
  truncate,
  generateId,
} from './utils.js';

// Individual tabs (for custom compositions)
export { OverviewTab } from './tabs/OverviewTab.js';
export { RequestsTab } from './tabs/RequestsTab.js';
export { BreakdownTab } from './tabs/BreakdownTab.js';
export { CacheTab } from './tabs/CacheTab.js';
export { CompareTab } from './tabs/CompareTab.js';
