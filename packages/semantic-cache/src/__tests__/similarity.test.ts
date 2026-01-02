/**
 * Tests for similarity module
 */

import { describe, it, expect } from 'vitest';
import {
  cosineSimilarity,
  euclideanDistance,
  findMostSimilar,
  findAllSimilar,
} from '../similarity/index.js';
import type { CacheEntry } from '../types.js';

describe('cosineSimilarity', () => {
  it('should return 1 for identical vectors', () => {
    const a = [1, 0, 0];
    const b = [1, 0, 0];
    expect(cosineSimilarity(a, b)).toBeCloseTo(1);
  });

  it('should return 0 for orthogonal vectors', () => {
    const a = [1, 0, 0];
    const b = [0, 1, 0];
    expect(cosineSimilarity(a, b)).toBeCloseTo(0);
  });

  it('should return -1 for opposite vectors', () => {
    const a = [1, 0, 0];
    const b = [-1, 0, 0];
    expect(cosineSimilarity(a, b)).toBeCloseTo(-1);
  });

  it('should handle non-unit vectors', () => {
    const a = [2, 0, 0];
    const b = [3, 0, 0];
    expect(cosineSimilarity(a, b)).toBeCloseTo(1);
  });

  it('should throw for vectors of different dimensions', () => {
    const a = [1, 0];
    const b = [1, 0, 0];
    expect(() => cosineSimilarity(a, b)).toThrow();
  });

  it('should return 0 for zero vectors', () => {
    const a = [0, 0, 0];
    const b = [1, 0, 0];
    expect(cosineSimilarity(a, b)).toBe(0);
  });
});

describe('euclideanDistance', () => {
  it('should return 0 for identical vectors', () => {
    const a = [1, 2, 3];
    const b = [1, 2, 3];
    expect(euclideanDistance(a, b)).toBe(0);
  });

  it('should calculate correct distance', () => {
    const a = [0, 0, 0];
    const b = [3, 4, 0];
    expect(euclideanDistance(a, b)).toBe(5);
  });

  it('should throw for vectors of different dimensions', () => {
    const a = [1, 0];
    const b = [1, 0, 0];
    expect(() => euclideanDistance(a, b)).toThrow();
  });
});

describe('findMostSimilar', () => {
  const createEntry = (id: string, embedding: number[]): CacheEntry => ({
    id,
    query: 'test query',
    queryEmbedding: embedding,
    response: 'test response',
    metadata: {
      model: 'gpt-4o',
      tokens: { input: 10, output: 20 },
      timestamp: Date.now(),
    },
  });

  it('should find the most similar entry', () => {
    const entries = [
      createEntry('1', [1, 0, 0]),
      createEntry('2', [0.9, 0.1, 0]),
      createEntry('3', [0, 1, 0]),
    ];

    const result = findMostSimilar([1, 0, 0], entries, 0.8);

    expect(result).not.toBeNull();
    expect(result?.entry.id).toBe('1');
    expect(result?.similarity).toBeCloseTo(1);
  });

  it('should return null if no entry meets threshold', () => {
    const entries = [
      createEntry('1', [0, 1, 0]),
      createEntry('2', [0, 0, 1]),
    ];

    const result = findMostSimilar([1, 0, 0], entries, 0.9);

    expect(result).toBeNull();
  });

  it('should handle empty entries array', () => {
    const result = findMostSimilar([1, 0, 0], [], 0.8);
    expect(result).toBeNull();
  });
});

describe('findAllSimilar', () => {
  const createEntry = (id: string, embedding: number[]): CacheEntry => ({
    id,
    query: 'test query',
    queryEmbedding: embedding,
    response: 'test response',
    metadata: {
      model: 'gpt-4o',
      tokens: { input: 10, output: 20 },
      timestamp: Date.now(),
    },
  });

  it('should find all entries above threshold', () => {
    const entries = [
      createEntry('1', [1, 0, 0]),
      createEntry('2', [0.9, 0.1, 0]),
      createEntry('3', [0, 1, 0]),
    ];

    const results = findAllSimilar([1, 0, 0], entries, 0.8);

    expect(results.length).toBe(2);
    expect(results[0]?.entry.id).toBe('1');
    expect(results[1]?.entry.id).toBe('2');
  });

  it('should sort by similarity descending', () => {
    const entries = [
      createEntry('1', [0.8, 0.2, 0]),
      createEntry('2', [1, 0, 0]),
      createEntry('3', [0.9, 0.1, 0]),
    ];

    const results = findAllSimilar([1, 0, 0], entries, 0.7);

    expect(results[0]?.entry.id).toBe('2');
    expect(results[0]?.similarity).toBeGreaterThan(results[1]?.similarity ?? 0);
  });

  it('should return empty array if nothing meets threshold', () => {
    const entries = [createEntry('1', [0, 1, 0])];

    const results = findAllSimilar([1, 0, 0], entries, 0.9);

    expect(results).toHaveLength(0);
  });
});
