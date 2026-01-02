/**
 * @module storage/memory
 * In-memory cache storage
 */

import type { CacheEntry, CacheStorage } from '../types.js';

/**
 * Options for memory storage
 */
export interface MemoryStorageOptions {
  /** Maximum entries to store */
  maxEntries?: number;
}

/**
 * Create an in-memory cache storage.
 * Fast but not persistent - data is lost on page refresh.
 *
 * @param options - Storage options
 * @returns Cache storage instance
 *
 * @example
 * ```ts
 * const storage = createMemoryStorage({ maxEntries: 100 });
 * await storage.set(entry);
 * const retrieved = await storage.get(entry.id);
 * ```
 */
export function createMemoryStorage(options: MemoryStorageOptions = {}): CacheStorage {
  const { maxEntries = 1000 } = options;
  const entries = new Map<string, CacheEntry>();

  /**
   * Evict oldest entries if over limit
   */
  function evictIfNeeded(): void {
    if (entries.size <= maxEntries) return;

    // Sort by timestamp and remove oldest
    const sorted = Array.from(entries.entries()).sort(
      (a, b) => a[1].metadata.timestamp - b[1].metadata.timestamp
    );

    const toRemove = sorted.slice(0, entries.size - maxEntries);
    for (const [id] of toRemove) {
      entries.delete(id);
    }
  }

  return {
    async get(id: string): Promise<CacheEntry | null> {
      const entry = entries.get(id);

      if (!entry) return null;

      // Check TTL
      if (entry.metadata.ttl) {
        const age = Date.now() - entry.metadata.timestamp;
        if (age > entry.metadata.ttl) {
          entries.delete(id);
          return null;
        }
      }

      return entry;
    },

    async set(entry: CacheEntry): Promise<void> {
      entries.set(entry.id, entry);
      evictIfNeeded();
    },

    async getAll(): Promise<CacheEntry[]> {
      const now = Date.now();
      const valid: CacheEntry[] = [];

      for (const [id, entry] of entries) {
        // Check TTL
        if (entry.metadata.ttl) {
          const age = now - entry.metadata.timestamp;
          if (age > entry.metadata.ttl) {
            entries.delete(id);
            continue;
          }
        }
        valid.push(entry);
      }

      return valid;
    },

    async delete(id: string): Promise<void> {
      entries.delete(id);
    },

    async clear(): Promise<void> {
      entries.clear();
    },

    async close(): Promise<void> {
      // No cleanup needed for memory storage
    },
  };
}
