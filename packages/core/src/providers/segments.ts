/**
 * @module providers/segments
 * Prompt segment builders for cache optimization
 */

import type { ChatMessage, Tool } from '../types/index.js';
import type { PromptSegment } from './types.js';
import { estimateTokens } from '../tokenizers/estimation.js';

let segmentCounter = 0;

/**
 * Generate a unique segment ID
 */
function generateId(prefix: string): string {
  return `${prefix}-${++segmentCounter}`;
}

/**
 * Create a system prompt segment.
 * System prompts are highly cacheable as they rarely change.
 *
 * @param content - System prompt content
 * @param id - Optional custom ID
 * @returns System segment
 */
export function createSystemSegment(content: string, id?: string): PromptSegment {
  return {
    id: id ?? generateId('system'),
    type: 'system',
    content,
    cacheable: true,
    priority: 'critical',
    tokens: estimateTokens(content),
  };
}

/**
 * Create a context segment for documents, data, or reference material.
 * Context is typically cacheable as it stays consistent within a session.
 *
 * @param content - Context content
 * @param id - Optional custom ID
 * @returns Context segment
 */
export function createContextSegment(content: string, id?: string): PromptSegment {
  return {
    id: id ?? generateId('context'),
    type: 'context',
    content,
    cacheable: true,
    priority: 'high',
    tokens: estimateTokens(content),
  };
}

/**
 * Create an examples segment for few-shot learning.
 * Examples are cacheable and should come after system/context.
 *
 * @param examples - Array of example strings or formatted examples
 * @param id - Optional custom ID
 * @returns Examples segment
 */
export function createExamplesSegment(
  examples: string[] | string,
  id?: string
): PromptSegment {
  const content = Array.isArray(examples) ? examples.join('\n\n') : examples;
  return {
    id: id ?? generateId('examples'),
    type: 'examples',
    content,
    cacheable: true,
    priority: 'high',
    tokens: estimateTokens(content),
  };
}

/**
 * Create a tools segment from tool definitions.
 * Tool definitions are cacheable and should be placed early.
 *
 * @param tools - Array of tool definitions
 * @param id - Optional custom ID
 * @returns Tools segment
 */
export function createToolsSegment(tools: Tool[], id?: string): PromptSegment {
  const content = JSON.stringify(tools, null, 2);
  return {
    id: id ?? generateId('tools'),
    type: 'tools',
    content,
    cacheable: true,
    priority: 'high',
    tokens: estimateTokens(content),
  };
}

/**
 * Create a history segment from conversation messages.
 * History has lower cache priority as it changes frequently.
 *
 * @param messages - Conversation history
 * @param id - Optional custom ID
 * @returns History segment
 */
export function createHistorySegment(
  messages: ChatMessage[],
  id?: string
): PromptSegment {
  const content = messages
    .map(m => `${m.role}: ${m.content}`)
    .join('\n\n');
  return {
    id: id ?? generateId('history'),
    type: 'history',
    content,
    cacheable: false, // History changes with each message
    priority: 'medium',
    tokens: estimateTokens(content),
  };
}

/**
 * Create a user message segment.
 * User messages are not cacheable as they're unique per request.
 *
 * @param content - User message content
 * @returns User segment
 */
export function createUserSegment(content: string): PromptSegment {
  return {
    id: generateId('user'),
    type: 'user',
    content,
    cacheable: false,
    priority: 'low',
    tokens: estimateTokens(content),
  };
}

/**
 * Create a custom segment with explicit configuration.
 *
 * @param config - Segment configuration
 * @returns Custom segment
 */
export function createCustomSegment(config: {
  type: PromptSegment['type'];
  content: string;
  cacheable: boolean;
  priority: PromptSegment['priority'];
  id?: string;
}): PromptSegment {
  return {
    id: config.id ?? generateId(config.type),
    type: config.type,
    content: config.content,
    cacheable: config.cacheable,
    priority: config.priority,
    tokens: estimateTokens(config.content),
  };
}

/**
 * Merge multiple segments into one.
 * Useful for combining small cacheable segments.
 *
 * @param segments - Segments to merge
 * @param type - Type for merged segment
 * @param id - Optional ID for merged segment
 * @returns Merged segment
 */
export function mergeSegments(
  segments: PromptSegment[],
  type: PromptSegment['type'] = 'context',
  id?: string
): PromptSegment {
  const content = segments.map(s => s.content).join('\n\n');
  const allCacheable = segments.every(s => s.cacheable);
  const highestPriority = segments.reduce((highest, s) => {
    const order = { critical: 0, high: 1, medium: 2, low: 3 };
    return order[s.priority] < order[highest] ? s.priority : highest;
  }, 'low' as PromptSegment['priority']);

  return {
    id: id ?? generateId('merged'),
    type,
    content,
    cacheable: allCacheable,
    priority: highestPriority,
    tokens: segments.reduce((sum, s) => sum + (s.tokens ?? 0), 0),
  };
}

/**
 * Reset segment counter (useful for testing)
 */
export function resetSegmentCounter(): void {
  segmentCounter = 0;
}
