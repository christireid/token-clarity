/**
 * @module cost/pricing
 * Model pricing data and cost calculation utilities
 */

import type { ModelPricing, CostEstimate } from './types.js';

/**
 * Current model pricing (USD per 1K tokens)
 * Last updated: January 2025
 */
export const MODEL_PRICING: Record<string, ModelPricing> = {
  // OpenAI models
  'gpt-4o': {
    inputPer1k: 0.0025,
    outputPer1k: 0.01,
    cachedInputPer1k: 0.00125,
  },
  'gpt-4o-mini': {
    inputPer1k: 0.00015,
    outputPer1k: 0.0006,
    cachedInputPer1k: 0.000075,
  },
  'gpt-4-turbo': {
    inputPer1k: 0.01,
    outputPer1k: 0.03,
    cachedInputPer1k: 0.005, // Estimated
  },
  'gpt-4': {
    inputPer1k: 0.03,
    outputPer1k: 0.06,
  },
  'gpt-3.5-turbo': {
    inputPer1k: 0.0005,
    outputPer1k: 0.0015,
  },
  o1: {
    inputPer1k: 0.015,
    outputPer1k: 0.06,
    cachedInputPer1k: 0.0075,
  },
  'o1-mini': {
    inputPer1k: 0.003,
    outputPer1k: 0.012,
    cachedInputPer1k: 0.0015,
  },

  // Anthropic models
  'claude-3-opus': {
    inputPer1k: 0.015,
    outputPer1k: 0.075,
    cachedInputPer1k: 0.0015, // 90% discount
  },
  'claude-3-5-sonnet': {
    inputPer1k: 0.003,
    outputPer1k: 0.015,
    cachedInputPer1k: 0.0003, // 90% discount
  },
  'claude-3-sonnet': {
    inputPer1k: 0.003,
    outputPer1k: 0.015,
    cachedInputPer1k: 0.0003,
  },
  'claude-3-haiku': {
    inputPer1k: 0.00025,
    outputPer1k: 0.00125,
    cachedInputPer1k: 0.000025, // 90% discount
  },

  // Google models
  'gemini-pro': {
    inputPer1k: 0.000125,
    outputPer1k: 0.000375,
  },
  'gemini-ultra': {
    inputPer1k: 0.00125,
    outputPer1k: 0.00375,
  },
  'gemini-1.5-pro': {
    inputPer1k: 0.00125,
    outputPer1k: 0.005,
    cachedInputPer1k: 0.0003125, // 75% discount
  },
  'gemini-1.5-flash': {
    inputPer1k: 0.000075,
    outputPer1k: 0.0003,
    cachedInputPer1k: 0.00001875,
  },

  // Open source (typical API pricing)
  'llama-3': {
    inputPer1k: 0.0002,
    outputPer1k: 0.0002,
  },
  'llama-3.1': {
    inputPer1k: 0.0002,
    outputPer1k: 0.0002,
  },
  mistral: {
    inputPer1k: 0.0002,
    outputPer1k: 0.0006,
  },
  mixtral: {
    inputPer1k: 0.0002,
    outputPer1k: 0.0006,
  },
};

/**
 * Get pricing for a model, with fallback to defaults
 *
 * @param model - Model name
 * @returns Model pricing or default pricing
 */
export function getModelPricing(model: string): ModelPricing {
  const normalized = normalizeModelName(model);
  return (
    MODEL_PRICING[normalized] ?? {
      inputPer1k: 0.001,
      outputPer1k: 0.002,
    }
  );
}

/**
 * Normalize model name for pricing lookup
 */
function normalizeModelName(model: string): string {
  const lower = model.toLowerCase();

  // OpenAI
  if (lower.includes('gpt-4o-mini')) return 'gpt-4o-mini';
  if (lower.includes('gpt-4o')) return 'gpt-4o';
  if (lower.includes('gpt-4-turbo')) return 'gpt-4-turbo';
  if (lower.includes('gpt-4')) return 'gpt-4';
  if (lower.includes('gpt-3.5')) return 'gpt-3.5-turbo';
  if (lower.includes('o1-mini')) return 'o1-mini';
  if (lower.includes('o1')) return 'o1';

  // Anthropic
  if (lower.includes('claude-3-opus')) return 'claude-3-opus';
  if (lower.includes('claude-3-5-sonnet') || lower.includes('claude-3.5-sonnet')) {
    return 'claude-3-5-sonnet';
  }
  if (lower.includes('claude-3-sonnet')) return 'claude-3-sonnet';
  if (lower.includes('claude-3-haiku')) return 'claude-3-haiku';

  // Google
  if (lower.includes('gemini-1.5-pro')) return 'gemini-1.5-pro';
  if (lower.includes('gemini-1.5-flash')) return 'gemini-1.5-flash';
  if (lower.includes('gemini-ultra')) return 'gemini-ultra';
  if (lower.includes('gemini')) return 'gemini-pro';

  // Open source
  if (lower.includes('llama-3.1') || lower.includes('llama3.1')) return 'llama-3.1';
  if (lower.includes('llama')) return 'llama-3';
  if (lower.includes('mixtral')) return 'mixtral';
  if (lower.includes('mistral')) return 'mistral';

  return model;
}

/**
 * Estimate cost for a request
 *
 * @param model - Model name
 * @param inputTokens - Number of input tokens
 * @param outputTokens - Number of output tokens
 * @param cachedInputTokens - Number of tokens served from cache
 * @returns Cost estimate
 *
 * @example
 * ```ts
 * const cost = estimateCost('gpt-4o', 1000, 500, 800);
 * console.log(cost.totalCost); // ~$0.0075
 * console.log(cost.savings?.percentage); // ~40%
 * ```
 */
export function estimateCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
  cachedInputTokens = 0
): CostEstimate {
  const pricing = getModelPricing(model);

  // Calculate costs
  const uncachedInputTokens = inputTokens - cachedInputTokens;
  const cachedPrice = pricing.cachedInputPer1k ?? pricing.inputPer1k;

  const uncachedInputCost = (uncachedInputTokens / 1000) * pricing.inputPer1k;
  const cachedInputCost = (cachedInputTokens / 1000) * cachedPrice;
  const inputCost = uncachedInputCost + cachedInputCost;
  const outputCost = (outputTokens / 1000) * pricing.outputPer1k;
  const totalCost = inputCost + outputCost;

  // Calculate savings
  const fullInputCost = (inputTokens / 1000) * pricing.inputPer1k;
  const savedFromCache = fullInputCost - inputCost;

  const result: CostEstimate = {
    inputCost,
    outputCost,
    totalCost,
  };

  if (cachedInputTokens > 0 && savedFromCache > 0) {
    result.savings = {
      fromCache: savedFromCache,
      percentage: (savedFromCache / (fullInputCost + outputCost)) * 100,
    };
  }

  return result;
}

/**
 * Calculate potential savings from caching
 *
 * @param model - Model name
 * @param cacheableTokens - Number of tokens that can be cached
 * @param cacheHitRate - Expected cache hit rate (0-1)
 * @returns Estimated savings per request
 */
export function calculatePotentialSavings(
  model: string,
  cacheableTokens: number,
  cacheHitRate: number
): {
  savingsPerRequest: number;
  savingsPercentage: number;
} {
  const pricing = getModelPricing(model);
  const cachedPrice = pricing.cachedInputPer1k ?? pricing.inputPer1k;

  const fullCost = (cacheableTokens / 1000) * pricing.inputPer1k;
  const discountedCost = (cacheableTokens / 1000) * cachedPrice;
  const maxSavings = fullCost - discountedCost;

  const expectedSavings = maxSavings * cacheHitRate;
  const savingsPercentage = (expectedSavings / fullCost) * 100;

  return {
    savingsPerRequest: expectedSavings,
    savingsPercentage: cacheHitRate * (1 - cachedPrice / pricing.inputPer1k) * 100,
  };
}

/**
 * Update pricing for a model
 *
 * @param model - Model name
 * @param pricing - New pricing information
 */
export function updatePricing(model: string, pricing: ModelPricing): void {
  MODEL_PRICING[model] = pricing;
}

/**
 * Get all available model pricing
 *
 * @returns Copy of all model pricing
 */
export function getAllPricing(): Record<string, ModelPricing> {
  return { ...MODEL_PRICING };
}
