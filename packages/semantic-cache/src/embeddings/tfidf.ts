/**
 * @module embeddings/tfidf
 * Lightweight TF-IDF based embeddings (no external dependencies)
 */

import type { Embedder } from '../types.js';

/**
 * Tokenize text into words
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 1);
}

/**
 * Create a TF-IDF embedder.
 * Uses a fixed vocabulary and TF-IDF weighting for lightweight embeddings.
 * Less accurate than neural embeddings but requires no model download.
 *
 * @param vocabulary - Optional custom vocabulary
 * @param dimensions - Embedding dimensions (default: 256)
 * @returns Embedder instance
 *
 * @example
 * ```ts
 * const embedder = createTFIDFEmbedder();
 * const embedding = await embedder.embed('Hello, world!');
 * console.log(embedding.length); // 256
 * ```
 */
export function createTFIDFEmbedder(
  vocabulary?: string[],
  dimensions = 256
): Embedder {
  // Default vocabulary with common English words
  const vocab = vocabulary ?? getDefaultVocabulary();
  const vocabMap = new Map(vocab.map((word, i) => [word, i % dimensions]));

  // Document frequency counts (for IDF)
  const docFreq = new Map<string, number>();
  let totalDocs = 0;

  /**
   * Calculate TF-IDF embedding for text
   */
  function calculateEmbedding(text: string): number[] {
    const tokens = tokenize(text);
    const embedding = new Array(dimensions).fill(0);

    if (tokens.length === 0) {
      return embedding;
    }

    // Calculate term frequency
    const tf = new Map<string, number>();
    for (const token of tokens) {
      tf.set(token, (tf.get(token) ?? 0) + 1);
    }

    // Calculate TF-IDF and accumulate in embedding
    for (const [term, count] of tf) {
      const termFreq = count / tokens.length;
      const docFreqValue = docFreq.get(term) ?? 1;
      const idf = Math.log((totalDocs + 1) / (docFreqValue + 1)) + 1;
      const tfidf = termFreq * idf;

      // Map term to embedding dimensions using vocabulary
      const idx = vocabMap.get(term);
      if (idx !== undefined) {
        embedding[idx] += tfidf;
      } else {
        // Hash unknown words to a dimension
        const hash = hashString(term) % dimensions;
        embedding[hash] += tfidf * 0.5; // Lower weight for unknown words
      }
    }

    // Normalize
    const norm = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
    if (norm > 0) {
      for (let i = 0; i < dimensions; i++) {
        embedding[i]! /= norm;
      }
    }

    return embedding;
  }

  /**
   * Update document frequency counts
   */
  function updateDocFreq(text: string): void {
    const tokens = new Set(tokenize(text));
    totalDocs++;
    for (const token of tokens) {
      docFreq.set(token, (docFreq.get(token) ?? 0) + 1);
    }
  }

  return {
    dimensions,

    async embed(text: string): Promise<number[]> {
      updateDocFreq(text);
      return calculateEmbedding(text);
    },

    async embedBatch(texts: string[]): Promise<number[][]> {
      // Update doc freq for all texts first
      for (const text of texts) {
        updateDocFreq(text);
      }
      // Then calculate embeddings
      return texts.map(calculateEmbedding);
    },
  };
}

/**
 * Simple string hash function
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Get default vocabulary with common English words
 */
function getDefaultVocabulary(): string[] {
  // Common English words and programming terms
  return [
    // Common words
    'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i',
    'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at',
    'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she',
    'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their', 'what',
    'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go', 'me',
    'when', 'make', 'can', 'like', 'time', 'no', 'just', 'him', 'know', 'take',
    'people', 'into', 'year', 'your', 'good', 'some', 'could', 'them', 'see', 'other',
    'than', 'then', 'now', 'look', 'only', 'come', 'its', 'over', 'think', 'also',
    'back', 'after', 'use', 'two', 'how', 'our', 'work', 'first', 'well', 'way',
    'even', 'new', 'want', 'because', 'any', 'these', 'give', 'day', 'most', 'us',
    // Programming terms
    'function', 'class', 'method', 'variable', 'const', 'let', 'var', 'return',
    'async', 'await', 'promise', 'callback', 'event', 'handler', 'listener',
    'component', 'state', 'props', 'render', 'effect', 'hook', 'context',
    'api', 'request', 'response', 'error', 'data', 'json', 'object', 'array',
    'string', 'number', 'boolean', 'null', 'undefined', 'type', 'interface',
    'import', 'export', 'default', 'module', 'package', 'dependency',
    'code', 'file', 'directory', 'path', 'url', 'http', 'https', 'server',
    'client', 'database', 'query', 'insert', 'update', 'delete', 'select',
    'user', 'password', 'auth', 'token', 'session', 'cookie', 'header',
    'test', 'mock', 'expect', 'describe', 'it', 'should', 'assert',
    // AI/ML terms
    'model', 'train', 'predict', 'embedding', 'vector', 'similarity',
    'token', 'prompt', 'completion', 'chat', 'message', 'assistant',
    'openai', 'gpt', 'claude', 'anthropic', 'gemini', 'llm', 'ai',
    // Question words
    'what', 'why', 'how', 'when', 'where', 'who', 'which', 'whose',
    'explain', 'describe', 'compare', 'analyze', 'summarize', 'list',
    'create', 'generate', 'write', 'help', 'show', 'tell', 'find',
  ];
}
