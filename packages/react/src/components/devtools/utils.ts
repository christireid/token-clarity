/**
 * @module components/devtools/utils
 * Utility functions for devtools components
 */

import type { CSSProperties } from 'react';
import type { DevtoolsPanelPosition } from './DevtoolsContext.js';

/**
 * Format a number as currency
 */
export function formatCurrency(value: number): string {
  return value < 0.01 ? `$${value.toFixed(4)}` : `$${value.toFixed(2)}`;
}

/**
 * Format a number with compact notation
 */
export function formatCompact(value: number): string {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return value.toFixed(0);
}

/**
 * Format duration in ms
 */
export function formatDuration(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${ms.toFixed(0)}ms`;
}

/**
 * Format percentage
 */
export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

/**
 * Format relative time
 */
export function formatRelativeTime(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return new Date(timestamp).toLocaleDateString();
}

/**
 * Get position styles based on position prop
 */
export function getPositionStyles(position: DevtoolsPanelPosition): CSSProperties {
  const margin = '16px';
  switch (position) {
    case 'bottom-right':
      return { bottom: margin, right: margin };
    case 'bottom-left':
      return { bottom: margin, left: margin };
    case 'top-right':
      return { top: margin, right: margin };
    case 'top-left':
      return { top: margin, left: margin };
    case 'center':
      return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
    default:
      return { bottom: margin, right: margin };
  }
}

/**
 * Calculate savings percentage
 */
export function calculateSavingsPercent(cost: number, savings: number): number {
  const total = cost + savings;
  return total > 0 ? savings / total : 0;
}

/**
 * Determine status color based on threshold
 */
export function getStatusColor(
  value: number,
  limit: number,
  colors: { success: string; warning: string; error: string }
): string {
  const ratio = value / limit;
  if (ratio >= 1) return colors.error;
  if (ratio >= 0.8) return colors.warning;
  return colors.success;
}

/**
 * Truncate string with ellipsis
 */
export function truncate(str: string, maxLength: number): string {
  return str.length > maxLength ? `${str.slice(0, maxLength - 3)}...` : str;
}

/**
 * Generate unique ID
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
