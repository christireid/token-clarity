# @token-optimizer/semantic-cache

Semantic caching for AI responses using embeddings. Reduce API costs by reusing cached responses for similar queries.

## Installation

```bash
npm install @token-optimizer/semantic-cache
```

## Features

- Embedding-based similarity matching
- Multiple storage backends (memory, IndexedDB)
- TF-IDF and Transformers.js embeddings
- React hook for easy integration
- TTL support and automatic eviction

## Usage

### Basic Usage

```ts
import { createSemanticCache } from '@token-optimizer/semantic-cache';

const cache = await createSemanticCache({
  storage: 'indexeddb',
  similarityThreshold: 0.92,
  maxEntries: 1000,
});

// Check cache before API call
const result = await cache.get('How do I sort an array in JavaScript?');

if (result.hit) {
  console.log('Cache hit!', result.similarity);
  console.log('Saved tokens:', result.savedTokens);
  return result.entry.response;
}

// Make API call...
const response = await callAPI(query);

// Cache the response
await cache.set(query, response, {
  model: 'gpt-4o',
  tokens: { input: 50, output: 200 },
});
```

### React Hook

```tsx
import { useSemanticCache } from '@token-optimizer/semantic-cache/react';

function Chat() {
  const { checkCache, cacheResponse, stats, withCache } = useSemanticCache({
    storage: 'indexeddb',
    similarityThreshold: 0.9,
  });

  const handleQuery = async (query: string) => {
    // Automatic caching
    const result = await withCache(
      query,
      () => fetch('/api/chat', { body: JSON.stringify({ query }) }).then(r => r.json()),
      {
        extractResponse: (data) => data.response,
        model: 'gpt-4o',
      }
    );

    return result.data;
  };

  return <div>Hit rate: {(stats.hitRate * 100).toFixed(1)}%</div>;
}
```

### Custom Embeddings

```ts
import { createSemanticCache } from '@token-optimizer/semantic-cache';

// Use Transformers.js for better accuracy
const cache = await createSemanticCache({
  storage: 'indexeddb',
  embeddingModel: 'transformers', // Uses all-MiniLM-L6-v2
});

// Or use TF-IDF for faster, lighter embeddings
const lightCache = await createSemanticCache({
  storage: 'memory',
  embeddingModel: 'tfidf',
});
```

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `storage` | `'memory' \| 'indexeddb' \| 'custom'` | - | Storage backend |
| `similarityThreshold` | `number` | `0.92` | Minimum similarity for cache hit |
| `maxEntries` | `number` | `1000` | Maximum cached entries |
| `ttlMs` | `number` | - | Default TTL in milliseconds |
| `embeddingModel` | `'tfidf' \| 'transformers' \| 'custom'` | `'tfidf'` | Embedding model |

## API Reference

See the [full documentation](../README.md) for complete API reference.

## License

MIT
