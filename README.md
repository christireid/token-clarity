# Token Optimizer

A modular, tree-shakeable React library for AI token optimization. Reduce LLM API costs by 40-90% through client-side optimizations.

[![CI](https://github.com/token-optimizer/token-optimizer/actions/workflows/ci.yml/badge.svg)](https://github.com/token-optimizer/token-optimizer/actions/workflows/ci.yml)
[![npm version](https://badge.fury.io/js/@token-optimizer%2Fcore.svg)](https://badge.fury.io/js/@token-optimizer%2Fcore)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- **Provider Cache Alignment**: 50-90% savings via prompt structure optimization
- **Semantic Caching**: 40-70% savings through embedding-based response reuse
- **Token Budget Management**: Real-time counting, limits, and pruning
- **Context Compression**: Smart history management and summarization
- **Cost Analytics**: Track spending across providers in real-time

## Packages

| Package | Description | Size |
|---------|-------------|------|
| [`@token-optimizer/core`](./packages/core) | Provider-agnostic utilities | <10KB |
| [`@token-optimizer/react`](./packages/react) | React hooks & components | <5KB |
| [`@token-optimizer/semantic-cache`](./packages/semantic-cache) | Embedding-based caching | <15KB |

## Quick Start

### Installation

```bash
# Core utilities
npm install @token-optimizer/core

# React hooks
npm install @token-optimizer/react

# Semantic caching (optional)
npm install @token-optimizer/semantic-cache
```

### Basic Usage

```tsx
import { useOptimizedChat, TokenOptimizerProvider } from '@token-optimizer/react';

function App() {
  return (
    <TokenOptimizerProvider
      config={{
        defaultModel: 'gpt-4o',
        defaultProvider: 'openai',
        globalBudget: { daily: 10.00 },
      }}
    >
      <Chat />
    </TokenOptimizerProvider>
  );
}

function Chat() {
  const {
    messages,
    input,
    setInput,
    sendMessage,
    isLoading,
    tokenBudget,
    costTracker,
  } = useOptimizedChat({
    api: '/api/chat',
    model: 'gpt-4o',
    provider: 'openai',
    enableCacheAlignment: true,
    enableCostTracking: true,
  });

  return (
    <div>
      <div>Budget: {tokenBudget.status}</div>
      <div>Cost: ${costTracker.sessionCost.toFixed(4)}</div>
      <div>Saved: ${costTracker.totalSavings.toFixed(4)}</div>

      {messages.map((m, i) => (
        <div key={i}>{m.role}: {m.content}</div>
      ))}

      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
        disabled={isLoading}
      />
    </div>
  );
}
```

### Token Counting

```ts
import { createTokenizer, estimateTokens } from '@token-optimizer/core';

// Quick estimation (no dependencies)
const estimate = estimateTokens('Hello, world!'); // ~3

// Accurate counting (lazy loads tokenizer)
const tokenizer = await createTokenizer('gpt-4o');
const count = tokenizer.count('Hello, world!'); // 4
const chatCount = tokenizer.countChat([
  { role: 'user', content: 'Hello!' },
  { role: 'assistant', content: 'Hi there!' },
]);
```

### Budget Management

```ts
import { createBudgetManager, getModelBudget } from '@token-optimizer/core';

const manager = createBudgetManager(getModelBudget('gpt-4o'));

const status = manager.checkBudget(5000, 1000);
console.log(status.status); // 'ok' | 'warning' | 'critical' | 'exceeded'
console.log(status.remaining.input); // 123000

// Trim messages to fit
const trimResult = manager.trimToFit(messages, { reserveForOutput: 2000 });
console.log(trimResult.messages); // Trimmed messages
console.log(trimResult.tokensSaved); // Tokens removed
```

### Cost Tracking

```ts
import { estimateCost, createUsageTracker } from '@token-optimizer/core';

// Estimate cost
const cost = estimateCost('gpt-4o', 1000, 500, 800);
console.log(cost.totalCost); // $0.0075
console.log(cost.savings?.fromCache); // $0.002

// Track usage
const tracker = createUsageTracker({ persistKey: 'my-app' });
tracker.trackRequest({
  model: 'gpt-4o',
  inputTokens: 1000,
  outputTokens: 500,
  cost: 0.0075,
});

const stats = tracker.getSessionStats();
console.log(stats.cost); // $0.0075
```

### Provider Cache Optimization

```ts
import {
  buildCacheAlignedPrompt,
  createSystemSegment,
  createContextSegment,
  createUserSegment,
  toAnthropicFormat,
} from '@token-optimizer/core';

// Build cache-optimized prompt
const prompt = buildCacheAlignedPrompt([
  createSystemSegment('You are a helpful assistant.'),
  createContextSegment(longDocument),
  createUserSegment('Summarize this document.'),
], { provider: 'anthropic' });

// Convert to provider format with cache_control
const request = toAnthropicFormat(prompt);
console.log(prompt.estimatedCacheHitRate); // 0.85
console.log(prompt.cacheableTokens); // 5000
```

### Semantic Caching

```ts
import { createSemanticCache } from '@token-optimizer/semantic-cache';

const cache = await createSemanticCache({
  storage: 'indexeddb',
  similarityThreshold: 0.92,
});

// Check cache before API call
const result = await cache.get('How do I sort an array?');
if (result.hit) {
  console.log('Cache hit!', result.similarity);
  console.log('Saved tokens:', result.savedTokens);
  return result.entry.response;
}

// Cache the response
await cache.set(query, response, {
  model: 'gpt-4o',
  tokens: { input: 50, output: 200 },
});
```

## React Hooks

### useTokenBudget

```tsx
const {
  status,           // Current budget status
  tokenizer,        // Loaded tokenizer
  isLoading,        // Loading state
  countTokens,      // Count tokens in text
  countMessages,    // Count tokens in messages
  checkBudget,      // Check if within budget
  trimMessages,     // Trim messages to fit
  remainingInput,   // Remaining input tokens
  remainingOutput,  // Remaining output tokens
} = useTokenBudget({
  model: 'gpt-4o',
  maxInputTokens: 4096,
  onWarning: (status) => console.log('Warning!'),
});
```

### useCostTracker

```tsx
const {
  sessionCost,      // Current session cost
  totalSavings,     // Savings from cache
  savingsPercent,   // Savings percentage
  trackRequest,     // Track a request
  estimateNext,     // Estimate next request cost
  budgetStatus,     // 'ok' | 'warning' | 'exceeded'
  budgetRemaining,  // Remaining budget
} = useCostTracker({
  model: 'gpt-4o',
  budgetLimit: 10.00,
  persistKey: 'my-app',
});
```

### usePromptOptimizer

```tsx
const {
  buildPrompt,       // Build optimized prompt
  toProviderRequest, // Convert to provider format
  cacheableTokens,   // Cacheable token count
  setSystemPrompt,   // Update system prompt
  setTools,          // Update tools
  setContext,        // Update context
} = usePromptOptimizer({
  provider: 'openai',
  model: 'gpt-4o',
  systemPrompt: 'You are helpful.',
  tools: myTools,
});
```

### useSemanticCache

```tsx
import { useSemanticCache } from '@token-optimizer/semantic-cache/react';

const {
  isReady,       // Cache ready state
  stats,         // Cache statistics
  checkCache,    // Check for cache hit
  cacheResponse, // Store response
  withCache,     // Wrapper for automatic caching
} = useSemanticCache({
  storage: 'indexeddb',
  similarityThreshold: 0.9,
});

// Automatic caching
const result = await withCache(
  query,
  () => fetch('/api/chat').then(r => r.json()),
  { extractResponse: (data) => data.response }
);
```

## Supported Models

### OpenAI
- GPT-4o, GPT-4o-mini
- GPT-4-turbo, GPT-4
- GPT-3.5-turbo
- o1, o1-mini

### Anthropic
- Claude 3 Opus
- Claude 3.5 Sonnet, Claude 3 Sonnet
- Claude 3 Haiku

### Google
- Gemini 1.5 Pro, Gemini 1.5 Flash
- Gemini Pro, Gemini Ultra

### Open Source
- Llama 3, Llama 3.1
- Mistral, Mixtral

## Bundle Sizes

| Package | Gzipped |
|---------|---------|
| `@token-optimizer/core` | <10KB |
| `@token-optimizer/react` | <5KB |
| `@token-optimizer/semantic-cache` | <15KB |

Tokenizers are lazy-loaded and not included in the main bundle.

## Requirements

- Node.js >= 18
- React >= 18 (for React package)

## Contributing

Contributions are welcome! Please read our [Contributing Guide](./CONTRIBUTING.md) for details.

## License

MIT License - see [LICENSE](./LICENSE) for details.
