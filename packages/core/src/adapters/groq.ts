/**
 * @module adapters/groq
 * Groq provider adapter
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
 * Groq provider adapter
 *
 * Supports Groq's ultra-fast inference for open models (Llama, Mixtral, Gemma).
 * Uses OpenAI-compatible API format.
 * Note: Groq doesn't support prompt caching (their speed makes it less necessary).
 */
export class GroqAdapter extends BaseAdapter {
  readonly name = 'openai' as const; // Uses OpenAI-compatible format

  readonly supports: ProviderCapabilities = {
    caching: false, // Groq doesn't support prompt caching
    streaming: true,
    tools: true,
    multiModal: true, // Llama 3.2 Vision models
    extendedThinking: false,
    maxContextTokens: {
      'llama-3.3-70b-versatile': 128000,
      'llama-3.1-70b-versatile': 131072,
      'llama-3.1-8b-instant': 131072,
      'llama3-70b-8192': 8192,
      'llama3-8b-8192': 8192,
      'llama-3.2-90b-vision-preview': 8192,
      'llama-3.2-11b-vision-preview': 8192,
      'llama-3.2-3b-preview': 8192,
      'llama-3.2-1b-preview': 8192,
      'mixtral-8x7b-32768': 32768,
      'gemma2-9b-it': 8192,
      'gemma-7b-it': 8192,
    },
  };

  protected readonly defaultModel = 'llama-3.3-70b-versatile';

  // Groq has very competitive pricing due to their custom LPU hardware
  protected readonly pricing = new Map<string, ModelPricing>([
    ['llama-3.3-70b-versatile', {
      model: 'llama-3.3-70b-versatile',
      provider: 'groq',
      inputPer1k: 0.00059,
      outputPer1k: 0.00079,
      contextWindow: 128000,
      maxOutputTokens: 32768,
    }],
    ['llama-3.1-70b-versatile', {
      model: 'llama-3.1-70b-versatile',
      provider: 'groq',
      inputPer1k: 0.00059,
      outputPer1k: 0.00079,
      contextWindow: 131072,
      maxOutputTokens: 8192,
    }],
    ['llama-3.1-8b-instant', {
      model: 'llama-3.1-8b-instant',
      provider: 'groq',
      inputPer1k: 0.00005,
      outputPer1k: 0.00008,
      contextWindow: 131072,
      maxOutputTokens: 8192,
    }],
    ['llama3-70b-8192', {
      model: 'llama3-70b-8192',
      provider: 'groq',
      inputPer1k: 0.00059,
      outputPer1k: 0.00079,
      contextWindow: 8192,
      maxOutputTokens: 8192,
    }],
    ['llama3-8b-8192', {
      model: 'llama3-8b-8192',
      provider: 'groq',
      inputPer1k: 0.00005,
      outputPer1k: 0.00008,
      contextWindow: 8192,
      maxOutputTokens: 8192,
    }],
    ['llama-3.2-90b-vision-preview', {
      model: 'llama-3.2-90b-vision-preview',
      provider: 'groq',
      inputPer1k: 0.0009,
      outputPer1k: 0.0009,
      contextWindow: 8192,
      maxOutputTokens: 8192,
    }],
    ['llama-3.2-11b-vision-preview', {
      model: 'llama-3.2-11b-vision-preview',
      provider: 'groq',
      inputPer1k: 0.00018,
      outputPer1k: 0.00018,
      contextWindow: 8192,
      maxOutputTokens: 8192,
    }],
    ['llama-3.2-3b-preview', {
      model: 'llama-3.2-3b-preview',
      provider: 'groq',
      inputPer1k: 0.00006,
      outputPer1k: 0.00006,
      contextWindow: 8192,
      maxOutputTokens: 8192,
    }],
    ['llama-3.2-1b-preview', {
      model: 'llama-3.2-1b-preview',
      provider: 'groq',
      inputPer1k: 0.00004,
      outputPer1k: 0.00004,
      contextWindow: 8192,
      maxOutputTokens: 8192,
    }],
    ['mixtral-8x7b-32768', {
      model: 'mixtral-8x7b-32768',
      provider: 'groq',
      inputPer1k: 0.00024,
      outputPer1k: 0.00024,
      contextWindow: 32768,
      maxOutputTokens: 32768,
    }],
    ['gemma2-9b-it', {
      model: 'gemma2-9b-it',
      provider: 'groq',
      inputPer1k: 0.0002,
      outputPer1k: 0.0002,
      contextWindow: 8192,
      maxOutputTokens: 8192,
    }],
    ['gemma-7b-it', {
      model: 'gemma-7b-it',
      provider: 'groq',
      inputPer1k: 0.00007,
      outputPer1k: 0.00007,
      contextWindow: 8192,
      maxOutputTokens: 8192,
    }],
  ]);

  /**
   * Count tokens using Llama-style tokenization estimate
   * Groq primarily serves Llama models which use SentencePiece
   */
  override async countTokens(text: string, _options?: CountOptions): Promise<number> {
    // Llama models use SentencePiece, approximately 4 characters per token
    return Math.ceil(text.length / 4);
  }

  /**
   * Count message tokens with OpenAI-compatible overhead
   */
  override async countMessages(messages: ChatMessage[], options?: CountOptions): Promise<number> {
    const includeOverhead = options?.includeOverhead ?? true;
    let total = 0;

    for (const message of messages) {
      total += await this.countTokens(message.content);
      if (includeOverhead) {
        total += 4; // Message formatting overhead
      }
    }

    if (includeOverhead && messages.length > 0) {
      total += 3; // Conversation overhead
    }

    return total;
  }

  /**
   * Normalize messages to Groq/OpenAI format
   */
  normalizeMessages(messages: ChatMessage[]): OpenAIMessage[] {
    return messages.map(msg => ({
      role: msg.role as OpenAIMessage['role'],
      content: msg.content,
      ...(msg.name && { name: msg.name }),
    }));
  }

  /**
   * Normalize Groq response to standard format
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
        queue_time?: number;
        prompt_time?: number;
        completion_time?: number;
        total_time?: number;
      };
      model?: string;
      x_groq?: {
        id?: string;
      };
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
      default:
        return 'stop';
    }
  }
}

/**
 * Create a Groq adapter instance
 */
export function createGroqAdapter(): GroqAdapter {
  return new GroqAdapter();
}
