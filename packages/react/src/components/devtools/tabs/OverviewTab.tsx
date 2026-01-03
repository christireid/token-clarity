/**
 * @module components/devtools/tabs/OverviewTab
 * Overview tab showing session statistics
 */

import { useDevtoolsContext } from '../DevtoolsContext.js';
import { baseStyles } from '../theme.js';
import { formatCurrency, formatCompact, formatDuration, formatPercent } from '../utils.js';

/**
 * OverviewTab - Displays session overview statistics
 */
export function OverviewTab(): JSX.Element {
  const { theme, metrics, budgetStatus } = useDevtoolsContext();
  const { colors } = theme;

  return (
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
              <BudgetProgressBar
                label="Daily"
                spent={budgetStatus.daily.spent}
                limit={budgetStatus.daily.limit}
                status={budgetStatus.daily.status}
                colors={colors}
              />
            )}
            {budgetStatus.monthly.limit && (
              <BudgetProgressBar
                label="Monthly"
                spent={budgetStatus.monthly.spent}
                limit={budgetStatus.monthly.limit}
                status={budgetStatus.monthly.status}
                colors={colors}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface BudgetProgressBarProps {
  label: string;
  spent: number;
  limit: number;
  status: 'ok' | 'warning' | 'exceeded';
  colors: {
    text: string;
    textSecondary: string;
    bgSecondary: string;
    accent: string;
    warning: string;
    error: string;
  };
}

function BudgetProgressBar({ label, spent, limit, status, colors }: BudgetProgressBarProps): JSX.Element {
  const statusColor =
    status === 'exceeded'
      ? colors.error
      : status === 'warning'
        ? colors.warning
        : colors.accent;

  const textColor =
    status === 'exceeded'
      ? colors.error
      : status === 'warning'
        ? colors.warning
        : colors.text;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
        <span style={{ color: colors.textSecondary }}>{label}</span>
        <span style={{ color: textColor }}>
          {formatCurrency(spent)} / {formatCurrency(limit)}
        </span>
      </div>
      <div style={{ ...baseStyles.progressBar, backgroundColor: colors.bgSecondary }}>
        <div
          style={{
            ...baseStyles.progressFill,
            width: `${Math.min(100, (spent / limit) * 100)}%`,
            backgroundColor: statusColor,
          }}
        />
      </div>
    </div>
  );
}
