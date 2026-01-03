/**
 * @module adapters/mistral
 * Mistral AI provider adapter
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
 * Mistral AI provider adapter
 *
 * Supports Mistral models including Mixtral, Mistral Large, and specialized models.
 * Uses OpenAI-compatible API format.
 * Note: Mistral does not currently support prompt caching.
 */
export class MistralAdapter extends BaseAdapter {
  readonly name = 'openai' as const; // Uses OpenAI-compatible format

  readonly supports: ProviderCapabilities = {
    caching: false, // Mistral doesn't support prompt caching yet
    streaming: true,
    tools: true,
    multiModal: true, // Pixtral models support vision
    extendedThinking: false,
    maxContextTokens: {
      'mistral-large': 128000,
      'mistral-small': 32000,
      'mistral-medium': 32000,
      'mixtral-8x7b': 32000,
      'mixtral-8x22b': 65536,
      'mistral-7b': 32000,
      'pixtral-12b': 128000,
      'pixtral-large': 128000,
      'codestral': 32000,
      'ministral-8b': 128000,
      'ministral-3b': 128000,
    },
  };

  protected readonly defaultModel = 'mistral-large';

  protected readonly pricing = new Map<string, ModelPricing>([
    ['mistral-large', {
      model: 'mistral-large',
      provider: 'mistral',
      inputPer1k: 0.002,
      outputPer1k: 0.006,
      contextWindow: 128000,
      maxOutputTokens: 8192,
    }],
    ['mistral-small', {
      model: 'mistral-small',
      provider: 'mistral',
      inputPer1k: 0.0002,
      outputPer1k: 0.0006,
      contextWindow: 32000,
      maxOutputTokens: 8192,
    }],
    ['mistral-medium', {
      model: 'mistral-medium',
      provider: 'mistral',
      inputPer1k: 0.00275,
      outputPer1k: 0.0081,
      contextWindow: 32000,
      maxOutputTokens: 8192,
    }],
    ['mixtral-8x7b', {
      model: 'mixtral-8x7b',
      provider: 'mistral',
      inputPer1k: 0.0007,
      outputPer1k: 0.0007,
      contextWindow: 32000,
      maxOutputTokens: 8192,
    }],
    ['mixtral-8x22b', {
      model: 'mixtral-8x22b',
      provider: 'mistral',
      inputPer1k: 0.002,
      outputPer1k: 0.006,
      contextWindow: 65536,
      maxOutputTokens: 8192,
    }],
    ['mistral-7b', {
      model: 'mistral-7b',
      provider: 'mistral',
      inputPer1k: 0.00025,
      outputPer1k: 0.00025,
      contextWindow: 32000,
      maxOutputTokens: 8192,
    }],
    ['pixtral-12b', {
      model: 'pixtral-12b',
      provider: 'mistral',
      inputPer1k: 0.00015,
      outputPer1k: 0.00015,
      contextWindow: 128000,
      maxOutputTokens: 8192,
    }],
    ['pixtral-large', {
      model: 'pixtral-large',
      provider: 'mistral',
      inputPer1k: 0.002,
      outputPer1k: 0.006,
      contextWindow: 128000,
      maxOutputTokens: 8192,
    }],
    ['codestral', {
      model: 'codestral',
      provider: 'mistral',
      inputPer1k: 0.0003,
      outputPer1k: 0.0009,
      contextWindow: 32000,
      maxOutputTokens: 8192,
    }],
    ['ministral-8b', {
      model: 'ministral-8b',
      provider: 'mistral',
      inputPer1k: 0.0001,
      outputPer1k: 0.0001,
      contextWindow: 128000,
      maxOutputTokens: 8192,
    }],
    ['ministral-3b', {
      model: 'ministral-3b',
      provider: 'mistral',
      inputPer1k: 0.00004,
      outputPer1k: 0.00004,
      contextWindow: 128000,
      maxOutputTokens: 8192,
    }],
  ]);

  /**
   * Count tokens using BPE estimation
   * Mistral uses a similar tokenizer to other BPE-based models
   */
  override async countTokens(text: string, _options?: CountOptions): Promise<number> {
    // Mistral uses SentencePiece BPE tokenizer
    // Approximately 4 characters per token on average
    return Math.ceil(text.length / 4);
  }

  /**
   * Count message tokens with Mistral-specific overhead
   */
  override async countMessages(messages: ChatMessage[], options?: CountOptions): Promise<number> {
    const includeOverhead = options?.includeOverhead ?? true;
    let total = 0;

    for (const message of messages) {
      total += await this.countTokens(message.content);
      // Mistral adds ~4 tokens per message for role formatting
      if (includeOverhead) {
        total += 4;
      }
    }

    if (includeOverhead && messages.length > 0) {
      total += 3; // Conversation overhead
    }

    return total;
  }

  /**
   * Normalize messages to Mistral/OpenAI format
   */
  normalizeMessages(messages: ChatMessage[]): OpenAIMessage[] {
    return messages.map(msg => ({
      role: msg.role as OpenAIMessage['role'],
      content: msg.content,
      ...(msg.name && { name: msg.name }),
    }));
  }

  /**
   * Normalize Mistral response to standard format
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
        return 'tool_calls';
      case 'model_length':
        return 'length';
      default:
        return 'stop';
    }
  }
}

/**
 * Create a Mistral adapter instance
 */
export function createMistralAdapter(): MistralAdapter {
  return new MistralAdapter();
}
