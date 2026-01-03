/**
 * @module adapters/anthropic
 * Anthropic Claude provider adapter
 */

import type { ChatMessage } from '../types/index.js';
import type {
  ProviderCapabilities,
  ModelPricing,
  AnthropicMessage,
  NormalizedResponse,
  CountOptions,
} from './types.js';
import { BaseAdapter } from './base.js';

/**
 * Anthropic Claude provider adapter
 *
 * Supports Claude 3.x and Claude 4.x models.
 * Features explicit cache_control for prompt caching with
 * configurable TTL (5 minutes or 1 hour).
 */
export class AnthropicAdapter extends BaseAdapter {
  readonly name = 'anthropic' as const;

  readonly supports: ProviderCapabilities = {
    caching: true,
    cacheTTL: [5, 60], // 5 minutes or 1 hour
    streaming: true,
    tools: true,
    multiModal: true,
    extendedThinking: true, // Claude supports extended thinking
    maxContextTokens: {
      'claude-3-opus': 200000,
      'claude-3-sonnet': 200000,
      'claude-3-haiku': 200000,
      'claude-3-5-sonnet': 200000,
      'claude-3-5-haiku': 200000,
      'claude-sonnet-4': 200000,
      'claude-opus-4': 200000,
      'claude-sonnet-4-5': 500000, // Enterprise can use 1M
    },
    minCacheTokens: 1024,
    maxCacheBreakpoints: 4,
  };

  protected readonly defaultModel = 'claude-sonnet-4';

  protected readonly pricing = new Map<string, ModelPricing>([
    ['claude-3-opus', {
      model: 'claude-3-opus',
      provider: 'anthropic',
      inputPer1k: 0.015,
      outputPer1k: 0.075,
      cachedInputPer1k: 0.0015, // 90% discount on reads
      contextWindow: 200000,
      maxOutputTokens: 4096,
    }],
    ['claude-3-sonnet', {
      model: 'claude-3-sonnet',
      provider: 'anthropic',
      inputPer1k: 0.003,
      outputPer1k: 0.015,
      cachedInputPer1k: 0.0003,
      contextWindow: 200000,
      maxOutputTokens: 4096,
    }],
    ['claude-3-haiku', {
      model: 'claude-3-haiku',
      provider: 'anthropic',
      inputPer1k: 0.00025,
      outputPer1k: 0.00125,
      cachedInputPer1k: 0.000025,
      contextWindow: 200000,
      maxOutputTokens: 4096,
    }],
    ['claude-3-5-sonnet', {
      model: 'claude-3-5-sonnet',
      provider: 'anthropic',
      inputPer1k: 0.003,
      outputPer1k: 0.015,
      cachedInputPer1k: 0.0003,
      contextWindow: 200000,
      maxOutputTokens: 8192,
    }],
    ['claude-3-5-haiku', {
      model: 'claude-3-5-haiku',
      provider: 'anthropic',
      inputPer1k: 0.0008,
      outputPer1k: 0.004,
      cachedInputPer1k: 0.00008,
      contextWindow: 200000,
      maxOutputTokens: 8192,
    }],
    ['claude-sonnet-4', {
      model: 'claude-sonnet-4',
      provider: 'anthropic',
      inputPer1k: 0.003,
      outputPer1k: 0.015,
      cachedInputPer1k: 0.0003,
      contextWindow: 200000,
      maxOutputTokens: 16384,
    }],
    ['claude-opus-4', {
      model: 'claude-opus-4',
      provider: 'anthropic',
      inputPer1k: 0.015,
      outputPer1k: 0.075,
      cachedInputPer1k: 0.0015,
      contextWindow: 200000,
      maxOutputTokens: 16384,
    }],
    ['claude-sonnet-4-5', {
      model: 'claude-sonnet-4-5',
      provider: 'anthropic',
      inputPer1k: 0.003,
      outputPer1k: 0.015,
      cachedInputPer1k: 0.0003,
      contextWindow: 500000,
      maxOutputTokens: 16384,
    }],
  ]);

  /**
   * Count tokens using Claude-specific estimation
   * Anthropic's tokenizer is approximately 3.5 characters per token
   */
  override async countTokens(text: string, _options?: CountOptions): Promise<number> {
    // Claude uses a BPE tokenizer similar to but not identical to GPT
    // Approximate: ~3.5 characters per token on average
    const estimate = Math.ceil(text.length / 3.5);
    return estimate;
  }

  /**
   * Count message tokens with Anthropic-specific overhead
   */
  override async countMessages(messages: ChatMessage[], options?: CountOptions): Promise<number> {
    const includeOverhead = options?.includeOverhead ?? true;
    let total = 0;

    for (const message of messages) {
      total += await this.countTokens(message.content);
      // Anthropic adds ~7 tokens per message for role formatting
      if (includeOverhead) {
        total += 7;
      }
    }

    return total;
  }

  /**
   * Normalize messages to Anthropic format
   *
   * Note: System messages should be passed separately in the API call,
   * not as part of the messages array. This method filters them out.
   */
  normalizeMessages(messages: ChatMessage[]): AnthropicMessage[] {
    // Filter out system messages (they're handled separately in Anthropic API)
    const nonSystemMessages = messages.filter(m => m.role !== 'system');

    return nonSystemMessages.map(msg => ({
      role: (msg.role === 'assistant' ? 'assistant' : 'user') as AnthropicMessage['role'],
      content: msg.content,
    }));
  }

  /**
   * Extract system prompt from messages
   */
  extractSystemPrompt(messages: ChatMessage[]): string | undefined {
    const systemMessages = messages.filter(m => m.role === 'system');
    if (systemMessages.length === 0) return undefined;
    return systemMessages.map(m => m.content).join('\n\n');
  }

  /**
   * Normalize Anthropic response to standard format
   */
  normalizeResponse(response: unknown): NormalizedResponse {
    const res = response as {
      content?: Array<{
        type: string;
        text?: string;
        id?: string;
        name?: string;
        input?: unknown;
      }>;
      usage?: {
        input_tokens?: number;
        output_tokens?: number;
        cache_read_input_tokens?: number;
        cache_creation_input_tokens?: number;
      };
      model?: string;
      stop_reason?: string;
    };

    // Extract text content
    const textContent = res.content
      ?.filter(c => c.type === 'text')
      .map(c => c.text ?? '')
      .join('') ?? '';

    // Extract tool uses
    const toolCalls = res.content
      ?.filter(c => c.type === 'tool_use')
      .map(c => ({
        id: c.id ?? '',
        name: c.name ?? '',
        arguments: JSON.stringify(c.input ?? {}),
      }));

    const usage = res.usage;
    const cachedTokens = (usage?.cache_read_input_tokens ?? 0) +
                         (usage?.cache_creation_input_tokens ?? 0);

    return {
      content: textContent,
      usage: {
        input: usage?.input_tokens ?? 0,
        output: usage?.output_tokens ?? 0,
        cached: cachedTokens > 0 ? cachedTokens : undefined,
        total: (usage?.input_tokens ?? 0) + (usage?.output_tokens ?? 0),
      },
      model: res.model ?? 'unknown',
      finishReason: this.mapStopReason(res.stop_reason),
      toolCalls: toolCalls && toolCalls.length > 0 ? toolCalls : undefined,
      raw: response,
    };
  }

  /**
   * Map Anthropic stop_reason to standard format
   */
  private mapStopReason(reason?: string): NormalizedResponse['finishReason'] {
    switch (reason) {
      case 'end_turn':
        return 'stop';
      case 'max_tokens':
        return 'length';
      case 'tool_use':
        return 'tool_calls';
      case 'stop_sequence':
        return 'stop';
      default:
        return 'stop';
    }
  }
}

/**
 * Create an Anthropic adapter instance
 */
export function createAnthropicAdapter(): AnthropicAdapter {
  return new AnthropicAdapter();
}
