/**
 * @module react/useSemanticCache
 * React hook for semantic caching
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { SemanticCache, CacheResult, CacheStats, CacheEntryMetadata } from '../types.js';
import { createSemanticCache } from '../cache.js';

/**
 * Options for useSemanticCache hook
 */
export interface UseSemanticCacheOptions {
  /** Enable/disable caching */
  enabled?: boolean;
  /** Storage type */
  storage?: 'memory' | 'indexeddb';
  /** Similarity threshold (0-1) */
  similarityThreshold?: number;
  /** Default TTL in milliseconds */
  ttlMs?: number;
  /** Embedding model */
  embeddingModel?: 'tfidf' | 'transformers';
  /** Callback when cache hit occurs */
  onCacheHit?: (result: CacheResult) => void;
  /** Callback when cache miss occurs */
  onCacheMiss?: (query: string) => void;
}

/**
 * Return type for useSemanticCache hook
 */
export interface UseSemanticCacheReturn {
  /** Whether the cache is ready */
  isReady: boolean;
  /** Whether an operation is in progress */
  isLoading: boolean;
  /** Cache statistics */
  stats: CacheStats;
  /** Check if a query is in cache */
  checkCache: (query: string) => Promise<CacheResult>;
  /** Cache a response */
  cacheResponse: (
    query: string,
    response: string,
    metadata: Omit<CacheEntryMetadata, 'timestamp'>
  ) => Promise<void>;
  /** Invalidate a cached entry */
  invalidate: (id: string) => Promise<void>;
  /** Clear all cache */
  clear: () => Promise<void>;
  /** Wrapper that handles caching automatically */
  withCache: <T>(
    query: string,
    fetchFn: () => Promise<T>,
    options?: {
      extractResponse: (data: T) => string;
      model?: string;
      estimateTokens?: (data: T) => { input: number; output: number };
    }
  ) => Promise<{ data: T | string; cached: boolean; similarity?: number }>;
}

/**
 * Default cache stats
 */
const defaultStats: CacheStats = {
  totalEntries: 0,
  hits: 0,
  misses: 0,
  hitRate: 0,
  tokensSaved: 0,
  costSaved: 0,
  avgSimilarity: 0,
};

/**
 * React hook for semantic caching of AI responses.
 *
 * @param options - Cache configuration options
 * @returns Cache utilities
 *
 * @example
 * ```tsx
 * function ChatComponent() {
 *   const { checkCache, cacheResponse, stats, withCache } = useSemanticCache({
 *     storage: 'indexeddb',
 *     similarityThreshold: 0.9,
 *   });
 *
 *   const handleQuery = async (query: string) => {
 *     const result = await withCache(
 *       query,
 *       () => fetch('/api/chat', { body: JSON.stringify({ query }) }).then(r => r.json()),
 *       {
 *         extractResponse: (data) => data.response,
 *         model: 'gpt-4o',
 *       }
 *     );
 *
 *     if (result.cached) {
 *       console.log('Served from cache!');
 *     }
 *
 *     return result.data;
 *   };
 *
 *   return <div>Cache hit rate: {(stats.hitRate * 100).toFixed(1)}%</div>;
 * }
 * ```
 */
export function useSemanticCache(
  options: UseSemanticCacheOptions = {}
): UseSemanticCacheReturn {
  const {
    enabled = true,
    storage = 'memory',
    similarityThreshold = 0.92,
    ttlMs,
    embeddingModel = 'tfidf',
    onCacheHit,
    onCacheMiss,
  } = options;

  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [stats, setStats] = useState<CacheStats>(defaultStats);

  const cacheRef = useRef<SemanticCache | null>(null);

  // Initialize cache
  useEffect(() => {
    if (!enabled) {
      setIsReady(true);
      return;
    }

    let mounted = true;

    createSemanticCache({
      storage,
      similarityThreshold,
      ttlMs,
      embeddingModel,
    })
      .then(cache => {
        if (mounted) {
          cacheRef.current = cache;
          setIsReady(true);
        }
      })
      .catch(error => {
        console.error('Failed to initialize semantic cache:', error);
        if (mounted) {
          setIsReady(true); // Continue without caching
        }
      });

    return () => {
      mounted = false;
      cacheRef.current?.close();
    };
  }, [enabled, storage, similarityThreshold, ttlMs, embeddingModel]);

  // Check cache
  const checkCache = useCallback(
    async (query: string): Promise<CacheResult> => {
      if (!enabled || !cacheRef.current) {
        return { hit: false };
      }

      setIsLoading(true);
      try {
        const result = await cacheRef.current.get(query);
        setStats(cacheRef.current.getStats());

        if (result.hit) {
          onCacheHit?.(result);
        } else {
          onCacheMiss?.(query);
        }

        return result;
      } finally {
        setIsLoading(false);
      }
    },
    [enabled, onCacheHit, onCacheMiss]
  );

  // Cache response
  const cacheResponse = useCallback(
    async (
      query: string,
      response: string,
      metadata: Omit<CacheEntryMetadata, 'timestamp'>
    ): Promise<void> => {
      if (!enabled || !cacheRef.current) return;

      setIsLoading(true);
      try {
        await cacheRef.current.set(query, response, metadata);
        setStats(cacheRef.current.getStats());
      } finally {
        setIsLoading(false);
      }
    },
    [enabled]
  );

  // Invalidate entry
  const invalidate = useCallback(
    async (id: string): Promise<void> => {
      if (!cacheRef.current) return;
      await cacheRef.current.delete(id);
      setStats(cacheRef.current.getStats());
    },
    []
  );

  // Clear cache
  const clear = useCallback(async (): Promise<void> => {
    if (!cacheRef.current) return;
    await cacheRef.current.clear();
    setStats(cacheRef.current.getStats());
  }, []);

  // Wrapper for automatic caching
  const withCache = useCallback(
    async <T>(
      query: string,
      fetchFn: () => Promise<T>,
      options?: {
        extractResponse?: (data: T) => string;
        model?: string;
        estimateTokens?: (data: T) => { input: number; output: number };
      }
    ): Promise<{ data: T | string; cached: boolean; similarity?: number }> => {
      // Check cache first
      const cacheResult = await checkCache(query);

      if (cacheResult.hit && cacheResult.entry) {
        return {
          data: cacheResult.entry.response,
          cached: true,
          similarity: cacheResult.similarity,
        };
      }

      // Fetch fresh data
      const data = await fetchFn();

      // Cache the response
      if (enabled && cacheRef.current) {
        const response = options?.extractResponse?.(data) ?? String(data);
        const tokens = options?.estimateTokens?.(data) ?? { input: 0, output: 0 };

        await cacheResponse(query, response, {
          model: options?.model ?? 'unknown',
          tokens,
        });
      }

      return { data, cached: false };
    },
    [enabled, checkCache, cacheResponse]
  );

  return {
    isReady,
    isLoading,
    stats,
    checkCache,
    cacheResponse,
    invalidate,
    clear,
    withCache,
  };
}
