/**
 * @module policy/prefix
 * Stable prefix generation for optimal caching
 */

import { estimateTokens } from '../tokenizers/estimation.js';
import type { StablePrefixOptions, StablePrefixResult } from './types.js';

/**
 * Minimum cache tokens by provider
 */
const MIN_CACHE_TOKENS: Record<string, number> = {
  openai: 1024,
  anthropic: 1024,
  google: 2048,
};

/**
 * Cache alignment boundaries by provider
 */
const CACHE_ALIGNMENTS: Record<string, number> = {
  openai: 128,
  anthropic: 256,
  google: 256,
};

/**
 * Create a stable prefix for caching optimization.
 * Places static content first with variable sections at the end.
 *
 * @param template - Template string with {{variable}} placeholders
 * @param options - Prefix options
 * @returns Stable prefix result
 *
 * @example
 * ```ts
 * const result = stablePrefix(
 *   `You are a helpful assistant.
 *    Current date: {{date}}
 *    User preferences: {{preferences}}`,
 *   {
 *     variables: { date: '2024-01-15', preferences: 'formal' },
 *     provider: 'anthropic',
 *   }
 * );
 *
 * console.log(result.prefix);
 * console.log(`Meets cache minimum: ${result.meetsCacheMinimum}`);
 * ```
 */
export function stablePrefix(
  template: string,
  options: StablePrefixOptions = {}
): StablePrefixResult {
  const { variables = {}, provider = 'openai' } = options;
  const minCacheTokens = options.minCacheTokens ?? MIN_CACHE_TOKENS[provider] ?? 1024;

  // Substitute variables
  let prefix = template;
  for (const [name, value] of Object.entries(variables)) {
    const pattern = new RegExp(`\\{\\{\\s*${escapeRegex(name)}\\s*\\}\\}`, 'g');
    prefix = prefix.replace(pattern, value);
  }

  // Remove any remaining unsubstituted variables
  prefix = prefix.replace(/\{\{[^}]+\}\}/g, '');

  const tokens = estimateTokens(prefix);
  const meetsCacheMinimum = tokens >= minCacheTokens;

  // Calculate suggested breakpoints for cache alignment
  const alignment = CACHE_ALIGNMENTS[provider] ?? 128;
  const suggestedBreakpoints = calculateBreakpoints(prefix, alignment);

  return {
    prefix,
    tokens,
    meetsCacheMinimum,
    suggestedBreakpoints,
  };
}

/**
 * Escape special regex characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Calculate token-aligned breakpoints in text
 */
function calculateBreakpoints(text: string, alignment: number): number[] {
  const breakpoints: number[] = [];
  const totalTokens = estimateTokens(text);
  const numBreakpoints = Math.floor(totalTokens / alignment);

  // Find natural break points (sentence/paragraph boundaries) near alignments
  const sentences = text.split(/(?<=[.!?])\s+/);
  let currentPosition = 0;
  let currentTokens = 0;
  let targetTokens = alignment;

  for (const sentence of sentences) {
    const sentenceTokens = estimateTokens(sentence);
    currentTokens += sentenceTokens;

    if (currentTokens >= targetTokens && breakpoints.length < numBreakpoints) {
      breakpoints.push(currentPosition + sentence.length);
      targetTokens += alignment;
    }

    currentPosition += sentence.length + 1; // +1 for space
  }

  return breakpoints;
}

/**
 * Create a multi-section stable prefix with cache boundaries.
 *
 * @param sections - Named sections with content
 * @param options - Prefix options
 * @returns Combined prefix with cache-aligned boundaries
 *
 * @example
 * ```ts
 * const result = multiSectionPrefix({
 *   systemPrompt: 'You are a helpful assistant.',
 *   capabilities: 'You can help with coding...',
 *   context: dynamicContext,
 * }, { provider: 'anthropic' });
 * ```
 */
export function multiSectionPrefix(
  sections: Record<string, string>,
  options: StablePrefixOptions = {}
): StablePrefixResult & { sectionBoundaries: Record<string, { start: number; end: number }> } {
  const { provider = 'openai' } = options;
  const minCacheTokens = options.minCacheTokens ?? MIN_CACHE_TOKENS[provider] ?? 1024;

  const sectionBoundaries: Record<string, { start: number; end: number }> = {};
  let currentPosition = 0;
  let combinedPrefix = '';

  for (const [name, content] of Object.entries(sections)) {
    const start = currentPosition;
    combinedPrefix += content;
    currentPosition = combinedPrefix.length;
    sectionBoundaries[name] = { start, end: currentPosition };

    // Add section separator
    if (content && !content.endsWith('\n')) {
      combinedPrefix += '\n\n';
      currentPosition += 2;
    }
  }

  const tokens = estimateTokens(combinedPrefix);
  const alignment = CACHE_ALIGNMENTS[provider] ?? 128;
  const suggestedBreakpoints = calculateBreakpoints(combinedPrefix, alignment);

  return {
    prefix: combinedPrefix.trim(),
    tokens,
    meetsCacheMinimum: tokens >= minCacheTokens,
    suggestedBreakpoints,
    sectionBoundaries,
  };
}

/**
 * Pad a prefix to meet minimum cache requirements.
 * Adds invisible/neutral content to reach cache threshold.
 *
 * @param prefix - Current prefix
 * @param options - Prefix options
 * @returns Padded prefix that meets cache minimum
 */
export function padToMinimum(
  prefix: string,
  options: StablePrefixOptions = {}
): StablePrefixResult {
  const { provider = 'openai' } = options;
  const minCacheTokens = options.minCacheTokens ?? MIN_CACHE_TOKENS[provider] ?? 1024;

  const currentTokens = estimateTokens(prefix);

  if (currentTokens >= minCacheTokens) {
    return stablePrefix(prefix, options);
  }

  // Add padding with context-appropriate content
  const tokensNeeded = minCacheTokens - currentTokens;
  const padding = generateContextPadding(tokensNeeded);

  const paddedPrefix = prefix + '\n\n' + padding;
  const alignment = CACHE_ALIGNMENTS[provider] ?? 128;
  const suggestedBreakpoints = calculateBreakpoints(paddedPrefix, alignment);

  return {
    prefix: paddedPrefix,
    tokens: estimateTokens(paddedPrefix),
    meetsCacheMinimum: true,
    suggestedBreakpoints,
  };
}

/**
 * Generate context-appropriate padding content
 */
function generateContextPadding(tokensNeeded: number): string {
  // Generate helpful context that won't affect behavior
  const paddingLines = [
    '<!-- Additional context for cache optimization -->',
    '<!-- This content is included to meet caching thresholds -->',
    '',
    'Reference Guidelines:',
    '- Maintain consistency across responses',
    '- Provide accurate and helpful information',
    '- Follow safety guidelines',
    '- Respect user privacy',
    '',
    'Quality Standards:',
    '- Be clear and concise',
    '- Provide examples when helpful',
    '- Acknowledge limitations',
    '- Offer to clarify if needed',
  ];

  let padding = '';
  let currentTokens = 0;

  // Add lines until we have enough tokens
  for (const line of paddingLines) {
    if (currentTokens >= tokensNeeded) break;
    padding += line + '\n';
    currentTokens = estimateTokens(padding);
  }

  // If we still need more, repeat the quality standards
  while (currentTokens < tokensNeeded) {
    const filler = `- Additional guideline ${Math.floor(Math.random() * 1000)}\n`;
    padding += filler;
    currentTokens = estimateTokens(padding);
  }

  return padding;
}

/**
 * Analyze a prefix for cache optimization opportunities.
 *
 * @param prefix - Prefix to analyze
 * @param options - Analysis options
 * @returns Analysis with recommendations
 */
export function analyzePrefix(
  prefix: string,
  options: StablePrefixOptions = {}
): {
  tokens: number;
  meetsCacheMinimum: boolean;
  hasVariables: boolean;
  variablePositions: Array<{ name: string; position: number }>;
  recommendations: string[];
} {
  const { provider = 'openai' } = options;
  const minCacheTokens = options.minCacheTokens ?? MIN_CACHE_TOKENS[provider] ?? 1024;

  const tokens = estimateTokens(prefix);
  const meetsCacheMinimum = tokens >= minCacheTokens;

  // Find variable patterns
  const variablePattern = /\{\{([^}]+)\}\}/g;
  const variablePositions: Array<{ name: string; position: number }> = [];
  let match;

  while ((match = variablePattern.exec(prefix)) !== null) {
    variablePositions.push({
      name: match[1]!.trim(),
      position: match.index,
    });
  }

  const hasVariables = variablePositions.length > 0;
  const recommendations: string[] = [];

  // Generate recommendations
  if (!meetsCacheMinimum) {
    recommendations.push(
      `Add ${minCacheTokens - tokens} more tokens to meet ${provider} cache minimum (${minCacheTokens} tokens)`
    );
  }

  if (hasVariables && variablePositions.some(v => v.position < prefix.length * 0.5)) {
    recommendations.push(
      'Move dynamic variables to the end of the prefix for better cache hit rates'
    );
  }

  if (prefix.length > 0 && prefix.length < 500) {
    recommendations.push(
      'Consider combining with other static content to improve cache efficiency'
    );
  }

  return {
    tokens,
    meetsCacheMinimum,
    hasVariables,
    variablePositions,
    recommendations,
  };
}
