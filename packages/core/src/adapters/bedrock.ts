/**
 * @module adapters/bedrock
 * AWS Bedrock provider adapter
 */

import type { ChatMessage } from '../types/index.js';
import type {
  ProviderCapabilities,
  ModelPricing,
  BedrockMessage,
  NormalizedResponse,
  CountOptions,
} from './types.js';
import { BaseAdapter } from './base.js';

/**
 * AWS Bedrock provider adapter
 *
 * Supports Claude models via Bedrock and Amazon Nova models.
 * Features prompt caching with 5-minute fixed TTL.
 */
export class BedrockAdapter extends BaseAdapter {
  readonly name = 'anthropic' as const; // Uses Anthropic message format for Claude

  readonly supports: ProviderCapabilities = {
    caching: true,
    cacheTTL: [5], // Fixed 5-minute TTL
    streaming: true,
    tools: true,
    multiModal: true,
    extendedThinking: true,
    maxContextTokens: {
      'anthropic.claude-3-7-sonnet': 200000,
      'anthropic.claude-3-5-haiku': 200000,
      'anthropic.claude-3-opus': 200000,
      'amazon.nova-micro': 128000,
      'amazon.nova-lite': 128000,
      'amazon.nova-pro': 128000,
      'amazon.nova-premier': 1000000,
    },
    minCacheTokens: 1024,
    maxCacheBreakpoints: 4, // Claude: 4, Nova small: 1
  };

  protected readonly defaultModel = 'anthropic.claude-3-7-sonnet';

  protected readonly pricing = new Map<string, ModelPricing>([
    ['anthropic.claude-3-7-sonnet', {
      model: 'anthropic.claude-3-7-sonnet',
      provider: 'bedrock',
      inputPer1k: 0.003,
      outputPer1k: 0.015,
      cachedInputPer1k: 0.0003, // 90% discount on reads
      contextWindow: 200000,
      maxOutputTokens: 8192,
    }],
    ['anthropic.claude-3-5-haiku', {
      model: 'anthropic.claude-3-5-haiku',
      provider: 'bedrock',
      inputPer1k: 0.001,
      outputPer1k: 0.005,
      cachedInputPer1k: 0.0001,
      contextWindow: 200000,
      maxOutputTokens: 8192,
    }],
    ['anthropic.claude-3-opus', {
      model: 'anthropic.claude-3-opus',
      provider: 'bedrock',
      inputPer1k: 0.015,
      outputPer1k: 0.075,
      cachedInputPer1k: 0.0015,
      contextWindow: 200000,
      maxOutputTokens: 4096,
    }],
    ['amazon.nova-micro', {
      model: 'amazon.nova-micro',
      provider: 'bedrock',
      inputPer1k: 0.000035,
      outputPer1k: 0.00014,
      cachedInputPer1k: 0.0000035, // No extra charge for cache writes
      contextWindow: 128000,
      maxOutputTokens: 5000,
    }],
    ['amazon.nova-lite', {
      model: 'amazon.nova-lite',
      provider: 'bedrock',
      inputPer1k: 0.00006,
      outputPer1k: 0.00024,
      cachedInputPer1k: 0.000006,
      contextWindow: 128000,
      maxOutputTokens: 5000,
    }],
    ['amazon.nova-pro', {
      model: 'amazon.nova-pro',
      provider: 'bedrock',
      inputPer1k: 0.0008,
      outputPer1k: 0.0032,
      cachedInputPer1k: 0.00008,
      contextWindow: 128000,
      maxOutputTokens: 5000,
    }],
    ['amazon.nova-premier', {
      model: 'amazon.nova-premier',
      provider: 'bedrock',
      inputPer1k: 0.0025,
      outputPer1k: 0.0125,
      cachedInputPer1k: 0.00025,
      contextWindow: 1000000,
      maxOutputTokens: 5000,
    }],
  ]);

  /**
   * Count tokens using Claude estimation for Claude models
   */
  override async countTokens(text: string, options?: CountOptions): Promise<number> {
    const model = options?.model ?? this.defaultModel;

    if (model.includes('claude')) {
      // Claude: ~3.5 characters per token
      return Math.ceil(text.length / 3.5);
    } else {
      // Nova: similar to GPT (~4 characters per token)
      return Math.ceil(text.length / 4);
    }
  }

  /**
   * Count message tokens with Bedrock overhead
   */
  override async countMessages(messages: ChatMessage[], options?: CountOptions): Promise<number> {
    const includeOverhead = options?.includeOverhead ?? true;
    const model = options?.model ?? this.defaultModel;
    let total = 0;

    for (const message of messages) {
      total += await this.countTokens(message.content, { model });
      if (includeOverhead) {
        total += model.includes('claude') ? 7 : 4;
      }
    }

    return total;
  }

  /**
   * Normalize messages to Bedrock format (Claude via Converse API)
   */
  normalizeMessages(messages: ChatMessage[]): BedrockMessage[] {
    const nonSystemMessages = messages.filter(m => m.role !== 'system');

    return nonSystemMessages.map(msg => ({
      role: (msg.role === 'assistant' ? 'assistant' : 'user') as BedrockMessage['role'],
      content: [{ type: 'text' as const, text: msg.content }],
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
   * Normalize Bedrock response (Converse API format)
   */
  normalizeResponse(response: unknown): NormalizedResponse {
    const res = response as {
      output?: {
        message?: {
          content?: Array<{
            text?: string;
            toolUse?: { toolUseId: string; name: string; input: unknown };
          }>;
        };
      };
      usage?: {
        inputTokens?: number;
        outputTokens?: number;
        totalTokens?: number;
        cacheReadInputTokenCount?: number;
        cacheWriteInputTokenCount?: number;
      };
      stopReason?: string;
      metrics?: {
        latencyMs?: number;
      };
    };

    const content = res.output?.message?.content ?? [];

    // Extract text content
    const textContent = content
      .filter(c => c.text !== undefined)
      .map(c => c.text ?? '')
      .join('');

    // Extract tool uses
    const toolCalls = content
      .filter(c => c.toolUse !== undefined)
      .map(c => ({
        id: c.toolUse?.toolUseId ?? '',
        name: c.toolUse?.name ?? '',
        arguments: JSON.stringify(c.toolUse?.input ?? {}),
      }));

    const usage = res.usage;
    const cachedTokens = (usage?.cacheReadInputTokenCount ?? 0) +
                         (usage?.cacheWriteInputTokenCount ?? 0);

    return {
      content: textContent,
      usage: {
        input: usage?.inputTokens ?? 0,
        output: usage?.outputTokens ?? 0,
        cached: cachedTokens > 0 ? cachedTokens : undefined,
        total: usage?.totalTokens ?? 0,
      },
      model: 'bedrock', // Model info not typically in response
      finishReason: this.mapStopReason(res.stopReason),
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      raw: response,
    };
  }

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
      case 'content_filtered':
        return 'content_filter';
      default:
        return 'stop';
    }
  }
}

/**
 * Create a Bedrock adapter instance
 */
export function createBedrockAdapter(): BedrockAdapter {
  return new BedrockAdapter();
}
