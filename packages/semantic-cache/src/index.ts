/**
 * @module @token-optimizer/semantic-cache
 *
 * Semantic caching for AI responses using embeddings.
 * Reduces API costs by reusing cached responses for similar queries.
 *
 * @example
 * ```ts
 * import { createSemanticCache } from '@token-optimizer/semantic-cache';
 *
 * const cache = await createSemanticCache({
 *   storage: 'indexeddb',
 *   similarityThreshold: 0.92,
 * });
 *
 * // Check cache before API call
 * const result = await cache.get('How do I sort an array?');
 * if (result.hit) {
 *   console.log('Saved tokens:', result.savedTokens);
 *   return result.entry?.response;
 * }
 *
 * // Make API call and cache result
 * const response = await callAPI(query);
 * await cache.set(query, response, {
 *   model: 'gpt-4o',
 *   tokens: { input: 10, output: 100 },
 * });
 * ```
 */

// Types
export type {
  Embedder,
  CacheEntry,
  CacheEntryMetadata,
  CacheResult,
  SemanticCacheOptions,
  CacheStorage,
  CacheStats,
  SemanticCache,
} from './types.js';

// Core cache
export { createSemanticCache } from './cache.js';

// Embeddings
export {
  createTFIDFEmbedder,
  createTransformersEmbedder,
  isTransformersAvailable,
} from './embeddings/index.js';

// Storage
export {
  createMemoryStorage,
  createIndexedDBStorage,
  isIndexedDBAvailable,
  type MemoryStorageOptions,
  type IndexedDBStorageOptions,
} from './storage/index.js';

// Similarity
export {
  cosineSimilarity,
  euclideanDistance,
  findMostSimilar,
  findAllSimilar,
  pairwiseSimilarities,
} from './similarity/index.js';
