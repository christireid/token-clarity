/**
 * @module adapters/google
 * Google Gemini provider adapter
 */

import type { ChatMessage } from '../types/index.js';
import type {
  ProviderCapabilities,
  ModelPricing,
  GoogleMessage,
  NormalizedResponse,
  CountOptions,
} from './types.js';
import { BaseAdapter } from './base.js';

/**
 * Google Gemini provider adapter
 *
 * Supports Gemini 1.5, 2.0, and 2.5 models.
 * Features both implicit caching (automatic, Gemini 2.5+) and
 * explicit context caching via API.
 */
export class GoogleAdapter extends BaseAdapter {
  readonly name = 'google' as const;

  readonly supports: ProviderCapabilities = {
    caching: true,
    cacheTTL: [60], // 1 hour default
    streaming: true,
    tools: true,
    multiModal: true, // Text, images, audio, video
    extendedThinking: true,
    maxContextTokens: {
      'gemini-1.5-pro': 2000000,
      'gemini-1.5-flash': 1000000,
      'gemini-2.0-flash': 1000000,
      'gemini-2.5-pro': 1000000,
      'gemini-2.5-flash': 1000000,
    },
    minCacheTokens: 2048,
  };

  protected readonly defaultModel = 'gemini-2.5-pro';

  protected readonly pricing = new Map<string, ModelPricing>([
    ['gemini-1.5-pro', {
      model: 'gemini-1.5-pro',
      provider: 'google',
      inputPer1k: 0.00125,
      outputPer1k: 0.005,
      cachedInputPer1k: 0.0003125, // 75% discount
      contextWindow: 2000000,
      maxOutputTokens: 8192,
    }],
    ['gemini-1.5-flash', {
      model: 'gemini-1.5-flash',
      provider: 'google',
      inputPer1k: 0.000075,
      outputPer1k: 0.0003,
      cachedInputPer1k: 0.00001875,
      contextWindow: 1000000,
      maxOutputTokens: 8192,
    }],
    ['gemini-2.0-flash', {
      model: 'gemini-2.0-flash',
      provider: 'google',
      inputPer1k: 0.0001,
      outputPer1k: 0.0004,
      cachedInputPer1k: 0.000025, // 75% discount
      contextWindow: 1000000,
      maxOutputTokens: 8192,
    }],
    ['gemini-2.5-pro', {
      model: 'gemini-2.5-pro',
      provider: 'google',
      inputPer1k: 0.00125,
      outputPer1k: 0.01,
      cachedInputPer1k: 0.000125, // 90% discount for 2.5
      contextWindow: 1000000,
      maxOutputTokens: 8192,
    }],
    ['gemini-2.5-flash', {
      model: 'gemini-2.5-flash',
      provider: 'google',
      inputPer1k: 0.00015,
      outputPer1k: 0.0006,
      cachedInputPer1k: 0.000015, // 90% discount for 2.5
      contextWindow: 1000000,
      maxOutputTokens: 8192,
    }],
  ]);

  /**
   * Count tokens using word-based estimation
   * Gemini uses SentencePiece tokenizer
   */
  override async countTokens(text: string, _options?: CountOptions): Promise<number> {
    // Gemini typically: 1 token ≈ 4 characters or ~0.75 words
    const words = text.split(/\s+/).filter(w => w.length > 0).length;
    const charEstimate = Math.ceil(text.length / 4);
    const wordEstimate = Math.ceil(words / 0.75);

    // Use average of both methods
    return Math.ceil((charEstimate + wordEstimate) / 2);
  }

  /**
   * Count message tokens with Gemini-specific overhead
   */
  override async countMessages(messages: ChatMessage[], options?: CountOptions): Promise<number> {
    const includeOverhead = options?.includeOverhead ?? true;
    let total = 0;

    for (const message of messages) {
      total += await this.countTokens(message.content);
      // Gemini adds ~4 tokens per message for role formatting
      if (includeOverhead) {
        total += 4;
      }
    }

    return total;
  }

  /**
   * Normalize messages to Gemini format
   *
   * Note: Gemini uses 'user' and 'model' roles.
   * System instructions are passed separately.
   */
  normalizeMessages(messages: ChatMessage[]): GoogleMessage[] {
    // Filter out system messages (they're handled separately)
    const nonSystemMessages = messages.filter(m => m.role !== 'system');

    return nonSystemMessages.map(msg => ({
      role: (msg.role === 'assistant' ? 'model' : 'user') as GoogleMessage['role'],
      parts: [{ text: msg.content }],
    }));
  }

  /**
   * Extract system instruction from messages
   */
  extractSystemInstruction(messages: ChatMessage[]): string | undefined {
    const systemMessages = messages.filter(m => m.role === 'system');
    if (systemMessages.length === 0) return undefined;
    return systemMessages.map(m => m.content).join('\n\n');
  }

  /**
   * Normalize Gemini response to standard format
   */
  normalizeResponse(response: unknown): NormalizedResponse {
    const res = response as {
      candidates?: Array<{
        content?: {
          parts?: Array<{
            text?: string;
            functionCall?: { name: string; args: Record<string, unknown> };
          }>;
        };
        finishReason?: string;
      }>;
      usageMetadata?: {
        promptTokenCount?: number;
        candidatesTokenCount?: number;
        totalTokenCount?: number;
        cachedContentTokenCount?: number;
      };
      modelVersion?: string;
    };

    const candidate = res.candidates?.[0];
    const parts = candidate?.content?.parts ?? [];

    // Extract text content
    const textContent = parts
      .filter(p => p.text !== undefined)
      .map(p => p.text ?? '')
      .join('');

    // Extract function calls
    const toolCalls = parts
      .filter(p => p.functionCall !== undefined)
      .map(p => ({
        id: `fc-${Date.now()}`,
        name: p.functionCall?.name ?? '',
        arguments: JSON.stringify(p.functionCall?.args ?? {}),
      }));

    const usage = res.usageMetadata;

    return {
      content: textContent,
      usage: {
        input: usage?.promptTokenCount ?? 0,
        output: usage?.candidatesTokenCount ?? 0,
        cached: usage?.cachedContentTokenCount,
        total: usage?.totalTokenCount ?? 0,
      },
      model: res.modelVersion ?? 'unknown',
      finishReason: this.mapFinishReason(candidate?.finishReason),
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      raw: response,
    };
  }

  /**
   * Map Gemini finish reason to standard format
   */
  private mapFinishReason(reason?: string): NormalizedResponse['finishReason'] {
    switch (reason) {
      case 'STOP':
        return 'stop';
      case 'MAX_TOKENS':
        return 'length';
      case 'SAFETY':
        return 'content_filter';
      case 'RECITATION':
        return 'content_filter';
      case 'OTHER':
      default:
        return 'stop';
    }
  }
}

/**
 * Create a Google adapter instance
 */
export function createGoogleAdapter(): GoogleAdapter {
  return new GoogleAdapter();
}
