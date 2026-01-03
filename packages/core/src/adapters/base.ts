/**
 * @module adapters/base
 * Base class for provider adapters
 */

import type { ChatMessage, Provider } from '../types/index.js';
import type {
  ProviderAdapter,
  ProviderCapabilities,
  TokenUsage,
  CostEstimate,
  ModelPricing,
  ProviderMessage,
  NormalizedResponse,
  CountOptions,
} from './types.js';
import { estimateTokens, estimateChatTokens, DEFAULT_CHAT_OVERHEAD } from '../tokenizers/estimation.js';

/**
 * Abstract base class for provider adapters.
 * Provides common functionality and default implementations.
 */
export abstract class BaseAdapter implements ProviderAdapter {
  abstract readonly name: Provider;
  abstract readonly supports: ProviderCapabilities;

  /** Pricing table for models */
  protected abstract readonly pricing: Map<string, ModelPricing>;

  /** Default model for this provider */
  protected abstract readonly defaultModel: string;

  /**
   * Count tokens in text using estimation.
   * Override in subclasses for more accurate counting.
   */
  async countTokens(text: string, _options?: CountOptions): Promise<number> {
    return estimateTokens(text);
  }

  /**
   * Count tokens for messages using estimation.
   * Override in subclasses for provider-specific overhead.
   */
  async countMessages(messages: ChatMessage[], options?: CountOptions): Promise<number> {
    const includeOverhead = options?.includeOverhead ?? true;
    // If overhead is disabled, use minimal config
    const config = includeOverhead
      ? DEFAULT_CHAT_OVERHEAD
      : { perMessage: 0, conversationOverhead: 0, nameOverhead: 0, toolCallOverhead: 0 };
    return estimateChatTokens(messages, config);
  }

  /**
   * Estimate cost for token usage
   */
  estimateCost(usage: TokenUsage, model: string): CostEstimate {
    const pricing = this.getPricing(model) ?? this.getPricing(this.defaultModel);

    if (!pricing) {
      return {
        inputCost: 0,
        outputCost: 0,
        totalCost: 0,
        model,
        provider: this.name,
      };
    }

    // Calculate base costs
    const inputCost = (usage.input / 1000) * pricing.inputPer1k;
    const outputCost = (usage.output / 1000) * pricing.outputPer1k;

    // Calculate cache savings if applicable
    let cacheSavings = 0;
    if (usage.cached && pricing.cachedInputPer1k !== undefined) {
      const cachedCost = (usage.cached / 1000) * pricing.cachedInputPer1k;
      const fullCost = (usage.cached / 1000) * pricing.inputPer1k;
      cacheSavings = fullCost - cachedCost;
    }

    return {
      inputCost,
      outputCost,
      totalCost: inputCost + outputCost - cacheSavings,
      cacheSavings: cacheSavings > 0 ? cacheSavings : undefined,
      model,
      provider: this.name,
    };
  }

  /**
   * Get pricing for a model
   */
  getPricing(model: string): ModelPricing | undefined {
    return this.pricing.get(model);
  }

  /**
   * Get list of supported models
   */
  getSupportedModels(): string[] {
    return Array.from(this.pricing.keys());
  }

  /**
   * Normalize messages to provider format
   */
  abstract normalizeMessages(messages: ChatMessage[]): ProviderMessage[];

  /**
   * Normalize provider response
   */
  abstract normalizeResponse(response: unknown): NormalizedResponse;
}
