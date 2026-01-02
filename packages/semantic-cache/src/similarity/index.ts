/**
 * @module similarity
 * Vector similarity calculations
 */

import type { CacheEntry } from '../types.js';

/**
 * Calculate cosine similarity between two vectors.
 *
 * @param a - First vector
 * @param b - Second vector
 * @returns Similarity score (0-1, higher is more similar)
 *
 * @example
 * ```ts
 * const sim = cosineSimilarity([1, 0, 0], [1, 0, 0]); // 1.0
 * const sim2 = cosineSimilarity([1, 0, 0], [0, 1, 0]); // 0.0
 * ```
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same dimensions');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);

  if (denominator === 0) return 0;

  return dotProduct / denominator;
}

/**
 * Calculate Euclidean distance between two vectors.
 *
 * @param a - First vector
 * @param b - Second vector
 * @returns Distance (lower is more similar)
 */
export function euclideanDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same dimensions');
  }

  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i]! - b[i]!;
    sum += diff * diff;
  }

  return Math.sqrt(sum);
}

/**
 * Find the most similar entry in a collection.
 *
 * @param queryEmbedding - Query embedding vector
 * @param entries - Cache entries to search
 * @param threshold - Minimum similarity threshold
 * @returns Most similar entry and similarity score, or null if none meet threshold
 *
 * @example
 * ```ts
 * const result = findMostSimilar(queryEmbedding, entries, 0.9);
 * if (result) {
 *   console.log(`Found match with ${result.similarity} similarity`);
 * }
 * ```
 */
export function findMostSimilar(
  queryEmbedding: number[],
  entries: CacheEntry[],
  threshold: number
): { entry: CacheEntry; similarity: number } | null {
  let best: { entry: CacheEntry; similarity: number } | null = null;

  for (const entry of entries) {
    const similarity = cosineSimilarity(queryEmbedding, entry.queryEmbedding);

    if (similarity >= threshold) {
      if (!best || similarity > best.similarity) {
        best = { entry, similarity };
      }
    }
  }

  return best;
}

/**
 * Find all entries above a similarity threshold.
 *
 * @param queryEmbedding - Query embedding vector
 * @param entries - Cache entries to search
 * @param threshold - Minimum similarity threshold
 * @returns Array of matching entries with similarity scores, sorted by similarity
 */
export function findAllSimilar(
  queryEmbedding: number[],
  entries: CacheEntry[],
  threshold: number
): Array<{ entry: CacheEntry; similarity: number }> {
  const matches: Array<{ entry: CacheEntry; similarity: number }> = [];

  for (const entry of entries) {
    const similarity = cosineSimilarity(queryEmbedding, entry.queryEmbedding);

    if (similarity >= threshold) {
      matches.push({ entry, similarity });
    }
  }

  // Sort by similarity (descending)
  return matches.sort((a, b) => b.similarity - a.similarity);
}

/**
 * Compute pairwise similarities for a set of entries.
 * Useful for clustering or deduplication.
 *
 * @param entries - Cache entries
 * @returns Matrix of similarity scores
 */
export function pairwiseSimilarities(
  entries: CacheEntry[]
): number[][] {
  const n = entries.length;
  const matrix: number[][] = Array.from({ length: n }, () =>
    new Array(n).fill(0)
  );

  for (let i = 0; i < n; i++) {
    matrix[i]![i] = 1; // Self-similarity is 1
    for (let j = i + 1; j < n; j++) {
      const sim = cosineSimilarity(
        entries[i]!.queryEmbedding,
        entries[j]!.queryEmbedding
      );
      matrix[i]![j] = sim;
      matrix[j]![i] = sim;
    }
  }

  return matrix;
}
