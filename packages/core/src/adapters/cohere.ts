/**
 * @module adapters/cohere
 * Cohere provider adapter
 */

import type { ChatMessage } from '../types/index.js';
import type {
  ProviderCapabilities,
  ModelPricing,
  GenericMessage,
  NormalizedResponse,
  CountOptions,
} from './types.js';
import { BaseAdapter } from './base.js';

/**
 * Cohere provider adapter
 *
 * Supports Cohere Command models (R, R+, Light).
 * Features Retrieval Augmented Generation (RAG) capabilities.
 * Note: Cohere doesn't support prompt caching in the traditional sense,
 * but does support document caching for RAG.
 */
export class CohereAdapter extends BaseAdapter {
  readonly name = 'openai' as const; // Generic provider

  readonly supports: ProviderCapabilities = {
    caching: false, // No prompt caching
    streaming: true,
    tools: true, // Cohere supports tool use
    multiModal: false, // Text only for most models
    extendedThinking: false,
    maxContextTokens: {
      'command-r': 128000,
      'command-r-plus': 128000,
      'command-r-08-2024': 128000,
      'command-r-plus-08-2024': 128000,
      'command-light': 4096,
      'command': 4096,
      'command-nightly': 128000,
    },
  };

  protected readonly defaultModel = 'command-r-plus';

  protected readonly pricing = new Map<string, ModelPricing>([
    ['command-r-plus', {
      model: 'command-r-plus',
      provider: 'cohere',
      inputPer1k: 0.0025,
      outputPer1k: 0.01,
      contextWindow: 128000,
      maxOutputTokens: 4096,
    }],
    ['command-r-plus-08-2024', {
      model: 'command-r-plus-08-2024',
      provider: 'cohere',
      inputPer1k: 0.0025,
      outputPer1k: 0.01,
      contextWindow: 128000,
      maxOutputTokens: 4096,
    }],
    ['command-r', {
      model: 'command-r',
      provider: 'cohere',
      inputPer1k: 0.00015,
      outputPer1k: 0.0006,
      contextWindow: 128000,
      maxOutputTokens: 4096,
    }],
    ['command-r-08-2024', {
      model: 'command-r-08-2024',
      provider: 'cohere',
      inputPer1k: 0.00015,
      outputPer1k: 0.0006,
      contextWindow: 128000,
      maxOutputTokens: 4096,
    }],
    ['command-light', {
      model: 'command-light',
      provider: 'cohere',
      inputPer1k: 0.0003,
      outputPer1k: 0.0006,
      contextWindow: 4096,
      maxOutputTokens: 4096,
    }],
    ['command', {
      model: 'command',
      provider: 'cohere',
      inputPer1k: 0.001,
      outputPer1k: 0.002,
      contextWindow: 4096,
      maxOutputTokens: 4096,
    }],
    ['command-nightly', {
      model: 'command-nightly',
      provider: 'cohere',
      inputPer1k: 0.001,
      outputPer1k: 0.002,
      contextWindow: 128000,
      maxOutputTokens: 4096,
    }],
  ]);

  /**
   * Count tokens using Cohere-style estimation
   * Cohere uses BPE tokenization, approximately 4 characters per token
   */
  override async countTokens(text: string, _options?: CountOptions): Promise<number> {
    // Cohere tokenizer is similar to other BPE tokenizers
    return Math.ceil(text.length / 4);
  }

  /**
   * Count message tokens with Cohere-specific overhead
   */
  override async countMessages(messages: ChatMessage[], options?: CountOptions): Promise<number> {
    const includeOverhead = options?.includeOverhead ?? true;
    let total = 0;

    for (const message of messages) {
      total += await this.countTokens(message.content);
      // Cohere adds overhead for role formatting
      if (includeOverhead) {
        total += 5;
      }
    }

    // Cohere has a preamble overhead
    if (includeOverhead && messages.length > 0) {
      total += 10;
    }

    return total;
  }

  /**
   * Normalize messages to Cohere format
   *
   * Note: Cohere uses a different message format with 'CHATBOT' and 'USER' roles,
   * but we normalize to a generic format here.
   */
  normalizeMessages(messages: ChatMessage[]): GenericMessage[] {
    return messages.map(msg => ({
      role: this.mapRole(msg.role),
      content: msg.content,
      ...(msg.name && { name: msg.name }),
    }));
  }

  private mapRole(role: ChatMessage['role']): GenericMessage['role'] {
    switch (role) {
      case 'system':
        return 'system';
      case 'user':
        return 'user';
      case 'assistant':
        return 'assistant';
      case 'tool':
        return 'tool';
      default:
        return 'user';
    }
  }

  /**
   * Extract preamble (system prompt) from messages
   */
  extractPreamble(messages: ChatMessage[]): string | undefined {
    const systemMessages = messages.filter(m => m.role === 'system');
    if (systemMessages.length === 0) return undefined;
    return systemMessages.map(m => m.content).join('\n\n');
  }

  /**
   * Normalize Cohere response to standard format
   */
  normalizeResponse(response: unknown): NormalizedResponse {
    const res = response as {
      text?: string;
      generation_id?: string;
      meta?: {
        tokens?: {
          input_tokens?: number;
          output_tokens?: number;
        };
        billed_units?: {
          input_tokens?: number;
          output_tokens?: number;
        };
      };
      tool_calls?: Array<{
        name: string;
        parameters: Record<string, unknown>;
      }>;
      finish_reason?: string;
    };

    const tokens = res.meta?.tokens ?? res.meta?.billed_units;
    const inputTokens = tokens?.input_tokens ?? 0;
    const outputTokens = tokens?.output_tokens ?? 0;

    return {
      content: res.text ?? '',
      usage: {
        input: inputTokens,
        output: outputTokens,
        total: inputTokens + outputTokens,
      },
      model: 'command',
      finishReason: this.mapFinishReason(res.finish_reason),
      toolCalls: res.tool_calls?.map((tc, i) => ({
        id: `tc-${i}`,
        name: tc.name,
        arguments: JSON.stringify(tc.parameters),
      })),
      raw: response,
    };
  }

  private mapFinishReason(reason?: string): NormalizedResponse['finishReason'] {
    switch (reason) {
      case 'COMPLETE':
        return 'stop';
      case 'MAX_TOKENS':
        return 'length';
      case 'TOOL_CALL':
        return 'tool_calls';
      case 'ERROR':
        return 'error';
      default:
        return 'stop';
    }
  }
}

/**
 * Create a Cohere adapter instance
 */
export function createCohereAdapter(): CohereAdapter {
  return new CohereAdapter();
}
