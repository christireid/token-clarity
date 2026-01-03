/**
 * @module cache
 * Core semantic cache implementation
 */

import { estimateCost } from '@token-optimizer/core';
import type {
  SemanticCache,
  SemanticCacheOptions,
  CacheEntry,
  CacheResult,
  CacheStats,
  CacheStorage,
  Embedder,
  CacheEntryMetadata,
} from './types.js';
import { createMemoryStorage } from './storage/memory.js';
import { createIndexedDBStorage, isIndexedDBAvailable } from './storage/indexeddb.js';
import { createTFIDFEmbedder } from './embeddings/tfidf.js';
import { createTransformersEmbedder, isTransformersAvailable } from './embeddings/transformers.js';
import { findMostSimilar } from './similarity/index.js';

/**
 * Generate a unique ID for cache entries
 */
function generateId(): string {
  return `cache-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Create a semantic cache for AI responses.
 * Uses embeddings to find similar queries and reuse cached responses.
 *
 * @param options - Cache configuration options
 * @returns Promise resolving to SemanticCache instance
 *
 * @example
 * ```ts
 * const cache = await createSemanticCache({
 *   storage: 'indexeddb',
 *   similarityThreshold: 0.92,
 * });
 *
 * // Check cache before making API call
 * const result = await cache.get('How do I sort an array in JavaScript?');
 * if (result.hit) {
 *   console.log('Cache hit!', result.entry?.response);
 * } else {
 *   // Make API call and cache result
 *   const response = await callAPI(query);
 *   await cache.set(query, response, { model: 'gpt-4o', tokens: { input: 10, output: 100 } });
 * }
 * ```
 */
export async function createSemanticCache(
  options: SemanticCacheOptions
): Promise<SemanticCache> {
  const {
    storage: storageType,
    customStorage,
    similarityThreshold = 0.92,
    maxEntries = 1000,
    ttlMs,
    embeddingModel = 'tfidf',
    customEmbedder,
  } = options;

  // Initialize storage
  let storage: CacheStorage;
  if (customStorage) {
    storage = customStorage;
  } else if (storageType === 'indexeddb' && isIndexedDBAvailable()) {
    storage = createIndexedDBStorage({ maxEntries });
  } else {
    storage = createMemoryStorage({ maxEntries });
  }

  // Initialize embedder
  let embedder: Embedder;
  if (customEmbedder) {
    embedder = customEmbedder;
  } else if (embeddingModel === 'transformers' && (await isTransformersAvailable())) {
    embedder = await createTransformersEmbedder();
  } else {
    embedder = createTFIDFEmbedder();
  }

  // Statistics
  let hits = 0;
  let misses = 0;
  let tokensSaved = 0;
  let costSaved = 0;
  let totalSimilarity = 0;
  let similarityCount = 0;

  // Extract get function for reuse in getMany
  async function get(query: string): Promise<CacheResult> {
    // Generate embedding for query
    const queryEmbedding = await embedder.embed(query);

    // Get all entries and find most similar
    const entries = await storage.getAll();
    const match = findMostSimilar(queryEmbedding, entries, similarityThreshold);

    if (match) {
      hits++;
      totalSimilarity += match.similarity;
      similarityCount++;

      const saved = match.entry.metadata.tokens.input + match.entry.metadata.tokens.output;
      tokensSaved += saved;

      const costEstimate = estimateCost(
        match.entry.metadata.model,
        match.entry.metadata.tokens.input,
        match.entry.metadata.tokens.output
      );
      costSaved += costEstimate.totalCost;

      return {
        hit: true,
        entry: match.entry,
        similarity: match.similarity,
        savedTokens: saved,
        savedCost: costEstimate.totalCost,
      };
    }

    misses++;
    return { hit: false };
  }

  return {
    get,

    async set(
      query: string,
      response: string,
      metadata: Omit<CacheEntryMetadata, 'timestamp'>
    ): Promise<void> {
      const queryEmbedding = await embedder.embed(query);

      const entry: CacheEntry = {
        id: generateId(),
        query,
        queryEmbedding,
        response,
        metadata: {
          ...metadata,
          timestamp: Date.now(),
          ttl: metadata.ttl ?? ttlMs,
        },
      };

      await storage.set(entry);
    },

    async delete(id: string): Promise<void> {
      await storage.delete(id);
    },

    async clear(): Promise<void> {
      await storage.clear();
      // Reset stats
      hits = 0;
      misses = 0;
      tokensSaved = 0;
      costSaved = 0;
      totalSimilarity = 0;
      similarityCount = 0;
    },

    async getMany(queries: string[]): Promise<CacheResult[]> {
      const results: CacheResult[] = [];

      for (const query of queries) {
        results.push(await get(query));
      }

      return results;
    },

    getStats(): CacheStats {
      const total = hits + misses;
      return {
        totalEntries: 0, // Will be calculated from storage
        hits,
        misses,
        hitRate: total > 0 ? hits / total : 0,
        tokensSaved,
        costSaved,
        avgSimilarity: similarityCount > 0 ? totalSimilarity / similarityCount : 0,
      };
    },

    async close(): Promise<void> {
      await storage.close();
    },
  };
}
