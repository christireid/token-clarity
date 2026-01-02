/**
 * @module storage
 * Cache storage adapters
 */

export { createMemoryStorage, type MemoryStorageOptions } from './memory.js';
export {
  createIndexedDBStorage,
  isIndexedDBAvailable,
  type IndexedDBStorageOptions,
} from './indexeddb.js';
export type { CacheStorage, CacheEntry } from '../types.js';
