/**
 * @module components/devtools/tabs/RequestsTab
 * Requests history tab
 */

import { useDevtoolsContext } from '../DevtoolsContext.js';
import { baseStyles, icons } from '../theme.js';
import { formatCurrency, formatCompact, formatDuration, formatRelativeTime } from '../utils.js';

/**
 * RequestsTab - Displays request history table
 */
export function RequestsTab(): JSX.Element {
  const { theme, requestHistory, onRequestClick } = useDevtoolsContext();
  const { colors } = theme;

  if (requestHistory.length === 0) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: colors.textSecondary }}>
        No requests yet
      </div>
    );
  }

  return (
    <div style={{ ...baseStyles.content, padding: 0 }}>
      <table style={baseStyles.table}>
        <thead>
          <tr style={{ backgroundColor: colors.bgSecondary }}>
            <th style={{ ...baseStyles.th, borderColor: colors.border, color: colors.textSecondary }}>
              Time
            </th>
            <th style={{ ...baseStyles.th, borderColor: colors.border, color: colors.textSecondary }}>
              Model
            </th>
            <th style={{ ...baseStyles.th, borderColor: colors.border, color: colors.textSecondary }}>
              Tokens
            </th>
            <th style={{ ...baseStyles.th, borderColor: colors.border, color: colors.textSecondary }}>
              Cost
            </th>
            <th style={{ ...baseStyles.th, borderColor: colors.border, color: colors.textSecondary }}>
              Latency
            </th>
          </tr>
        </thead>
        <tbody>
          {requestHistory
            .slice()
            .reverse()
            .slice(0, 50)
            .map((req) => (
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
                  {req.error && (
                    <span
                      style={{
                        ...baseStyles.badge,
                        marginLeft: '4px',
                        backgroundColor: `${colors.error}30`,
                        color: colors.error,
                      }}
                    >
                      {icons.error}
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
    </div>
  );
}
