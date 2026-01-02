/**
 * Tests for cost estimation module
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  estimateCost,
  MODEL_PRICING,
  getModelPricing,
  calculatePotentialSavings,
  createUsageTracker,
} from '../index.js';

describe('estimateCost', () => {
  it('should calculate cost for GPT-4o', () => {
    const cost = estimateCost('gpt-4o', 1000, 500);

    expect(cost.inputCost).toBeGreaterThan(0);
    expect(cost.outputCost).toBeGreaterThan(0);
    expect(cost.totalCost).toBe(cost.inputCost + cost.outputCost);
  });

  it('should calculate savings from cached tokens', () => {
    const costWithCache = estimateCost('gpt-4o', 1000, 500, 800);
    const costWithoutCache = estimateCost('gpt-4o', 1000, 500, 0);

    expect(costWithCache.totalCost).toBeLessThan(costWithoutCache.totalCost);
    expect(costWithCache.savings).toBeDefined();
    expect(costWithCache.savings?.fromCache).toBeGreaterThan(0);
    expect(costWithCache.savings?.percentage).toBeGreaterThan(0);
  });

  it('should not have savings when no cached tokens', () => {
    const cost = estimateCost('gpt-4o', 1000, 500, 0);
    expect(cost.savings).toBeUndefined();
  });

  it('should handle different models', () => {
    const gpt4oCost = estimateCost('gpt-4o', 1000, 500);
    const gpt4oMiniCost = estimateCost('gpt-4o-mini', 1000, 500);

    // GPT-4o-mini should be cheaper
    expect(gpt4oMiniCost.totalCost).toBeLessThan(gpt4oCost.totalCost);
  });

  it('should handle unknown models with default pricing', () => {
    const cost = estimateCost('unknown-model', 1000, 500);
    expect(cost.totalCost).toBeGreaterThan(0);
  });
});

describe('MODEL_PRICING', () => {
  it('should have OpenAI model pricing', () => {
    expect(MODEL_PRICING['gpt-4o']).toBeDefined();
    expect(MODEL_PRICING['gpt-4o']?.inputPer1k).toBeGreaterThan(0);
    expect(MODEL_PRICING['gpt-4o']?.outputPer1k).toBeGreaterThan(0);
  });

  it('should have cached input pricing for supported models', () => {
    expect(MODEL_PRICING['gpt-4o']?.cachedInputPer1k).toBeDefined();
    expect(MODEL_PRICING['claude-3-5-sonnet']?.cachedInputPer1k).toBeDefined();
  });

  it('should have Anthropic model pricing', () => {
    expect(MODEL_PRICING['claude-3-opus']).toBeDefined();
    expect(MODEL_PRICING['claude-3-5-sonnet']).toBeDefined();
  });

  it('should have Google model pricing', () => {
    expect(MODEL_PRICING['gemini-1.5-pro']).toBeDefined();
  });
});

describe('getModelPricing', () => {
  it('should return pricing for known model', () => {
    const pricing = getModelPricing('gpt-4o');
    expect(pricing.inputPer1k).toBe(MODEL_PRICING['gpt-4o']?.inputPer1k);
  });

  it('should normalize model names', () => {
    const pricing = getModelPricing('gpt-4o-2024-01-01');
    expect(pricing.inputPer1k).toBe(MODEL_PRICING['gpt-4o']?.inputPer1k);
  });

  it('should return default pricing for unknown model', () => {
    const pricing = getModelPricing('unknown-model');
    expect(pricing.inputPer1k).toBeGreaterThan(0);
    expect(pricing.outputPer1k).toBeGreaterThan(0);
  });
});

describe('calculatePotentialSavings', () => {
  it('should calculate savings with 100% hit rate', () => {
    const savings = calculatePotentialSavings('gpt-4o', 10000, 1.0);
    expect(savings.savingsPerRequest).toBeGreaterThan(0);
    expect(savings.savingsPercentage).toBeGreaterThan(0);
  });

  it('should calculate proportional savings for partial hit rate', () => {
    const fullSavings = calculatePotentialSavings('gpt-4o', 10000, 1.0);
    const halfSavings = calculatePotentialSavings('gpt-4o', 10000, 0.5);

    expect(halfSavings.savingsPerRequest).toBeLessThan(fullSavings.savingsPerRequest);
  });

  it('should return zero savings with 0% hit rate', () => {
    const savings = calculatePotentialSavings('gpt-4o', 10000, 0);
    expect(savings.savingsPerRequest).toBe(0);
  });
});

describe('createUsageTracker', () => {
  let tracker: ReturnType<typeof createUsageTracker>;

  beforeEach(() => {
    tracker = createUsageTracker();
  });

  it('should track a request', () => {
    tracker.trackRequest({
      model: 'gpt-4o',
      inputTokens: 1000,
      outputTokens: 500,
      totalTokens: 1500,
      cost: 0.01,
    });

    const stats = tracker.getSessionStats();
    expect(stats.requestCount).toBe(1);
    expect(stats.cost).toBe(0.01);
    expect(stats.inputTokens).toBe(1000);
    expect(stats.outputTokens).toBe(500);
  });

  it('should accumulate multiple requests', () => {
    tracker.trackRequest({
      model: 'gpt-4o',
      inputTokens: 1000,
      outputTokens: 500,
      totalTokens: 1500,
      cost: 0.01,
    });
    tracker.trackRequest({
      model: 'gpt-4o',
      inputTokens: 2000,
      outputTokens: 1000,
      totalTokens: 3000,
      cost: 0.02,
    });

    const stats = tracker.getSessionStats();
    expect(stats.requestCount).toBe(2);
    expect(stats.cost).toBe(0.03);
    expect(stats.inputTokens).toBe(3000);
  });

  it('should track savings from cache', () => {
    tracker.trackRequest({
      model: 'gpt-4o',
      inputTokens: 1000,
      outputTokens: 500,
      cachedTokens: 800,
      totalTokens: 1500,
      cost: 0.008,
      savedFromCache: 0.002,
    });

    const stats = tracker.getSessionStats();
    expect(stats.cachedTokens).toBe(800);
    expect(stats.savings).toBe(0.002);
  });

  it('should reset tracking', () => {
    tracker.trackRequest({
      model: 'gpt-4o',
      inputTokens: 1000,
      outputTokens: 500,
      totalTokens: 1500,
      cost: 0.01,
    });

    tracker.reset();
    const stats = tracker.getSessionStats();
    expect(stats.requestCount).toBe(0);
    expect(stats.cost).toBe(0);
  });

  it('should export data', () => {
    tracker.trackRequest({
      model: 'gpt-4o',
      inputTokens: 1000,
      outputTokens: 500,
      totalTokens: 1500,
      cost: 0.01,
    });

    const data = tracker.exportData();
    expect(data.requests).toHaveLength(1);
    expect(data.totals.cost).toBe(0.01);
  });

  it('should get historical stats', () => {
    tracker.trackRequest({
      model: 'gpt-4o',
      inputTokens: 1000,
      outputTokens: 500,
      totalTokens: 1500,
      cost: 0.01,
    });

    const historical = tracker.getHistoricalStats(30);
    expect(historical.requestCount).toBe(1);
    expect(historical.startDate).toBeInstanceOf(Date);
    expect(historical.endDate).toBeInstanceOf(Date);
  });
});
