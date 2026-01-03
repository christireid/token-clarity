/**
 * @module components/devtools/DevtoolsPanel
 * Main devtools panel component (composable version)
 */

import { useRef, type CSSProperties, type ReactNode } from 'react';
import {
  DevtoolsProvider,
  useDevtoolsContext,
  type DevtoolsProviderProps,
  type DevtoolsTab,
  type DevtoolsPanelPosition,
} from './DevtoolsContext.js';
import { baseStyles, icons } from './theme.js';
import { getPositionStyles, formatCurrency, formatCompact } from './utils.js';
import { OverviewTab, RequestsTab, BreakdownTab, CacheTab, CompareTab } from './tabs/index.js';

/**
 * Props for DevtoolsPanel
 */
export interface DevtoolsPanelProps extends Omit<DevtoolsProviderProps, 'children'> {
  /** Panel position */
  position?: DevtoolsPanelPosition;
  /** Minimum width when expanded */
  minWidth?: number;
  /** Maximum width when expanded */
  maxWidth?: number;
  /** Height when expanded */
  height?: number;
  /** Custom z-index */
  zIndex?: number;
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
  /** Available tabs (defaults to all) */
  tabs?: DevtoolsTab[];
}

/**
 * Default tab configuration
 */
const defaultTabs: { id: DevtoolsTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'requests', label: 'Requests' },
  { id: 'breakdown', label: 'Breakdown' },
  { id: 'cache', label: 'Cache' },
  { id: 'compare', label: 'Compare' },
];

/**
 * Inner panel component that uses context
 */
function DevtoolsPanelInner({
  position = 'bottom-right',
  minWidth = 320,
  maxWidth = 480,
  height = 400,
  zIndex = 9999,
  disabled = false,
  devOnly = true,
  className,
  style,
  renderHeader,
  renderFooter,
  tabs: enabledTabs,
}: Omit<DevtoolsPanelProps, keyof DevtoolsProviderProps>): JSX.Element | null {
  const {
    isCollapsed,
    activeTab,
    theme,
    metrics,
    setActiveTab,
    toggleCollapse,
    onReset,
  } = useDevtoolsContext();

  const panelRef = useRef<HTMLDivElement>(null);
  const { colors, fontFamily, borderRadius, boxShadow } = theme;

  // Check if should render
  if (disabled) return null;
  if (devOnly && typeof process !== 'undefined' && process.env?.NODE_ENV === 'production') {
    return null;
  }

  // Filter tabs if specified
  const visibleTabs = enabledTabs
    ? defaultTabs.filter((t) => enabledTabs.includes(t.id))
    : defaultTabs;

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
          fontFamily,
          ...style,
        }}
        onClick={toggleCollapse}
        title="Token Devtools"
      >
        <span style={{ fontSize: '20px' }}>{icons.token}</span>
      </div>
    );
  }

  // Render active tab content
  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return <OverviewTab />;
      case 'requests':
        return <RequestsTab />;
      case 'breakdown':
        return <BreakdownTab />;
      case 'cache':
        return <CacheTab />;
      case 'compare':
        return <CompareTab />;
      default:
        return <OverviewTab />;
    }
  };

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
        fontFamily,
        borderRadius,
        boxShadow,
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
          <span style={{ cursor: 'pointer', fontSize: '16px' }} title="Collapse">
            {icons.collapse}
          </span>
        </div>
      </div>

      {/* Custom header */}
      {renderHeader?.()}

      {/* Tabs */}
      <div style={{ ...baseStyles.tabs, borderColor: colors.border, backgroundColor: colors.bg }}>
        {visibleTabs.map((tab) => (
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
          onClick={onReset}
          title="Reset tracking"
        >
          {icons.reset}
        </button>
      </div>

      {/* Tab content */}
      <div style={{ height, overflowY: 'auto' }}>{renderTabContent()}</div>

      {/* Custom footer */}
      {renderFooter?.()}
    </div>
  );
}

/**
 * DevtoolsPanel - Main devtools panel with provider
 *
 * @example
 * ```tsx
 * <DevtoolsPanel
 *   sessionStats={stats}
 *   requestHistory={history}
 *   position="bottom-right"
 *   themeMode="dark"
 * />
 * ```
 */
export function DevtoolsPanel({
  // Provider props
  sessionStats,
  requestHistory,
  customMetrics,
  defaultTab,
  defaultCollapsed,
  themeMode,
  customTheme,
  budgetStatus,
  onRequestClick,
  onReset,
  // Panel props
  ...panelProps
}: DevtoolsPanelProps): JSX.Element {
  return (
    <DevtoolsProvider
      sessionStats={sessionStats}
      requestHistory={requestHistory}
      customMetrics={customMetrics}
      defaultTab={defaultTab}
      defaultCollapsed={defaultCollapsed}
      themeMode={themeMode}
      customTheme={customTheme}
      budgetStatus={budgetStatus}
      onRequestClick={onRequestClick}
      onReset={onReset}
    >
      <DevtoolsPanelInner {...panelProps} />
    </DevtoolsProvider>
  );
}
