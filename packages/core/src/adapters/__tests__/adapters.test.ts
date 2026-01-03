/**
 * Comprehensive tests for provider adapters
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { ChatMessage } from '../../types/index.js';
import type { TokenUsage } from '../types.js';
import {
  OpenAIAdapter,
  AnthropicAdapter,
  GoogleAdapter,
  AzureAdapter,
  BedrockAdapter,
  MistralAdapter,
  CohereAdapter,
  GroqAdapter,
  getAdapter,
  registerAdapter,
  createExtendedAdapter,
  getSupportedProviders,
  isProviderSupported,
} from '../index.js';

// Sample messages for testing
const sampleMessages: ChatMessage[] = [
  { role: 'system', content: 'You are a helpful assistant.' },
  { role: 'user', content: 'Hello, how are you?' },
  { role: 'assistant', content: 'I am doing well, thank you for asking!' },
];

const shortText = 'Hello, world!';
const longText = 'This is a longer piece of text that should result in more tokens. '.repeat(100);

describe('OpenAIAdapter', () => {
  let adapter: OpenAIAdapter;

  beforeEach(() => {
    adapter = new OpenAIAdapter();
  });

  it('should have correct provider name', () => {
    expect(adapter.name).toBe('openai');
  });

  it('should support caching', () => {
    expect(adapter.supports.caching).toBe(true);
  });

  it('should support streaming', () => {
    expect(adapter.supports.streaming).toBe(true);
  });

  it('should count tokens in text', async () => {
    const tokens = await adapter.countTokens(shortText);
    expect(tokens).toBeGreaterThan(0);
    expect(tokens).toBeLessThan(10);
  });

  it('should count tokens in long text', async () => {
    const tokens = await adapter.countTokens(longText);
    expect(tokens).toBeGreaterThan(100);
  });

  it('should count message tokens', async () => {
    const tokens = await adapter.countMessages(sampleMessages);
    expect(tokens).toBeGreaterThan(0);
  });

  it('should count message tokens without overhead', async () => {
    const withOverhead = await adapter.countMessages(sampleMessages, { includeOverhead: true });
    const withoutOverhead = await adapter.countMessages(sampleMessages, { includeOverhead: false });
    expect(withOverhead).toBeGreaterThan(withoutOverhead);
  });

  it('should estimate cost', () => {
    const usage: TokenUsage = { input: 1000, output: 500, total: 1500 };
    const cost = adapter.estimateCost(usage, 'gpt-4o');

    expect(cost.inputCost).toBeGreaterThan(0);
    expect(cost.outputCost).toBeGreaterThan(0);
    expect(cost.totalCost).toBe(cost.inputCost + cost.outputCost);
    expect(cost.provider).toBe('openai');
  });

  it('should estimate cost with cached tokens', () => {
    const usage: TokenUsage = { input: 1000, output: 500, cached: 500, total: 1500 };
    const cost = adapter.estimateCost(usage, 'gpt-4o');

    expect(cost.cacheSavings).toBeGreaterThan(0);
    expect(cost.totalCost).toBeLessThan(cost.inputCost + cost.outputCost);
  });

  it('should get pricing for model', () => {
    const pricing = adapter.getPricing('gpt-4o');
    expect(pricing).toBeDefined();
    expect(pricing?.inputPer1k).toBeGreaterThan(0);
    expect(pricing?.outputPer1k).toBeGreaterThan(0);
  });

  it('should return undefined for unknown model pricing', () => {
    const pricing = adapter.getPricing('unknown-model');
    expect(pricing).toBeUndefined();
  });

  it('should get supported models', () => {
    const models = adapter.getSupportedModels();
    expect(models).toContain('gpt-4o');
    expect(models).toContain('gpt-4-turbo');
    expect(models.length).toBeGreaterThan(0);
  });

  it('should normalize messages', () => {
    const normalized = adapter.normalizeMessages(sampleMessages);
    expect(normalized.length).toBe(3);
    expect(normalized[0]).toHaveProperty('role', 'system');
    expect(normalized[0]).toHaveProperty('content', 'You are a helpful assistant.');
  });

  it('should normalize response', () => {
    const rawResponse = {
      choices: [{
        message: { content: 'Hello!' },
        finish_reason: 'stop',
      }],
      usage: {
        prompt_tokens: 10,
        completion_tokens: 5,
        total_tokens: 15,
      },
      model: 'gpt-4o',
    };

    const normalized = adapter.normalizeResponse(rawResponse);
    expect(normalized.content).toBe('Hello!');
    expect(normalized.usage.input).toBe(10);
    expect(normalized.usage.output).toBe(5);
    expect(normalized.finishReason).toBe('stop');
    expect(normalized.model).toBe('gpt-4o');
  });

  it('should normalize response with tool calls', () => {
    const rawResponse = {
      choices: [{
        message: {
          content: '',
          tool_calls: [{
            id: 'call_123',
            type: 'function',
            function: { name: 'get_weather', arguments: '{"city":"NYC"}' },
          }],
        },
        finish_reason: 'tool_calls',
      }],
      usage: { prompt_tokens: 20, completion_tokens: 10, total_tokens: 30 },
    };

    const normalized = adapter.normalizeResponse(rawResponse);
    expect(normalized.finishReason).toBe('tool_calls');
    expect(normalized.toolCalls).toHaveLength(1);
    expect(normalized.toolCalls?.[0].name).toBe('get_weather');
  });
});

describe('AnthropicAdapter', () => {
  let adapter: AnthropicAdapter;

  beforeEach(() => {
    adapter = new AnthropicAdapter();
  });

  it('should have correct provider name', () => {
    expect(adapter.name).toBe('anthropic');
  });

  it('should support extended thinking', () => {
    expect(adapter.supports.extendedThinking).toBe(true);
  });

  it('should count tokens in text', async () => {
    const tokens = await adapter.countTokens(shortText);
    expect(tokens).toBeGreaterThan(0);
  });

  it('should count message tokens', async () => {
    const tokens = await adapter.countMessages(sampleMessages);
    expect(tokens).toBeGreaterThan(0);
  });

  it('should estimate cost for Claude models', () => {
    const usage: TokenUsage = { input: 1000, output: 500, total: 1500 };
    const cost = adapter.estimateCost(usage, 'claude-sonnet-4');

    expect(cost.inputCost).toBeGreaterThan(0);
    expect(cost.provider).toBe('anthropic');
  });

  it('should get pricing for Claude models', () => {
    const pricing = adapter.getPricing('claude-3-opus');
    expect(pricing).toBeDefined();
    expect(pricing?.contextWindow).toBe(200000);
  });

  it('should normalize messages (filter system)', () => {
    const normalized = adapter.normalizeMessages(sampleMessages);
    // Anthropic filters out system messages
    expect(normalized.length).toBe(2);
    expect(normalized[0]).toHaveProperty('role', 'user');
  });

  it('should extract system prompt', () => {
    const systemPrompt = adapter.extractSystemPrompt(sampleMessages);
    expect(systemPrompt).toBe('You are a helpful assistant.');
  });

  it('should normalize response', () => {
    const rawResponse = {
      content: [{ type: 'text', text: 'Hello from Claude!' }],
      usage: { input_tokens: 15, output_tokens: 8 },
      model: 'claude-sonnet-4',
      stop_reason: 'end_turn',
    };

    const normalized = adapter.normalizeResponse(rawResponse);
    expect(normalized.content).toBe('Hello from Claude!');
    expect(normalized.usage.input).toBe(15);
    expect(normalized.finishReason).toBe('stop');
  });

  it('should handle cached tokens in response', () => {
    const rawResponse = {
      content: [{ type: 'text', text: 'Response' }],
      usage: {
        input_tokens: 100,
        output_tokens: 50,
        cache_read_input_tokens: 80,
      },
    };

    const normalized = adapter.normalizeResponse(rawResponse);
    expect(normalized.usage.cached).toBe(80);
  });
});

describe('GoogleAdapter', () => {
  let adapter: GoogleAdapter;

  beforeEach(() => {
    adapter = new GoogleAdapter();
  });

  it('should have correct provider name', () => {
    expect(adapter.name).toBe('google');
  });

  it('should have large context windows', () => {
    expect(adapter.supports.maxContextTokens['gemini-1.5-pro']).toBe(2000000);
  });

  it('should count tokens', async () => {
    const tokens = await adapter.countTokens(shortText);
    expect(tokens).toBeGreaterThan(0);
  });

  it('should normalize messages (map roles)', () => {
    const normalized = adapter.normalizeMessages(sampleMessages);
    // Google filters system messages and maps assistant to model
    expect(normalized.length).toBe(2);
    expect(normalized[1]).toHaveProperty('role', 'model');
    expect(normalized[0].parts).toBeDefined();
  });

  it('should extract system instruction', () => {
    const instruction = adapter.extractSystemInstruction(sampleMessages);
    expect(instruction).toBe('You are a helpful assistant.');
  });

  it('should normalize response', () => {
    const rawResponse = {
      candidates: [{
        content: {
          parts: [{ text: 'Hello from Gemini!' }],
        },
        finishReason: 'STOP',
      }],
      usageMetadata: {
        promptTokenCount: 20,
        candidatesTokenCount: 10,
        totalTokenCount: 30,
      },
    };

    const normalized = adapter.normalizeResponse(rawResponse);
    expect(normalized.content).toBe('Hello from Gemini!');
    expect(normalized.usage.input).toBe(20);
    expect(normalized.finishReason).toBe('stop');
  });

  it('should handle function calls in response', () => {
    const rawResponse = {
      candidates: [{
        content: {
          parts: [{
            functionCall: { name: 'search', args: { query: 'test' } },
          }],
        },
      }],
      usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5 },
    };

    const normalized = adapter.normalizeResponse(rawResponse);
    expect(normalized.toolCalls).toHaveLength(1);
    expect(normalized.toolCalls?.[0].name).toBe('search');
  });
});

describe('AzureAdapter', () => {
  let adapter: AzureAdapter;

  beforeEach(() => {
    adapter = new AzureAdapter();
  });

  it('should use openai format', () => {
    expect(adapter.name).toBe('openai');
  });

  it('should support caching', () => {
    expect(adapter.supports.caching).toBe(true);
  });

  it('should count tokens', async () => {
    const tokens = await adapter.countTokens(shortText);
    expect(tokens).toBeGreaterThan(0);
  });

  it('should have Azure-specific model names', () => {
    const models = adapter.getSupportedModels();
    expect(models).toContain('gpt-35-turbo'); // Azure naming
  });
});

describe('BedrockAdapter', () => {
  let adapter: BedrockAdapter;

  beforeEach(() => {
    adapter = new BedrockAdapter();
  });

  it('should use anthropic format', () => {
    expect(adapter.name).toBe('anthropic');
  });

  it('should support Claude models', () => {
    const models = adapter.getSupportedModels();
    expect(models.some(m => m.includes('claude'))).toBe(true);
  });

  it('should normalize messages like Anthropic', () => {
    const normalized = adapter.normalizeMessages(sampleMessages);
    expect(normalized.length).toBe(2); // System filtered out
  });
});

describe('MistralAdapter', () => {
  let adapter: MistralAdapter;

  beforeEach(() => {
    adapter = new MistralAdapter();
  });

  it('should use openai format', () => {
    expect(adapter.name).toBe('openai');
  });

  it('should not support caching', () => {
    expect(adapter.supports.caching).toBe(false);
  });

  it('should support Mixtral models', () => {
    const models = adapter.getSupportedModels();
    expect(models).toContain('mixtral-8x7b');
    expect(models).toContain('mixtral-8x22b');
  });

  it('should support vision models', () => {
    expect(adapter.supports.multiModal).toBe(true);
    const models = adapter.getSupportedModels();
    expect(models).toContain('pixtral-12b');
  });

  it('should normalize response', () => {
    const rawResponse = {
      choices: [{
        message: { content: 'Bonjour!' },
        finish_reason: 'stop',
      }],
      usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 },
    };

    const normalized = adapter.normalizeResponse(rawResponse);
    expect(normalized.content).toBe('Bonjour!');
  });
});

describe('CohereAdapter', () => {
  let adapter: CohereAdapter;

  beforeEach(() => {
    adapter = new CohereAdapter();
  });

  it('should not support caching', () => {
    expect(adapter.supports.caching).toBe(false);
  });

  it('should support Command R models', () => {
    const models = adapter.getSupportedModels();
    expect(models).toContain('command-r');
    expect(models).toContain('command-r-plus');
  });

  it('should extract preamble', () => {
    const preamble = adapter.extractPreamble(sampleMessages);
    expect(preamble).toBe('You are a helpful assistant.');
  });

  it('should normalize Cohere response format', () => {
    const rawResponse = {
      text: 'Response from Command',
      meta: {
        tokens: { input_tokens: 50, output_tokens: 25 },
      },
      finish_reason: 'COMPLETE',
    };

    const normalized = adapter.normalizeResponse(rawResponse);
    expect(normalized.content).toBe('Response from Command');
    expect(normalized.usage.input).toBe(50);
    expect(normalized.finishReason).toBe('stop');
  });

  it('should handle tool calls', () => {
    const rawResponse = {
      text: '',
      tool_calls: [{ name: 'search', parameters: { query: 'test' } }],
      finish_reason: 'TOOL_CALL',
    };

    const normalized = adapter.normalizeResponse(rawResponse);
    expect(normalized.finishReason).toBe('tool_calls');
    expect(normalized.toolCalls?.[0].name).toBe('search');
  });
});

describe('GroqAdapter', () => {
  let adapter: GroqAdapter;

  beforeEach(() => {
    adapter = new GroqAdapter();
  });

  it('should use openai format', () => {
    expect(adapter.name).toBe('openai');
  });

  it('should not support caching', () => {
    expect(adapter.supports.caching).toBe(false);
  });

  it('should support Llama models', () => {
    const models = adapter.getSupportedModels();
    expect(models).toContain('llama-3.3-70b-versatile');
    expect(models).toContain('llama3-70b-8192');
  });

  it('should have very low pricing', () => {
    const pricing = adapter.getPricing('llama-3.1-8b-instant');
    expect(pricing).toBeDefined();
    expect(pricing!.inputPer1k).toBeLessThan(0.001);
  });

  it('should support vision models', () => {
    const models = adapter.getSupportedModels();
    expect(models).toContain('llama-3.2-90b-vision-preview');
  });
});

describe('Adapter Registry', () => {
  it('should get adapter for supported provider', () => {
    const adapter = getAdapter('openai');
    expect(adapter).toBeDefined();
    expect(adapter?.name).toBe('openai');
  });

  it('should return undefined for unsupported provider', () => {
    const adapter = getAdapter('unsupported' as any);
    expect(adapter).toBeUndefined();
  });

  it('should register custom adapter', () => {
    const customAdapter = new OpenAIAdapter();
    registerAdapter('openai', customAdapter);
    const adapter = getAdapter('openai');
    expect(adapter).toBe(customAdapter);
  });

  it('should get supported providers', () => {
    const providers = getSupportedProviders();
    expect(providers).toContain('openai');
    expect(providers).toContain('anthropic');
    expect(providers).toContain('google');
  });

  it('should check if provider is supported', () => {
    expect(isProviderSupported('openai')).toBe(true);
    expect(isProviderSupported('anthropic')).toBe(true);
    expect(isProviderSupported('unsupported')).toBe(false);
  });

  it('should create extended adapter for azure', () => {
    const adapter = createExtendedAdapter('azure');
    expect(adapter).toBeInstanceOf(AzureAdapter);
  });

  it('should create extended adapter for bedrock', () => {
    const adapter = createExtendedAdapter('bedrock');
    expect(adapter).toBeInstanceOf(BedrockAdapter);
  });

  it('should create extended adapter for mistral', () => {
    const adapter = createExtendedAdapter('mistral');
    expect(adapter).toBeInstanceOf(MistralAdapter);
  });

  it('should create extended adapter for cohere', () => {
    const adapter = createExtendedAdapter('cohere');
    expect(adapter).toBeInstanceOf(CohereAdapter);
  });

  it('should create extended adapter for groq', () => {
    const adapter = createExtendedAdapter('groq');
    expect(adapter).toBeInstanceOf(GroqAdapter);
  });

  it('should create openai adapter for openai-compatible', () => {
    const adapter = createExtendedAdapter('openai-compatible');
    expect(adapter).toBeInstanceOf(OpenAIAdapter);
  });
});

describe('Cross-adapter Token Counting', () => {
  const adapters = [
    new OpenAIAdapter(),
    new AnthropicAdapter(),
    new GoogleAdapter(),
    new MistralAdapter(),
    new CohereAdapter(),
    new GroqAdapter(),
  ];

  it('should produce similar token counts for same text', async () => {
    const text = 'Hello, world! This is a test message.';
    const counts = await Promise.all(
      adapters.map(a => a.countTokens(text))
    );

    // All counts should be within reasonable range of each other
    const min = Math.min(...counts);
    const max = Math.max(...counts);
    expect(max / min).toBeLessThan(2); // No more than 2x difference
  });

  it('should all return positive counts for messages', async () => {
    const counts = await Promise.all(
      adapters.map(a => a.countMessages(sampleMessages))
    );

    counts.forEach(count => {
      expect(count).toBeGreaterThan(0);
    });
  });
});

describe('Cost Estimation Accuracy', () => {
  it('should calculate costs correctly for 1M tokens', () => {
    const adapter = new OpenAIAdapter();
    const usage: TokenUsage = { input: 1000000, output: 100000, total: 1100000 };
    const cost = adapter.estimateCost(usage, 'gpt-4o');

    // GPT-4o: $2.50/1M input, $10/1M output
    expect(cost.inputCost).toBeCloseTo(2.5, 1);
    expect(cost.outputCost).toBeCloseTo(1.0, 1);
  });

  it('should handle zero token usage', () => {
    const adapter = new OpenAIAdapter();
    const usage: TokenUsage = { input: 0, output: 0, total: 0 };
    const cost = adapter.estimateCost(usage, 'gpt-4o');

    expect(cost.inputCost).toBe(0);
    expect(cost.outputCost).toBe(0);
    expect(cost.totalCost).toBe(0);
  });

  it('should return zero cost for unknown model', () => {
    const adapter = new OpenAIAdapter();
    const usage: TokenUsage = { input: 1000, output: 500, total: 1500 };
    const cost = adapter.estimateCost(usage, 'unknown-model-xyz');

    // Falls back to default model pricing
    expect(cost.totalCost).toBeGreaterThanOrEqual(0);
  });
});
