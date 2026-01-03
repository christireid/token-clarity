/**
 * @module components/devtools/theme
 * Customizable theme system for TokenDevtoolsPanel
 */

import type { CSSProperties } from 'react';

/**
 * Color palette for devtools themes
 */
export interface DevtoolsThemeColors {
  /** Primary background color */
  bg: string;
  /** Secondary/elevated background */
  bgSecondary: string;
  /** Hover state background */
  bgHover: string;
  /** Primary text color */
  text: string;
  /** Secondary/muted text */
  textSecondary: string;
  /** Border color */
  border: string;
  /** Accent/highlight color */
  accent: string;
  /** Success state color */
  success: string;
  /** Warning state color */
  warning: string;
  /** Error state color */
  error: string;
}

/**
 * Full theme configuration
 */
export interface DevtoolsTheme {
  colors: DevtoolsThemeColors;
  /** Font family for the panel */
  fontFamily: string;
  /** Base font size */
  fontSize: string;
  /** Border radius for elements */
  borderRadius: string;
  /** Box shadow for the panel */
  boxShadow: string;
}

/**
 * Default dark theme
 */
export const darkTheme: DevtoolsTheme = {
  colors: {
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
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  fontSize: '12px',
  borderRadius: '8px',
  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
};

/**
 * Default light theme
 */
export const lightTheme: DevtoolsTheme = {
  colors: {
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
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  fontSize: '12px',
  borderRadius: '8px',
  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
};

/**
 * Merge custom theme with defaults
 */
export function mergeTheme(
  base: DevtoolsTheme,
  custom?: Partial<DevtoolsTheme>
): DevtoolsTheme {
  if (!custom) return base;

  return {
    ...base,
    ...custom,
    colors: {
      ...base.colors,
      ...custom.colors,
    },
  };
}

/**
 * Get theme based on preference
 */
export function getTheme(
  preference: 'light' | 'dark' | 'auto',
  customTheme?: Partial<DevtoolsTheme>
): DevtoolsTheme {
  let baseTheme: DevtoolsTheme;

  if (preference === 'auto') {
    const prefersDark =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches;
    baseTheme = prefersDark ? darkTheme : lightTheme;
  } else {
    baseTheme = preference === 'dark' ? darkTheme : lightTheme;
  }

  return mergeTheme(baseTheme, customTheme);
}

/**
 * Base styles for devtools components
 */
export const baseStyles: Record<string, CSSProperties> = {
  container: {
    position: 'fixed',
    fontSize: '12px',
    lineHeight: 1.4,
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

/**
 * Icon constants
 */
export const icons = {
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
  compare: '⚖️',
  route: '🔀',
};
