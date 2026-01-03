/**
 * @module components/devtools/tabs/CacheTab
 * Cache performance tab
 */

import { useDevtoolsContext } from '../DevtoolsContext.js';
import { baseStyles, icons } from '../theme.js';
import { formatCurrency, formatCompact, formatPercent, calculateSavingsPercent } from '../utils.js';

/**
 * CacheTab - Displays cache performance metrics
 */
export function CacheTab(): JSX.Element {
  const { theme, metrics } = useDevtoolsContext();
  const { colors } = theme;

  const efficiency = calculateSavingsPercent(metrics.totalCost, metrics.totalSavings);

  return (
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
              {formatPercent(efficiency)}
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
            <li>Use cache breakpoints strategically</li>
          </ul>
        </div>
      </div>

      <div style={baseStyles.section}>
        <div style={{ ...baseStyles.sectionTitle, color: colors.textSecondary }}>
          Savings Breakdown
        </div>
        <div
          style={{
            padding: '12px',
            backgroundColor: colors.bgSecondary,
            borderRadius: '4px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ color: colors.textSecondary }}>Without caching:</span>
            <span style={{ color: colors.text }}>
              {formatCurrency(metrics.totalCost + metrics.totalSavings)}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ color: colors.textSecondary }}>With caching:</span>
            <span style={{ color: colors.accent }}>{formatCurrency(metrics.totalCost)}</span>
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              paddingTop: '8px',
              borderTop: `1px solid ${colors.border}`,
            }}
          >
            <span style={{ color: colors.text, fontWeight: 600 }}>Total Saved:</span>
            <span style={{ color: colors.success, fontWeight: 600 }}>
              {formatCurrency(metrics.totalSavings)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
