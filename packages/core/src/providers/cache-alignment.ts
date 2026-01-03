/**
 * @module providers/cache-alignment
 * Build cache-optimized prompts for different AI providers
 */

import type { ChatMessage } from '../types/index.js';
import type {
  PromptSegment,
  CacheOptimizedPrompt,
  CacheAlignmentOptions,
  CacheAnalysis,
} from './types.js';
import { estimateTokens } from '../tokenizers/estimation.js';

/**
 * Default minimum tokens for caching (OpenAI and Anthropic both use ~1024)
 */
const DEFAULT_MIN_CACHEABLE_TOKENS = 1024;

/**
 * Priority order for sorting segments (lower = earlier in prompt)
 */
const TYPE_ORDER: Record<PromptSegment['type'], number> = {
  system: 0,
  tools: 1,
  context: 2,
  examples: 3,
  history: 4,
  user: 5,
};

/**
 * Sort segments for optimal cache alignment.
 * Static, cacheable content comes first, dynamic content last.
 */
function sortSegments(segments: PromptSegment[]): PromptSegment[] {
  return [...segments].sort((a, b) => {
    // Cacheable content first
    if (a.cacheable !== b.cacheable) {
      return a.cacheable ? -1 : 1;
    }
    // Then by type order
    return TYPE_ORDER[a.type] - TYPE_ORDER[b.type];
  });
}

/**
 * Convert segments to standard chat messages.
 */
function segmentsToMessages(segments: PromptSegment[]): ChatMessage[] {
  const messages: ChatMessage[] = [];

  for (const segment of segments) {
    if (segment.type === 'system') {
      messages.push({ role: 'system', content: segment.content });
    } else if (segment.type === 'user') {
      messages.push({ role: 'user', content: segment.content });
    } else if (segment.type === 'history') {
      // History already contains role information, but we simplify here
      messages.push({ role: 'user', content: segment.content });
    } else {
      // Context, examples, tools go into user messages
      messages.push({ role: 'user', content: segment.content });
    }
  }

  return messages;
}

/**
 * Calculate cache breakpoints for Anthropic.
 * Breakpoints mark where cache_control should be applied.
 */
function calculateBreakpoints(
  segments: PromptSegment[],
  maxBreakpoints: number,
  minTokens: number
): number[] {
  const breakpoints: number[] = [];
  let accumulatedTokens = 0;

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i]!;
    accumulatedTokens += segment.tokens ?? estimateTokens(segment.content);

    // Add breakpoint after cacheable segments with enough tokens
    if (
      segment.cacheable &&
      accumulatedTokens >= minTokens &&
      breakpoints.length < maxBreakpoints
    ) {
      breakpoints.push(i);
      accumulatedTokens = 0; // Reset for next cacheable section
    }
  }

  return breakpoints;
}

/**
 * Estimate cache hit rate based on segment structure.
 */
function estimateCacheHitRate(segments: PromptSegment[]): number {
  const cacheableTokens = segments
    .filter(s => s.cacheable)
    .reduce((sum, s) => sum + (s.tokens ?? 0), 0);

  const totalTokens = segments.reduce((sum, s) => sum + (s.tokens ?? 0), 0);

  if (totalTokens === 0) return 0;

  // Base rate on cacheable ratio
  const cacheRatio = cacheableTokens / totalTokens;

  // Adjust for segment order (cacheable at start = better)
  const orderedCorrectly = segments
    .slice(0, segments.filter(s => s.cacheable).length)
    .every(s => s.cacheable);

  return orderedCorrectly ? cacheRatio * 0.95 : cacheRatio * 0.7;
}

/**
 * Build a cache-optimized prompt from segments.
 *
 * @param segments - Prompt segments to optimize
 * @param options - Cache alignment options
 * @returns Cache-optimized prompt structure
 *
 * @example
 * ```ts
 * const prompt = buildCacheAlignedPrompt([
 *   createSystemSegment('You are a helpful assistant.'),
 *   createContextSegment(documentContent),
 *   createUserSegment('Summarize this document.'),
 * ], { provider: 'openai' });
 * ```
 */
export function buildCacheAlignedPrompt(
  segments: PromptSegment[],
  options: CacheAlignmentOptions
): CacheOptimizedPrompt {
  const {
    provider,
    minCacheableTokens = DEFAULT_MIN_CACHEABLE_TOKENS,
    maxCacheBreakpoints = provider === 'anthropic' ? 4 : 10,
    mergeSmallSegments = true,
    countTokens = estimateTokens,
  } = options;

  // Ensure all segments have token counts
  const segmentsWithTokens = segments.map(s => ({
    ...s,
    tokens: s.tokens ?? countTokens(s.content),
  }));

  // Optionally merge small adjacent cacheable segments
  let processedSegments: PromptSegment[] = segmentsWithTokens;
  if (mergeSmallSegments) {
    processedSegments = mergeSmallCacheableSegments(
      segmentsWithTokens,
      minCacheableTokens
    );
  }

  // Sort for optimal cache alignment
  const orderedSegments = sortSegments(processedSegments);

  // Calculate breakpoints
  const cacheBreakpoints = calculateBreakpoints(
    orderedSegments,
    maxCacheBreakpoints,
    minCacheableTokens
  );

  // Calculate totals
  const cacheableTokens = orderedSegments
    .filter(s => s.cacheable)
    .reduce((sum, s) => sum + (s.tokens ?? 0), 0);

  const totalTokens = orderedSegments.reduce(
    (sum, s) => sum + (s.tokens ?? 0),
    0
  );

  return {
    segments: orderedSegments,
    messages: segmentsToMessages(orderedSegments),
    cacheBreakpoints,
    estimatedCacheHitRate: estimateCacheHitRate(orderedSegments),
    cacheableTokens,
    totalTokens,
  };
}

/**
 * Merge small adjacent cacheable segments to meet minimum token threshold.
 */
function mergeSmallCacheableSegments(
  segments: PromptSegment[],
  minTokens: number
): PromptSegment[] {
  const result: PromptSegment[] = [];
  let pendingMerge: PromptSegment[] = [];
  let pendingTokens = 0;

  for (const segment of segments) {
    if (!segment.cacheable) {
      // Flush pending cacheable segments
      if (pendingMerge.length > 0) {
        if (pendingMerge.length === 1) {
          result.push(pendingMerge[0]!);
        } else {
          result.push(mergePendingSegments(pendingMerge, pendingTokens));
        }
        pendingMerge = [];
        pendingTokens = 0;
      }
      result.push(segment);
      continue;
    }

    const tokens = segment.tokens ?? 0;

    if (tokens >= minTokens) {
      // Flush pending and add this segment directly
      if (pendingMerge.length > 0) {
        if (pendingMerge.length === 1) {
          result.push(pendingMerge[0]!);
        } else {
          result.push(mergePendingSegments(pendingMerge, pendingTokens));
        }
        pendingMerge = [];
        pendingTokens = 0;
      }
      result.push(segment);
    } else {
      // Add to pending merge
      pendingMerge.push(segment);
      pendingTokens += tokens;

      // If merged size meets threshold, flush
      if (pendingTokens >= minTokens) {
        result.push(mergePendingSegments(pendingMerge, pendingTokens));
        pendingMerge = [];
        pendingTokens = 0;
      }
    }
  }

  // Flush remaining pending segments
  if (pendingMerge.length > 0) {
    if (pendingMerge.length === 1) {
      result.push(pendingMerge[0]!);
    } else {
      result.push(mergePendingSegments(pendingMerge, pendingTokens));
    }
  }

  return result;
}

/**
 * Merge pending segments into one.
 */
function mergePendingSegments(
  segments: PromptSegment[],
  totalTokens: number
): PromptSegment {
  const content = segments.map(s => s.content).join('\n\n');
  const types = [...new Set(segments.map(s => s.type))];
  // Choose highest priority type (lowest TYPE_ORDER value)
  const type = types.length === 1
    ? types[0]!
    : types.reduce((best, t) => (TYPE_ORDER[t] < TYPE_ORDER[best] ? t : best));

  // Determine highest priority from segments
  const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  const priority = segments.reduce((best, s) =>
    priorityOrder[s.priority] < priorityOrder[best] ? s.priority : best,
    'low' as PromptSegment['priority']
  );

  return {
    id: `merged-${segments.map(s => s.id).join('-')}`,
    type,
    content,
    cacheable: true,
    priority,
    tokens: totalTokens,
  };
}

/**
 * Analyze cache potential for a prompt.
 *
 * @param prompt - Cache-optimized prompt to analyze
 * @returns Cache analysis with recommendations
 */
export function analyzeCachePotential(prompt: CacheOptimizedPrompt): CacheAnalysis {
  const { cacheableTokens, totalTokens, segments, estimatedCacheHitRate } = prompt;

  const cacheRatio = totalTokens > 0 ? cacheableTokens / totalTokens : 0;
  const recommendations: string[] = [];

  // Check for optimization opportunities
  const nonCacheableBeforeCacheable = segments.some((s, i) => {
    if (!s.cacheable) {
      return segments.slice(i + 1).some(later => later.cacheable);
    }
    return false;
  });

  if (nonCacheableBeforeCacheable) {
    recommendations.push(
      'Move cacheable content (system prompts, context) before dynamic content for better cache hits.'
    );
  }

  if (cacheRatio < 0.5) {
    recommendations.push(
      'Less than 50% of your prompt is cacheable. Consider adding more static context or examples.'
    );
  }

  const smallCacheableSegments = segments.filter(
    s => s.cacheable && (s.tokens ?? 0) < 1024
  );
  if (smallCacheableSegments.length > 2) {
    recommendations.push(
      'Multiple small cacheable segments detected. Merge them to improve cache efficiency.'
    );
  }

  if (segments.filter(s => s.type === 'system').length > 1) {
    recommendations.push(
      'Multiple system segments detected. Consolidate into a single system prompt.'
    );
  }

  // Estimate savings (assuming provider cache discounts ~50-90%)
  const estimatedSavings = cacheRatio * estimatedCacheHitRate * 0.7 * 100;

  return {
    cacheableTokens,
    totalTokens,
    cacheRatio,
    estimatedSavings,
    recommendations,
  };
}
