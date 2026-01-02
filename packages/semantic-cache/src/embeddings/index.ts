/**
 * @module embeddings
 * Embedding generation utilities
 */

export { createTFIDFEmbedder } from './tfidf.js';
export { createTransformersEmbedder, isTransformersAvailable } from './transformers.js';
export type { Embedder } from '../types.js';
