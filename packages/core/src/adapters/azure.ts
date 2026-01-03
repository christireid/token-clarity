/**
 * @module adapters/azure
 * Azure OpenAI provider adapter
 */

import type { ChatMessage } from '../types/index.js';
import type {
  ProviderCapabilities,
  ModelPricing,
  OpenAIMessage,
  NormalizedResponse,
  CountOptions,
} from './types.js';
import { BaseAdapter } from './base.js';

/**
 * Azure OpenAI provider adapter
 *
 * Supports Azure-hosted OpenAI models (GPT-4o, GPT-4, GPT-3.5).
 * Features automatic prompt caching (GPT-4o and newer).
 * API version 2024-10-01-preview or later required for caching.
 */
export class AzureAdapter extends BaseAdapter {
  readonly name = 'openai' as const; // Uses OpenAI format

  readonly supports: ProviderCapabilities = {
    caching: true,
    cacheTTL: [5, 10], // 5-10 minutes
    streaming: true,
    tools: true,
    multiModal: true,
    extendedThinking: false, // Azure may have delayed feature rollout
    maxContextTokens: {
      'gpt-4o': 128000,
      'gpt-4o-mini': 128000,
      'gpt-4-turbo': 128000,
      'gpt-4': 8192,
      'gpt-35-turbo': 16385, // Azure naming convention
    },
    minCacheTokens: 1024,
  };

  protected readonly defaultModel = 'gpt-4o';

  // Azure pricing varies by region, these are estimates
  protected readonly pricing = new Map<string, ModelPricing>([
    ['gpt-4o', {
      model: 'gpt-4o',
      provider: 'azure',
      inputPer1k: 0.005, // Azure typically ~2x direct OpenAI
      outputPer1k: 0.015,
      cachedInputPer1k: 0.0025, // 50% discount
      contextWindow: 128000,
      maxOutputTokens: 16384,
    }],
    ['gpt-4o-mini', {
      model: 'gpt-4o-mini',
      provider: 'azure',
      inputPer1k: 0.00015,
      outputPer1k: 0.0006,
      cachedInputPer1k: 0.000075,
      contextWindow: 128000,
      maxOutputTokens: 16384,
    }],
    ['gpt-4-turbo', {
      model: 'gpt-4-turbo',
      provider: 'azure',
      inputPer1k: 0.01,
      outputPer1k: 0.03,
      cachedInputPer1k: 0.005,
      contextWindow: 128000,
      maxOutputTokens: 4096,
    }],
    ['gpt-4', {
      model: 'gpt-4',
      provider: 'azure',
      inputPer1k: 0.03,
      outputPer1k: 0.06,
      contextWindow: 8192,
      maxOutputTokens: 8192,
    }],
    ['gpt-35-turbo', {
      model: 'gpt-35-turbo',
      provider: 'azure',
      inputPer1k: 0.0015,
      outputPer1k: 0.002,
      cachedInputPer1k: 0.00075,
      contextWindow: 16385,
      maxOutputTokens: 4096,
    }],
  ]);

  /**
   * Count tokens using gpt-tokenizer
   */
  override async countTokens(text: string, options?: CountOptions): Promise<number> {
    try {
      const { encode } = await import('gpt-tokenizer');
      return encode(text).length;
    } catch {
      return super.countTokens(text, options);
    }
  }

  /**
   * Count message tokens with OpenAI overhead
   */
  override async countMessages(messages: ChatMessage[], options?: CountOptions): Promise<number> {
    const includeOverhead = options?.includeOverhead ?? true;
    let total = 0;

    try {
      const { encode } = await import('gpt-tokenizer');

      for (const message of messages) {
        total += encode(message.content).length;
        if (includeOverhead) {
          total += 4;
        }
      }

      if (includeOverhead && messages.length > 0) {
        total += 3;
      }
    } catch {
      return super.countMessages(messages, options);
    }

    return total;
  }

  /**
   * Normalize messages to Azure/OpenAI format
   */
  normalizeMessages(messages: ChatMessage[]): OpenAIMessage[] {
    return messages.map(msg => ({
      role: msg.role as OpenAIMessage['role'],
      content: msg.content,
      ...(msg.name && { name: msg.name }),
    }));
  }

  /**
   * Normalize Azure OpenAI response
   */
  normalizeResponse(response: unknown): NormalizedResponse {
    const res = response as {
      choices?: Array<{
        message?: {
          content?: string;
          tool_calls?: Array<{
            id: string;
            function: { name: string; arguments: string };
          }>;
        };
        finish_reason?: string;
      }>;
      usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
        total_tokens?: number;
        prompt_tokens_details?: { cached_tokens?: number };
      };
      model?: string;
    };

    const choice = res.choices?.[0];
    const usage = res.usage;

    return {
      content: choice?.message?.content ?? '',
      usage: {
        input: usage?.prompt_tokens ?? 0,
        output: usage?.completion_tokens ?? 0,
        cached: usage?.prompt_tokens_details?.cached_tokens,
        total: usage?.total_tokens ?? 0,
      },
      model: res.model ?? 'unknown',
      finishReason: this.mapFinishReason(choice?.finish_reason),
      toolCalls: choice?.message?.tool_calls?.map(tc => ({
        id: tc.id,
        name: tc.function.name,
        arguments: tc.function.arguments,
      })),
      raw: response,
    };
  }

  private mapFinishReason(reason?: string): NormalizedResponse['finishReason'] {
    switch (reason) {
      case 'stop':
        return 'stop';
      case 'length':
        return 'length';
      case 'tool_calls':
      case 'function_call':
        return 'tool_calls';
      case 'content_filter':
        return 'content_filter';
      default:
        return 'stop';
    }
  }
}

/**
 * Create an Azure adapter instance
 */
export function createAzureAdapter(): AzureAdapter {
  return new AzureAdapter();
}
