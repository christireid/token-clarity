/**
 * @module budget/presets
 * Preset budget configurations for common AI models
 */

import type { TokenBudget } from './types.js';

/**
 * Model budget presets with context limits and output caps
 */
export const MODEL_BUDGETS: Record<string, TokenBudget> = {
  // OpenAI models
  'gpt-4o': {
    maxInputTokens: 128000,
    maxOutputTokens: 16384,
    warningThreshold: 0.8,
    criticalThreshold: 0.95,
  },
  'gpt-4o-mini': {
    maxInputTokens: 128000,
    maxOutputTokens: 16384,
    warningThreshold: 0.8,
    criticalThreshold: 0.95,
  },
  'gpt-4-turbo': {
    maxInputTokens: 128000,
    maxOutputTokens: 4096,
    warningThreshold: 0.8,
    criticalThreshold: 0.95,
  },
  'gpt-4': {
    maxInputTokens: 8192,
    maxOutputTokens: 4096,
    warningThreshold: 0.8,
    criticalThreshold: 0.95,
  },
  'gpt-3.5-turbo': {
    maxInputTokens: 16385,
    maxOutputTokens: 4096,
    warningThreshold: 0.8,
    criticalThreshold: 0.95,
  },
  'o1': {
    maxInputTokens: 200000,
    maxOutputTokens: 100000,
    warningThreshold: 0.8,
    criticalThreshold: 0.95,
  },
  'o1-mini': {
    maxInputTokens: 128000,
    maxOutputTokens: 65536,
    warningThreshold: 0.8,
    criticalThreshold: 0.95,
  },

  // Anthropic models
  'claude-3-opus': {
    maxInputTokens: 200000,
    maxOutputTokens: 4096,
    warningThreshold: 0.8,
    criticalThreshold: 0.95,
  },
  'claude-3-5-sonnet': {
    maxInputTokens: 200000,
    maxOutputTokens: 8192,
    warningThreshold: 0.8,
    criticalThreshold: 0.95,
  },
  'claude-3-sonnet': {
    maxInputTokens: 200000,
    maxOutputTokens: 4096,
    warningThreshold: 0.8,
    criticalThreshold: 0.95,
  },
  'claude-3-haiku': {
    maxInputTokens: 200000,
    maxOutputTokens: 4096,
    warningThreshold: 0.8,
    criticalThreshold: 0.95,
  },

  // Google models
  'gemini-pro': {
    maxInputTokens: 30720,
    maxOutputTokens: 2048,
    warningThreshold: 0.8,
    criticalThreshold: 0.95,
  },
  'gemini-ultra': {
    maxInputTokens: 30720,
    maxOutputTokens: 2048,
    warningThreshold: 0.8,
    criticalThreshold: 0.95,
  },
  'gemini-1.5-pro': {
    maxInputTokens: 1048576, // 1M tokens
    maxOutputTokens: 8192,
    warningThreshold: 0.8,
    criticalThreshold: 0.95,
  },
  'gemini-1.5-flash': {
    maxInputTokens: 1048576, // 1M tokens
    maxOutputTokens: 8192,
    warningThreshold: 0.8,
    criticalThreshold: 0.95,
  },

  // Open source models (common configurations)
  'llama-3': {
    maxInputTokens: 8192,
    maxOutputTokens: 2048,
    warningThreshold: 0.8,
    criticalThreshold: 0.95,
  },
  'llama-3.1': {
    maxInputTokens: 128000,
    maxOutputTokens: 4096,
    warningThreshold: 0.8,
    criticalThreshold: 0.95,
  },
  mistral: {
    maxInputTokens: 32768,
    maxOutputTokens: 4096,
    warningThreshold: 0.8,
    criticalThreshold: 0.95,
  },
  mixtral: {
    maxInputTokens: 32768,
    maxOutputTokens: 4096,
    warningThreshold: 0.8,
    criticalThreshold: 0.95,
  },
};

/**
 * Get budget for a model, with fallback to defaults
 *
 * @param model - Model name
 * @param overrides - Optional budget overrides
 * @returns Token budget for the model
 */
export function getModelBudget(
  model: string,
  overrides?: Partial<TokenBudget>
): TokenBudget {
  const preset = MODEL_BUDGETS[model] ?? {
    maxInputTokens: 4096,
    maxOutputTokens: 1024,
    warningThreshold: 0.8,
    criticalThreshold: 0.95,
  };

  return {
    ...preset,
    ...overrides,
  };
}

/**
 * Default budget for unknown models
 */
export const DEFAULT_BUDGET: TokenBudget = {
  maxInputTokens: 4096,
  maxOutputTokens: 1024,
  warningThreshold: 0.8,
  criticalThreshold: 0.95,
};

/**
 * Task type output ratios
 * Determines what fraction of available tokens to use for output
 */
export const TASK_OUTPUT_RATIOS: Record<string, number> = {
  chat: 0.5, // Balanced input/output for conversations
  code: 0.8, // Code generation often needs more output
  summary: 0.3, // Summaries should be concise
  analysis: 0.6, // Analysis needs moderate output
};
