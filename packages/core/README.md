# @token-optimizer/core

Core utilities for AI token optimization. Provider-agnostic utilities for tokenization, budgets, caching, and cost estimation.

## Installation

```bash
npm install @token-optimizer/core
```

## Features

- Token counting with lazy-loaded tokenizers
- Budget management with automatic trimming
- Cost estimation for all major AI providers
- Provider cache alignment for OpenAI, Anthropic, and Google
- Context compression and summarization

## Usage

### Token Counting

```ts
import { createTokenizer, estimateTokens } from '@token-optimizer/core';

// Quick estimation (no dependencies)
const estimate = estimateTokens('Hello, world!');

// Accurate counting (lazy loads tokenizer)
const tokenizer = await createTokenizer('gpt-4o');
const count = tokenizer.count('Hello, world!');
```

### Budget Management

```ts
import { createBudgetManager } from '@token-optimizer/core';

const manager = createBudgetManager({
  maxInputTokens: 4096,
  maxOutputTokens: 1024,
});

const status = manager.checkBudget(2000, 500);
console.log(status.status); // 'ok' | 'warning' | 'critical' | 'exceeded'
```

### Cost Estimation

```ts
import { estimateCost } from '@token-optimizer/core';

const cost = estimateCost('gpt-4o', 1000, 500, 800);
console.log(cost.totalCost); // USD
console.log(cost.savings?.fromCache); // Cache savings
```

### Cache Alignment

```ts
import {
  buildCacheAlignedPrompt,
  createSystemSegment,
  createUserSegment,
  toAnthropicFormat,
} from '@token-optimizer/core';

const prompt = buildCacheAlignedPrompt([
  createSystemSegment('You are helpful.'),
  createUserSegment('Hello'),
], { provider: 'anthropic' });

const request = toAnthropicFormat(prompt);
```

## API Reference

See the [full documentation](../README.md) for complete API reference.

## License

MIT
