/**
 * @module storage/indexeddb
 * IndexedDB cache storage for persistent caching
 */

import type { CacheEntry, CacheStorage } from '../types.js';

/**
 * Options for IndexedDB storage
 */
export interface IndexedDBStorageOptions {
  /** Database name */
  dbName?: string;
  /** Object store name */
  storeName?: string;
  /** Maximum entries */
  maxEntries?: number;
}

/**
 * Create an IndexedDB cache storage.
 * Persistent storage that survives page refreshes.
 *
 * @param options - Storage options
 * @returns Cache storage instance
 *
 * @example
 * ```ts
 * const storage = createIndexedDBStorage({
 *   dbName: 'my-app-cache',
 * });
 * await storage.set(entry);
 * const retrieved = await storage.get(entry.id);
 * ```
 */
export function createIndexedDBStorage(
  options: IndexedDBStorageOptions = {}
): CacheStorage {
  const {
    dbName = 'token-optimizer-cache',
    storeName = 'semantic-cache',
    maxEntries = 1000,
  } = options;

  let db: IDBDatabase | null = null;

  /**
   * Get or open database connection
   */
  async function getDB(): Promise<IDBDatabase> {
    if (db) return db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName, 1);

      request.onerror = () => reject(request.error);

      request.onsuccess = () => {
        db = request.result;
        resolve(db);
      };

      request.onupgradeneeded = event => {
        const database = (event.target as IDBOpenDBRequest).result;

        if (!database.objectStoreNames.contains(storeName)) {
          const store = database.createObjectStore(storeName, { keyPath: 'id' });
          store.createIndex('timestamp', 'metadata.timestamp');
        }
      };
    });
  }

  /**
   * Run a transaction
   */
  async function transaction<T>(
    mode: IDBTransactionMode,
    operation: (store: IDBObjectStore) => IDBRequest<T>
  ): Promise<T> {
    const database = await getDB();
    return new Promise((resolve, reject) => {
      const tx = database.transaction(storeName, mode);
      const store = tx.objectStore(storeName);
      const request = operation(store);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  /**
   * Evict oldest entries if over limit
   */
  async function evictIfNeeded(): Promise<void> {
    const all = await transaction('readonly', store => store.getAll());

    if (all.length <= maxEntries) return;

    // Sort by timestamp and find entries to remove
    const sorted = (all as CacheEntry[]).sort(
      (a, b) => a.metadata.timestamp - b.metadata.timestamp
    );

    const toRemove = sorted.slice(0, all.length - maxEntries);

    // Delete in a single transaction
    const database = await getDB();
    return new Promise((resolve, reject) => {
      const tx = database.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);

      for (const entry of toRemove) {
        store.delete(entry.id);
      }

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  return {
    async get(id: string): Promise<CacheEntry | null> {
      const entry = await transaction('readonly', store => store.get(id)) as CacheEntry | undefined;

      if (!entry) return null;

      // Check TTL
      if (entry.metadata.ttl) {
        const age = Date.now() - entry.metadata.timestamp;
        if (age > entry.metadata.ttl) {
          await transaction('readwrite', store => store.delete(id));
          return null;
        }
      }

      return entry;
    },

    async set(entry: CacheEntry): Promise<void> {
      await transaction('readwrite', store => store.put(entry));
      await evictIfNeeded();
    },

    async getAll(): Promise<CacheEntry[]> {
      const all = await transaction('readonly', store => store.getAll()) as CacheEntry[];
      const now = Date.now();
      const valid: CacheEntry[] = [];
      const expired: string[] = [];

      for (const entry of all) {
        if (entry.metadata.ttl) {
          const age = now - entry.metadata.timestamp;
          if (age > entry.metadata.ttl) {
            expired.push(entry.id);
            continue;
          }
        }
        valid.push(entry);
      }

      // Clean up expired entries
      if (expired.length > 0) {
        const database = await getDB();
        const tx = database.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        for (const id of expired) {
          store.delete(id);
        }
      }

      return valid;
    },

    async delete(id: string): Promise<void> {
      await transaction('readwrite', store => store.delete(id));
    },

    async clear(): Promise<void> {
      await transaction('readwrite', store => store.clear());
    },

    async close(): Promise<void> {
      db?.close();
      db = null;
    },
  };
}

/**
 * Check if IndexedDB is available
 */
export function isIndexedDBAvailable(): boolean {
  return typeof indexedDB !== 'undefined';
}
