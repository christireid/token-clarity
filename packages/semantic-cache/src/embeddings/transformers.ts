/**
 * @module embeddings/transformers
 * Neural embeddings using Transformers.js
 */

import type { Embedder } from '../types.js';

/**
 * Create an embedder using Transformers.js.
 * Uses all-MiniLM-L6-v2 model (~30MB, 384 dimensions).
 *
 * @returns Promise resolving to Embedder instance
 *
 * @example
 * ```ts
 * const embedder = await createTransformersEmbedder();
 * const embedding = await embedder.embed('Hello, world!');
 * console.log(embedding.length); // 384
 * ```
 */
export async function createTransformersEmbedder(): Promise<Embedder> {
  // Dynamic import for tree-shaking
  const { pipeline } = await import('@xenova/transformers');

  // Load the model
  const extractor = await pipeline(
    'feature-extraction',
    'Xenova/all-MiniLM-L6-v2',
    { quantized: true } // Use quantized model for smaller size
  );

  return {
    dimensions: 384,

    async embed(text: string): Promise<number[]> {
      const output = await extractor(text, {
        pooling: 'mean',
        normalize: true,
      });
      return Array.from(output.data as Float32Array);
    },

    async embedBatch(texts: string[]): Promise<number[][]> {
      const results: number[][] = [];

      // Process in batches to manage memory
      const batchSize = 8;
      for (let i = 0; i < texts.length; i += batchSize) {
        const batch = texts.slice(i, i + batchSize);
        const outputs = await Promise.all(
          batch.map(text =>
            extractor(text, { pooling: 'mean', normalize: true })
          )
        );
        results.push(...outputs.map((o) => Array.from(o.data as Float32Array)));
      }

      return results;
    },
  };
}

/**
 * Check if Transformers.js is available
 */
export async function isTransformersAvailable(): Promise<boolean> {
  try {
    await import('@xenova/transformers');
    return true;
  } catch {
    return false;
  }
}
