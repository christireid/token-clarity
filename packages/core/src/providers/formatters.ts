/**
 * @module providers/formatters
 * Convert cache-optimized prompts to provider-specific formats
 */

import type { Provider, Tool } from '../types/index.js';
import type {
  CacheOptimizedPrompt,
  PromptSegment,
  OpenAIRequest,
  OpenAIMessage,
  AnthropicRequest,
  AnthropicMessage,
  AnthropicContentBlock,
  AnthropicSystemBlock,
  GoogleRequest,
  GoogleContent,
  ProviderRequest,
} from './types.js';

/**
 * Convert cache-optimized prompt to provider-specific format.
 *
 * @param prompt - Cache-optimized prompt
 * @param provider - Target provider
 * @param tools - Optional tools to include
 * @returns Provider-specific request format
 */
export function toProviderFormat(
  prompt: CacheOptimizedPrompt,
  provider: Provider,
  tools?: Tool[]
): ProviderRequest {
  switch (provider) {
    case 'openai':
      return toOpenAIFormat(prompt, tools);
    case 'anthropic':
      return toAnthropicFormat(prompt, tools);
    case 'google':
      return toGoogleFormat(prompt, tools);
    default:
      throw new Error(`Unknown provider: ${provider as string}`);
  }
}

/**
 * Convert to OpenAI format.
 * OpenAI caches automatically when prompt prefix ≥1024 tokens matches.
 */
export function toOpenAIFormat(
  prompt: CacheOptimizedPrompt,
  tools?: Tool[]
): OpenAIRequest {
  const messages: OpenAIMessage[] = [];
  let systemContent = '';

  for (const segment of prompt.segments) {
    switch (segment.type) {
      case 'system':
        // Accumulate system content
        systemContent += (systemContent ? '\n\n' : '') + segment.content;
        break;

      case 'user':
        messages.push({
          role: 'user',
          content: segment.content,
        });
        break;

      case 'history':
        // Parse history into alternating user/assistant messages
        messages.push({
          role: 'user',
          content: segment.content,
        });
        break;

      case 'context':
      case 'examples':
      case 'tools':
        // Add as user message with clear labeling
        messages.push({
          role: 'user',
          content: segment.content,
        });
        break;
    }
  }

  // Add system message at the start if we have system content
  if (systemContent) {
    messages.unshift({
      role: 'system',
      content: systemContent,
    });
  }

  const request: OpenAIRequest = { messages };

  if (tools && tools.length > 0) {
    request.tools = tools.map(t => ({
      type: 'function' as const,
      function: {
        name: t.function.name,
        description: t.function.description,
        parameters: t.function.parameters,
      },
    }));
  }

  return request;
}

/**
 * Convert to Anthropic format with cache_control markers.
 * Anthropic supports up to 4 cache breakpoints.
 */
export function toAnthropicFormat(
  prompt: CacheOptimizedPrompt,
  tools?: Tool[]
): AnthropicRequest {
  const messages: AnthropicMessage[] = [];
  const systemBlocks: AnthropicSystemBlock[] = [];

  let breakpointIndex = 0;
  const breakpointSet = new Set(prompt.cacheBreakpoints);

  for (let i = 0; i < prompt.segments.length; i++) {
    const segment = prompt.segments[i]!;
    const isBreakpoint = breakpointSet.has(i);

    switch (segment.type) {
      case 'system':
        // System goes into system parameter
        systemBlocks.push({
          type: 'text',
          text: segment.content,
          ...(isBreakpoint && { cache_control: { type: 'ephemeral' as const } }),
        });
        if (isBreakpoint) breakpointIndex++;
        break;

      case 'user':
        messages.push({
          role: 'user',
          content: createAnthropicContent(segment, isBreakpoint),
        });
        if (isBreakpoint) breakpointIndex++;
        break;

      case 'context':
      case 'examples':
      case 'tools':
      case 'history':
        // Add as user message with cache control
        messages.push({
          role: 'user',
          content: createAnthropicContent(segment, isBreakpoint),
        });
        if (isBreakpoint) breakpointIndex++;
        break;
    }
  }

  const request: AnthropicRequest = {
    messages,
    ...(systemBlocks.length > 0 && {
      system: systemBlocks.length === 1 && !systemBlocks[0]!.cache_control
        ? systemBlocks[0]!.text
        : systemBlocks,
    }),
  };

  if (tools && tools.length > 0) {
    request.tools = tools.map(t => ({
      name: t.function.name,
      description: t.function.description,
      input_schema: t.function.parameters ?? { type: 'object', properties: {} },
    }));
  }

  return request;
}

/**
 * Create Anthropic content block with optional cache control.
 */
function createAnthropicContent(
  segment: PromptSegment,
  addCacheControl: boolean
): AnthropicContentBlock[] {
  return [
    {
      type: 'text',
      text: segment.content,
      ...(addCacheControl && { cache_control: { type: 'ephemeral' as const } }),
    },
  ];
}

/**
 * Convert to Google (Gemini) format.
 * Google uses context caching differently - this provides basic format conversion.
 */
export function toGoogleFormat(
  prompt: CacheOptimizedPrompt,
  tools?: Tool[]
): GoogleRequest {
  const contents: GoogleContent[] = [];
  let systemContent = '';

  for (const segment of prompt.segments) {
    switch (segment.type) {
      case 'system':
        systemContent += (systemContent ? '\n\n' : '') + segment.content;
        break;

      case 'user':
        contents.push({
          role: 'user',
          parts: [{ text: segment.content }],
        });
        break;

      case 'context':
      case 'examples':
      case 'tools':
      case 'history':
        contents.push({
          role: 'user',
          parts: [{ text: segment.content }],
        });
        break;
    }
  }

  const request: GoogleRequest = { contents };

  if (systemContent) {
    request.systemInstruction = {
      parts: [{ text: systemContent }],
    };
  }

  if (tools && tools.length > 0) {
    request.tools = [
      {
        functionDeclarations: tools.map(t => ({
          name: t.function.name,
          description: t.function.description,
          parameters: t.function.parameters,
        })),
      },
    ];
  }

  return request;
}

/**
 * Extract messages from a provider request (reverse conversion).
 */
export function extractMessages(
  request: ProviderRequest,
  provider: Provider
): PromptSegment[] {
  switch (provider) {
    case 'openai':
      return extractOpenAIMessages(request as OpenAIRequest);
    case 'anthropic':
      return extractAnthropicMessages(request as AnthropicRequest);
    case 'google':
      return extractGoogleMessages(request as GoogleRequest);
    default:
      return [];
  }
}

function extractOpenAIMessages(request: OpenAIRequest): PromptSegment[] {
  return request.messages.map((msg, i) => ({
    id: `openai-${i}`,
    type: msg.role === 'system' ? 'system' : msg.role === 'user' ? 'user' : 'history',
    content: typeof msg.content === 'string'
      ? msg.content
      : msg.content.map(p => p.text ?? '').join(''),
    cacheable: msg.role === 'system',
    priority: msg.role === 'system' ? 'critical' : 'medium',
  }));
}

function extractAnthropicMessages(request: AnthropicRequest): PromptSegment[] {
  const segments: PromptSegment[] = [];

  if (request.system) {
    if (typeof request.system === 'string') {
      segments.push({
        id: 'anthropic-system',
        type: 'system',
        content: request.system,
        cacheable: true,
        priority: 'critical',
      });
    } else {
      request.system.forEach((block, i) => {
        segments.push({
          id: `anthropic-system-${i}`,
          type: 'system',
          content: block.text,
          cacheable: !!block.cache_control,
          priority: 'critical',
        });
      });
    }
  }

  request.messages.forEach((msg, i) => {
    const content = typeof msg.content === 'string'
      ? msg.content
      : msg.content.map(b => b.text ?? '').join('');

    segments.push({
      id: `anthropic-${i}`,
      type: msg.role === 'user' ? 'user' : 'history',
      content,
      cacheable: false,
      priority: 'medium',
    });
  });

  return segments;
}

function extractGoogleMessages(request: GoogleRequest): PromptSegment[] {
  const segments: PromptSegment[] = [];

  if (request.systemInstruction) {
    const text = request.systemInstruction.parts.map(p => p.text ?? '').join('');
    segments.push({
      id: 'google-system',
      type: 'system',
      content: text,
      cacheable: true,
      priority: 'critical',
    });
  }

  request.contents.forEach((content, i) => {
    const text = content.parts.map(p => p.text ?? '').join('');
    segments.push({
      id: `google-${i}`,
      type: content.role === 'user' ? 'user' : 'history',
      content: text,
      cacheable: false,
      priority: 'medium',
    });
  });

  return segments;
}
