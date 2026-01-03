/**
 * @module components/devtools/tabs/BreakdownTab
 * Breakdown tab showing usage by model and provider
 */

import { useDevtoolsContext } from '../DevtoolsContext.js';
import { baseStyles } from '../theme.js';
import { formatCurrency, formatCompact } from '../utils.js';

/**
 * BreakdownTab - Displays usage breakdown by model and provider
 */
export function BreakdownTab(): JSX.Element {
  const { theme, metrics } = useDevtoolsContext();
  const { colors } = theme;

  return (
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
                <BreakdownRow
                  key={model}
                  label={model}
                  requests={data.requests}
                  tokens={data.tokens}
                  cost={data.cost}
                  colors={colors}
                />
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
                <BreakdownRow
                  key={provider}
                  label={provider}
                  requests={data.requests}
                  tokens={data.tokens}
                  cost={data.cost}
                  colors={colors}
                  capitalize
                />
              ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface BreakdownRowProps {
  label: string;
  requests: number;
  tokens: number;
  cost: number;
  colors: {
    text: string;
    textSecondary: string;
    bgSecondary: string;
    accent: string;
  };
  capitalize?: boolean;
}

function BreakdownRow({
  label,
  requests,
  tokens,
  cost,
  colors,
  capitalize = false,
}: BreakdownRowProps): JSX.Element {
  return (
    <div
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
        <div
          style={{
            color: colors.text,
            fontWeight: 500,
            textTransform: capitalize ? 'capitalize' : 'none',
          }}
        >
          {label}
        </div>
        <div style={{ color: colors.textSecondary, fontSize: '10px' }}>
          {requests} requests • {formatCompact(tokens)} tokens
        </div>
      </div>
      <div style={{ color: colors.accent, fontWeight: 600 }}>
        {formatCurrency(cost)}
      </div>
    </div>
  );
}
