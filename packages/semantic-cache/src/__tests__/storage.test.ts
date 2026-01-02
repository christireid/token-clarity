/**
 * Tests for storage module
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createMemoryStorage } from '../storage/memory.js';
import type { CacheEntry } from '../types.js';

describe('createMemoryStorage', () => {
  let storage: ReturnType<typeof createMemoryStorage>;

  const createEntry = (id: string): CacheEntry => ({
    id,
    query: `Query ${id}`,
    queryEmbedding: [0.1, 0.2, 0.3],
    response: `Response ${id}`,
    metadata: {
      model: 'gpt-4o',
      tokens: { input: 10, output: 20 },
      timestamp: Date.now(),
    },
  });

  beforeEach(() => {
    storage = createMemoryStorage({ maxEntries: 100 });
  });

  it('should store and retrieve an entry', async () => {
    const entry = createEntry('1');
    await storage.set(entry);

    const retrieved = await storage.get('1');
    expect(retrieved).toEqual(entry);
  });

  it('should return null for non-existent entry', async () => {
    const retrieved = await storage.get('non-existent');
    expect(retrieved).toBeNull();
  });

  it('should delete an entry', async () => {
    const entry = createEntry('1');
    await storage.set(entry);
    await storage.delete('1');

    const retrieved = await storage.get('1');
    expect(retrieved).toBeNull();
  });

  it('should clear all entries', async () => {
    await storage.set(createEntry('1'));
    await storage.set(createEntry('2'));
    await storage.clear();

    const all = await storage.getAll();
    expect(all).toHaveLength(0);
  });

  it('should get all entries', async () => {
    await storage.set(createEntry('1'));
    await storage.set(createEntry('2'));
    await storage.set(createEntry('3'));

    const all = await storage.getAll();
    expect(all).toHaveLength(3);
  });

  it('should respect max entries limit', async () => {
    const smallStorage = createMemoryStorage({ maxEntries: 3 });

    await smallStorage.set(createEntry('1'));
    await smallStorage.set(createEntry('2'));
    await smallStorage.set(createEntry('3'));
    await smallStorage.set(createEntry('4'));

    const all = await smallStorage.getAll();
    expect(all.length).toBeLessThanOrEqual(3);
  });

  it('should evict oldest entries when over limit', async () => {
    const smallStorage = createMemoryStorage({ maxEntries: 2 });

    const oldEntry = createEntry('old');
    oldEntry.metadata.timestamp = Date.now() - 10000;
    await smallStorage.set(oldEntry);

    const newEntry1 = createEntry('new1');
    newEntry1.metadata.timestamp = Date.now() - 5000;
    await smallStorage.set(newEntry1);

    const newEntry2 = createEntry('new2');
    newEntry2.metadata.timestamp = Date.now();
    await smallStorage.set(newEntry2);

    const all = await smallStorage.getAll();
    expect(all.some(e => e.id === 'old')).toBe(false);
  });

  it('should handle TTL expiration', async () => {
    const entry = createEntry('1');
    entry.metadata.ttl = 100; // 100ms TTL
    entry.metadata.timestamp = Date.now() - 200; // Already expired

    await storage.set(entry);

    const retrieved = await storage.get('1');
    expect(retrieved).toBeNull();
  });

  it('should not expire entries without TTL', async () => {
    const entry = createEntry('1');
    entry.metadata.timestamp = Date.now() - 1000000; // Old but no TTL

    await storage.set(entry);

    const retrieved = await storage.get('1');
    expect(retrieved).not.toBeNull();
  });

  it('should update existing entry', async () => {
    const entry1 = createEntry('1');
    await storage.set(entry1);

    const entry2 = { ...entry1, response: 'Updated response' };
    await storage.set(entry2);

    const retrieved = await storage.get('1');
    expect(retrieved?.response).toBe('Updated response');
  });

  it('should close without error', async () => {
    await expect(storage.close()).resolves.not.toThrow();
  });
});
