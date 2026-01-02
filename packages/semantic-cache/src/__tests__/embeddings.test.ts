/**
 * Tests for embeddings module
 */

import { describe, it, expect } from 'vitest';
import { createTFIDFEmbedder } from '../embeddings/tfidf.js';

describe('createTFIDFEmbedder', () => {
  it('should create embedder with default dimensions', () => {
    const embedder = createTFIDFEmbedder();
    expect(embedder.dimensions).toBe(256);
  });

  it('should create embedder with custom dimensions', () => {
    const embedder = createTFIDFEmbedder(undefined, 128);
    expect(embedder.dimensions).toBe(128);
  });

  it('should generate embedding for text', async () => {
    const embedder = createTFIDFEmbedder();
    const embedding = await embedder.embed('Hello, world!');

    expect(embedding).toHaveLength(256);
    expect(embedding.every(v => typeof v === 'number')).toBe(true);
  });

  it('should generate normalized embeddings', async () => {
    const embedder = createTFIDFEmbedder();
    const embedding = await embedder.embed('Test text for embedding.');

    const norm = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
    expect(norm).toBeCloseTo(1, 5);
  });

  it('should generate similar embeddings for similar text', async () => {
    const embedder = createTFIDFEmbedder();
    const embedding1 = await embedder.embed('How to sort an array in JavaScript');
    const embedding2 = await embedder.embed('Sorting arrays in JavaScript');
    const embedding3 = await embedder.embed('Making a cake recipe');

    // Calculate cosine similarities
    const sim12 = embedding1.reduce((sum, v, i) => sum + v * (embedding2[i] ?? 0), 0);
    const sim13 = embedding1.reduce((sum, v, i) => sum + v * (embedding3[i] ?? 0), 0);

    expect(sim12).toBeGreaterThan(sim13);
  });

  it('should handle empty string', async () => {
    const embedder = createTFIDFEmbedder();
    const embedding = await embedder.embed('');

    expect(embedding).toHaveLength(256);
    expect(embedding.every(v => v === 0)).toBe(true);
  });

  it('should generate batch embeddings', async () => {
    const embedder = createTFIDFEmbedder();
    const embeddings = await embedder.embedBatch([
      'First text',
      'Second text',
      'Third text',
    ]);

    expect(embeddings).toHaveLength(3);
    expect(embeddings.every(e => e.length === 256)).toBe(true);
  });

  it('should use custom vocabulary', async () => {
    const vocab = ['hello', 'world', 'test'];
    const embedder = createTFIDFEmbedder(vocab);
    const embedding = await embedder.embed('hello world');

    expect(embedding).toHaveLength(256);
  });
});
