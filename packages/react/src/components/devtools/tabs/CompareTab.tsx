/**
 * @module components/devtools/tabs/CompareTab
 * Provider comparison tab for cost/performance analysis
 */

import { useState, useMemo } from 'react';
import { estimateCost, type Provider } from '@token-optimizer/core';
import { useDevtoolsContext } from '../DevtoolsContext.js';
import { baseStyles, icons } from '../theme.js';
import { formatCurrency, formatCompact } from '../utils.js';

/**
 * Model configuration for comparison
 */
interface ModelConfig {
  provider: Provider;
  model: string;
  displayName: string;
}

/**
 * Default models to compare
 */
const defaultModels: ModelConfig[] = [
  { provider: 'openai', model: 'gpt-4o', displayName: 'GPT-4o' },
  { provider: 'openai', model: 'gpt-4o-mini', displayName: 'GPT-4o Mini' },
  { provider: 'anthropic', model: 'claude-3-5-sonnet', displayName: 'Claude 3.5 Sonnet' },
  { provider: 'anthropic', model: 'claude-3-haiku', displayName: 'Claude 3 Haiku' },
  { provider: 'google', model: 'gemini-1.5-pro', displayName: 'Gemini 1.5 Pro' },
  { provider: 'google', model: 'gemini-1.5-flash', displayName: 'Gemini 1.5 Flash' },
];

/**
 * CompareTab - Compare costs across providers and models
 */
export function CompareTab(): JSX.Element {
  const { theme, metrics } = useDevtoolsContext();
  const { colors } = theme;

  const [inputTokens, setInputTokens] = useState(1000);
  const [outputTokens, setOutputTokens] = useState(500);
  const [requestsPerDay, setRequestsPerDay] = useState(100);

  // Calculate costs for each model
  const comparisons = useMemo(() => {
    return defaultModels.map((config) => {
      try {
        const estimate = estimateCost(config.model, inputTokens, outputTokens);
        const dailyCost = estimate.totalCost * requestsPerDay;
        const monthlyCost = dailyCost * 30;
        return {
          ...config,
          perRequest: estimate.totalCost,
          daily: dailyCost,
          monthly: monthlyCost,
          inputCost: estimate.inputCost,
          outputCost: estimate.outputCost,
        };
      } catch {
        return {
          ...config,
          perRequest: 0,
          daily: 0,
          monthly: 0,
          inputCost: 0,
          outputCost: 0,
          error: true,
        };
      }
    });
  }, [inputTokens, outputTokens, requestsPerDay]);

  // Sort by cost and find best value
  const sortedComparisons = [...comparisons]
    .filter((c) => !('error' in c))
    .sort((a, b) => a.monthly - b.monthly);
  const bestValue = sortedComparisons[0];
  const mostExpensive = sortedComparisons[sortedComparisons.length - 1];
  const potentialSavings = mostExpensive && bestValue
    ? mostExpensive.monthly - bestValue.monthly
    : 0;

  return (
    <div style={baseStyles.content}>
      {/* Configuration */}
      <div style={baseStyles.section}>
        <div style={{ ...baseStyles.sectionTitle, color: colors.textSecondary }}>
          {icons.compare} Estimate Parameters
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ color: colors.textSecondary, fontSize: '11px', minWidth: '100px' }}>
              Input Tokens:
            </label>
            <input
              type="number"
              value={inputTokens}
              onChange={(e) => setInputTokens(Number(e.target.value))}
              style={{
                flex: 1,
                padding: '4px 8px',
                backgroundColor: colors.bgSecondary,
                border: `1px solid ${colors.border}`,
                borderRadius: '4px',
                color: colors.text,
                fontSize: '11px',
              }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ color: colors.textSecondary, fontSize: '11px', minWidth: '100px' }}>
              Output Tokens:
            </label>
            <input
              type="number"
              value={outputTokens}
              onChange={(e) => setOutputTokens(Number(e.target.value))}
              style={{
                flex: 1,
                padding: '4px 8px',
                backgroundColor: colors.bgSecondary,
                border: `1px solid ${colors.border}`,
                borderRadius: '4px',
                color: colors.text,
                fontSize: '11px',
              }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ color: colors.textSecondary, fontSize: '11px', minWidth: '100px' }}>
              Requests/Day:
            </label>
            <input
              type="number"
              value={requestsPerDay}
              onChange={(e) => setRequestsPerDay(Number(e.target.value))}
              style={{
                flex: 1,
                padding: '4px 8px',
                backgroundColor: colors.bgSecondary,
                border: `1px solid ${colors.border}`,
                borderRadius: '4px',
                color: colors.text,
                fontSize: '11px',
              }}
            />
          </div>
        </div>
      </div>

      {/* Savings highlight */}
      {potentialSavings > 0 && (
        <div
          style={{
            padding: '12px',
            backgroundColor: `${colors.success}20`,
            borderRadius: '4px',
            marginBottom: '16px',
            border: `1px solid ${colors.success}40`,
          }}
        >
          <div style={{ color: colors.success, fontWeight: 600, marginBottom: '4px' }}>
            {icons.cost} Potential Monthly Savings
          </div>
          <div style={{ color: colors.text, fontSize: '20px', fontWeight: 700 }}>
            {formatCurrency(potentialSavings)}
          </div>
          <div style={{ color: colors.textSecondary, fontSize: '10px' }}>
            Switch from {mostExpensive?.displayName} to {bestValue?.displayName}
          </div>
        </div>
      )}

      {/* Comparison table */}
      <div style={baseStyles.section}>
        <div style={{ ...baseStyles.sectionTitle, color: colors.textSecondary }}>
          Cost Comparison
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {sortedComparisons.map((item, index) => (
            <div
              key={`${item.provider}-${item.model}`}
              style={{
                padding: '8px 12px',
                backgroundColor: index === 0 ? `${colors.success}15` : colors.bgSecondary,
                borderRadius: '4px',
                border: index === 0 ? `1px solid ${colors.success}40` : 'none',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ color: colors.text, fontWeight: 500 }}>
                    {item.displayName}
                  </span>
                  {index === 0 && (
                    <span
                      style={{
                        ...baseStyles.badge,
                        backgroundColor: colors.success,
                        color: '#fff',
                        fontSize: '9px',
                      }}
                    >
                      BEST VALUE
                    </span>
                  )}
                </div>
                <div style={{ color: colors.textSecondary, fontSize: '10px' }}>
                  {formatCurrency(item.perRequest)}/req • {formatCurrency(item.daily)}/day
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ color: colors.accent, fontWeight: 600 }}>
                  {formatCurrency(item.monthly)}
                </div>
                <div style={{ color: colors.textSecondary, fontSize: '10px' }}>
                  /month
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Current usage context */}
      {metrics.totalRequests > 0 && (
        <div style={baseStyles.section}>
          <div style={{ ...baseStyles.sectionTitle, color: colors.textSecondary }}>
            Your Current Session
          </div>
          <div
            style={{
              padding: '12px',
              backgroundColor: colors.bgSecondary,
              borderRadius: '4px',
              fontSize: '11px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={{ color: colors.textSecondary }}>Avg tokens/request:</span>
              <span style={{ color: colors.text }}>
                {formatCompact(
                  (metrics.totalInputTokens + metrics.totalOutputTokens) / metrics.totalRequests
                )}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={{ color: colors.textSecondary }}>Avg cost/request:</span>
              <span style={{ color: colors.accent }}>
                {formatCurrency(metrics.totalCost / metrics.totalRequests)}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: colors.textSecondary }}>Projected monthly:</span>
              <span style={{ color: colors.text }}>
                {formatCurrency((metrics.totalCost / metrics.totalRequests) * requestsPerDay * 30)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
