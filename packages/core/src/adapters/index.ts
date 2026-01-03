/**
 * @module adapters
 * Provider adapters for unified token counting, cost estimation, and message normalization
 */

export * from './types.js';
export * from './base.js';
export { OpenAIAdapter, createOpenAIAdapter } from './openai.js';
export { AnthropicAdapter, createAnthropicAdapter } from './anthropic.js';
export { GoogleAdapter, createGoogleAdapter } from './google.js';
export { AzureAdapter, createAzureAdapter } from './azure.js';
export { BedrockAdapter, createBedrockAdapter } from './bedrock.js';
export { MistralAdapter, createMistralAdapter } from './mistral.js';
export { CohereAdapter, createCohereAdapter } from './cohere.js';
export { GroqAdapter, createGroqAdapter } from './groq.js';

import type { Provider } from '../types/index.js';
import type { ProviderAdapter, AdapterRegistry, ExtendedProvider } from './types.js';
import { OpenAIAdapter } from './openai.js';
import { AnthropicAdapter } from './anthropic.js';
import { GoogleAdapter } from './google.js';
import { AzureAdapter } from './azure.js';
import { BedrockAdapter } from './bedrock.js';
import { MistralAdapter } from './mistral.js';
import { CohereAdapter } from './cohere.js';
import { GroqAdapter } from './groq.js';

/**
 * Create all available adapters
 */
function createAdapters(): AdapterRegistry {
  const registry: AdapterRegistry = new Map();

  registry.set('openai', new OpenAIAdapter());
  registry.set('anthropic', new AnthropicAdapter());
  registry.set('google', new GoogleAdapter());

  return registry;
}

// Global adapter registry
let adapterRegistry: AdapterRegistry | null = null;

/**
 * Get the adapter registry, creating it if necessary
 */
export function getAdapterRegistry(): AdapterRegistry {
  if (!adapterRegistry) {
    adapterRegistry = createAdapters();
  }
  return adapterRegistry;
}

/**
 * Get an adapter for a specific provider
 *
 * @param provider - Provider name
 * @returns Provider adapter or undefined if not found
 *
 * @example
 * ```ts
 * const adapter = getAdapter('openai');
 * if (adapter) {
 *   const tokens = await adapter.countTokens('Hello, world!');
 *   console.log('Token count:', tokens);
 * }
 * ```
 */
export function getAdapter(provider: Provider): ProviderAdapter | undefined {
  return getAdapterRegistry().get(provider);
}

/**
 * Register a custom adapter
 *
 * @param provider - Provider name
 * @param adapter - Adapter instance
 *
 * @example
 * ```ts
 * registerAdapter('custom', new CustomAdapter());
 * ```
 */
export function registerAdapter(provider: Provider, adapter: ProviderAdapter): void {
  getAdapterRegistry().set(provider, adapter);
}

/**
 * Create an adapter for extended providers (Azure, Bedrock)
 *
 * @param provider - Extended provider name
 * @returns Provider adapter
 *
 * @example
 * ```ts
 * const adapter = createExtendedAdapter('azure');
 * const tokens = await adapter.countTokens('Hello!');
 * ```
 */
export function createExtendedAdapter(provider: ExtendedProvider): ProviderAdapter {
  switch (provider) {
    case 'openai':
      return new OpenAIAdapter();
    case 'anthropic':
      return new AnthropicAdapter();
    case 'google':
      return new GoogleAdapter();
    case 'azure':
      return new AzureAdapter();
    case 'bedrock':
      return new BedrockAdapter();
    case 'mistral':
      return new MistralAdapter();
    case 'cohere':
      return new CohereAdapter();
    case 'groq':
      return new GroqAdapter();
    case 'openai-compatible':
      // For OpenAI-compatible endpoints, use OpenAI adapter
      return new OpenAIAdapter();
    default:
      // Default to OpenAI adapter for unknown providers
      return new OpenAIAdapter();
  }
}

/**
 * Get all supported provider names
 */
export function getSupportedProviders(): Provider[] {
  return Array.from(getAdapterRegistry().keys());
}

/**
 * Check if a provider is supported
 */
export function isProviderSupported(provider: string): provider is Provider {
  return getAdapterRegistry().has(provider as Provider);
}
