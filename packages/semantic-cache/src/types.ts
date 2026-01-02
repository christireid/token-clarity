/**
 * @module types
 * Type definitions for semantic caching
 */

/**
 * Embedding generator interface
 */
export interface Embedder {
  /** Generate embedding for a single text */
  embed(text: string): Promise<number[]>;
  /** Generate embeddings for multiple texts */
  embedBatch(texts: string[]): Promise<number[][]>;
  /** Dimensions of the embedding vectors */
  dimensions: number;
}

/**
 * Cache entry stored in the cache
 */
export interface CacheEntry {
  /** Unique identifier */
  id: string;
  /** Original query text */
  query: string;
  /** Embedding vector for the query */
  queryEmbedding: number[];
  /** Cached response */
  response: string;
  /** Metadata about the cached entry */
  metadata: CacheEntryMetadata;
}

/**
 * Metadata for a cache entry
 */
export interface CacheEntryMetadata {
  /** Model used to generate the response */
  model: string;
  /** Token counts */
  tokens: {
    input: number;
    output: number;
  };
  /** Timestamp when cached */
  timestamp: number;
  /** Time-to-live in milliseconds */
  ttl?: number;
  /** Custom tags for filtering */
  tags?: string[];
}

/**
 * Result of a cache lookup
 */
export interface CacheResult {
  /** Whether a cache hit was found */
  hit: boolean;
  /** Matched entry (if hit) */
  entry?: CacheEntry;
  /** Similarity score (if hit) */
  similarity?: number;
  /** Tokens saved by cache hit */
  savedTokens?: number;
  /** Estimated cost saved */
  savedCost?: number;
}

/**
 * Options for creating a semantic cache
 */
export interface SemanticCacheOptions {
  /** Storage type */
  storage: 'memory' | 'indexeddb' | 'custom';
  /** Custom storage adapter */
  customStorage?: CacheStorage;
  /** Minimum similarity for cache hit (0-1) */
  similarityThreshold?: number;
  /** Maximum entries in cache */
  maxEntries?: number;
  /** Default TTL in milliseconds */
  ttlMs?: number;
  /** Embedding model type */
  embeddingModel?: 'transformers' | 'tfidf' | 'custom';
  /** Custom embedder */
  customEmbedder?: Embedder;
}

/**
 * Cache storage interface
 */
export interface CacheStorage {
  /** Get an entry by ID */
  get(id: string): Promise<CacheEntry | null>;
  /** Store an entry */
  set(entry: CacheEntry): Promise<void>;
  /** Get all entries */
  getAll(): Promise<CacheEntry[]>;
  /** Delete an entry */
  delete(id: string): Promise<void>;
  /** Clear all entries */
  clear(): Promise<void>;
  /** Close the storage connection */
  close(): Promise<void>;
}

/**
 * Cache statistics
 */
export interface CacheStats {
  /** Total entries in cache */
  totalEntries: number;
  /** Total cache hits */
  hits: number;
  /** Total cache misses */
  misses: number;
  /** Hit rate (0-1) */
  hitRate: number;
  /** Total tokens saved */
  tokensSaved: number;
  /** Total cost saved (USD) */
  costSaved: number;
  /** Average similarity of hits */
  avgSimilarity: number;
}

/**
 * Semantic cache interface
 */
export interface SemanticCache {
  /** Look up a query in the cache */
  get(query: string): Promise<CacheResult>;
  /** Store a response in the cache */
  set(query: string, response: string, metadata: Omit<CacheEntryMetadata, 'timestamp'>): Promise<void>;
  /** Delete an entry by ID */
  delete(id: string): Promise<void>;
  /** Clear all entries */
  clear(): Promise<void>;
  /** Look up multiple queries */
  getMany(queries: string[]): Promise<CacheResult[]>;
  /** Get cache statistics */
  getStats(): CacheStats;
  /** Close the cache */
  close(): Promise<void>;
}
