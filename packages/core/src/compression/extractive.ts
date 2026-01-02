/**
 * @module compression/extractive
 * Extractive text compression using sentence scoring
 */

import { estimateTokens } from '../tokenizers/estimation.js';
import type { CompressionResult, CompressionOptions, ScoredSentence } from './types.js';

/**
 * Split text into sentences
 */
function splitSentences(text: string): string[] {
  // Handle common sentence endings while preserving abbreviations
  const sentences = text
    .replace(/([.!?])\s+/g, '$1\n')
    .split('\n')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  return sentences;
}

/**
 * Calculate word frequency across all sentences
 */
function calculateWordFrequency(sentences: string[]): Map<string, number> {
  const frequency = new Map<string, number>();
  const totalWords = sentences.join(' ').toLowerCase().split(/\s+/);

  for (const word of totalWords) {
    const cleaned = word.replace(/[^\w]/g, '');
    if (cleaned.length > 2) {
      frequency.set(cleaned, (frequency.get(cleaned) ?? 0) + 1);
    }
  }

  return frequency;
}

/**
 * Calculate TF-IDF-like score for a sentence
 */
function scoreSentence(
  sentence: string,
  wordFrequency: Map<string, number>,
  options: CompressionOptions
): number {
  const words = sentence.toLowerCase().split(/\s+/);
  let score = 0;

  // Word importance (TF-IDF approximation)
  for (const word of words) {
    const cleaned = word.replace(/[^\w]/g, '');
    const freq = wordFrequency.get(cleaned) ?? 0;
    if (freq > 0) {
      // IDF-like weighting: rare words score higher
      score += 1 / Math.log(freq + 1);
    }
  }

  // Normalize by sentence length
  score /= Math.max(words.length, 1);

  // Bonus for structure preservation
  if (options.preserveStructure) {
    // Headers/titles (short sentences ending without period)
    if (sentence.length < 100 && !sentence.endsWith('.')) {
      score *= 1.5;
    }
    // List items
    if (/^[-•*]\s/.test(sentence) || /^\d+[.)]\s/.test(sentence)) {
      score *= 1.3;
    }
  }

  // Bonus for entities
  if (options.preserveEntities) {
    // Capitalized words (likely proper nouns)
    const entities = sentence.match(/[A-Z][a-z]+/g) ?? [];
    score += entities.length * 0.1;
  }

  // Bonus for numbers
  if (options.preserveNumbers) {
    const numbers = sentence.match(/\d+[.,]?\d*/g) ?? [];
    score += numbers.length * 0.15;
  }

  return score;
}

/**
 * Compress text using extractive summarization.
 * Selects the most important sentences based on TF-IDF scoring.
 *
 * @param text - Text to compress
 * @param options - Compression options
 * @returns Compression result
 *
 * @example
 * ```ts
 * const result = compressExtractive(longDocument, {
 *   targetRatio: 0.3,
 *   preserveStructure: true,
 * });
 * console.log(result.compressed);
 * console.log(`Reduced to ${result.compressionRatio * 100}%`);
 * ```
 */
export function compressExtractive(
  text: string,
  options: CompressionOptions = {}
): CompressionResult {
  const {
    targetRatio = 0.5,
    preserveStructure = true,
    preserveEntities = true,
    preserveNumbers = true,
    minImportance = 0,
  } = options;

  if (!text.trim()) {
    return {
      original: text,
      compressed: text,
      originalTokens: 0,
      compressedTokens: 0,
      compressionRatio: 1,
    };
  }

  const sentences = splitSentences(text);
  const wordFrequency = calculateWordFrequency(sentences);

  // Score all sentences
  const scoredSentences: ScoredSentence[] = sentences.map((sentence, index) => ({
    text: sentence,
    score: scoreSentence(sentence, wordFrequency, {
      preserveStructure,
      preserveEntities,
      preserveNumbers,
    }),
    position: index,
  }));

  // Filter by minimum importance
  const filteredSentences = scoredSentences.filter(s => s.score >= minImportance);

  // Sort by score (descending)
  const sortedByScore = [...filteredSentences].sort((a, b) => b.score - a.score);

  // Select top sentences until we reach target ratio
  const targetLength = text.length * targetRatio;
  let currentLength = 0;
  const selected: ScoredSentence[] = [];

  for (const sentence of sortedByScore) {
    if (currentLength >= targetLength) break;
    selected.push(sentence);
    currentLength += sentence.text.length + 1; // +1 for space
  }

  // Restore original order for coherent output
  selected.sort((a, b) => a.position - b.position);

  const compressed = selected.map(s => s.text).join(' ');

  const originalTokens = estimateTokens(text);
  const compressedTokens = estimateTokens(compressed);

  return {
    original: text,
    compressed,
    originalTokens,
    compressedTokens,
    compressionRatio: compressedTokens / originalTokens,
  };
}

/**
 * Quick compression for time-sensitive applications.
 * Uses simpler heuristics for faster execution.
 *
 * @param text - Text to compress
 * @param targetRatio - Target compression ratio
 * @returns Compressed text
 */
export function quickCompress(text: string, targetRatio = 0.5): string {
  const sentences = splitSentences(text);
  const targetCount = Math.ceil(sentences.length * targetRatio);

  // Simple selection: take every Nth sentence plus first and last
  const step = Math.max(1, Math.floor(sentences.length / targetCount));
  const selected: string[] = [];

  // Always include first sentence (usually important context)
  if (sentences.length > 0) {
    selected.push(sentences[0]!);
  }

  // Take every Nth sentence
  for (let i = step; i < sentences.length - 1; i += step) {
    if (selected.length < targetCount - 1) {
      selected.push(sentences[i]!);
    }
  }

  // Always include last sentence if different
  if (sentences.length > 1) {
    selected.push(sentences[sentences.length - 1]!);
  }

  return selected.join(' ');
}
