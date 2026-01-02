/**
 * @module hooks/usePromptOptimizer
 * React hook for cache-optimized prompt building
 */

import { useState, useCallback, useMemo } from 'react';
import {
  buildCacheAlignedPrompt,
  analyzeCachePotential,
  toProviderFormat,
  createSystemSegment,
  createContextSegment,
  createToolsSegment,
  createHistorySegment,
  createUserSegment,
  estimateTokens,
  type CacheOptimizedPrompt,
  type CacheAnalysis,
  type ProviderRequest,
  type PromptSegment,
  type ChatMessage,
  type Tool,
  type Provider,
} from '@token-optimizer/core';

/**
 * Options for usePromptOptimizer hook
 */
export interface UsePromptOptimizerOptions {
  /** Target AI provider */
  provider: Provider;
  /** Model name */
  model: string;
  /** System prompt (cached) */
  systemPrompt?: string;
  /** Available tools (cached) */
  tools?: Tool[];
  /** Context documents (cached) */
  contextDocuments?: string[];
  /** Maximum input tokens */
  maxInputTokens?: number;
}

/**
 * Return type for usePromptOptimizer hook
 */
export interface UsePromptOptimizerReturn {
  /** Build an optimized prompt */
  buildPrompt: (messages: ChatMessage[], userMessage: string) => CacheOptimizedPrompt;
  /** Convert to provider-specific format */
  toProviderRequest: (prompt: CacheOptimizedPrompt) => ProviderRequest;
  /** Analyze cache potential */
  analyzeCachePotential: (prompt: CacheOptimizedPrompt) => CacheAnalysis;
  /** Update system prompt */
  setSystemPrompt: (prompt: string) => void;
  /** Update tools */
  setTools: (tools: Tool[]) => void;
  /** Update context documents */
  setContext: (documents: string[]) => void;
  /** Current cacheable token count */
  cacheableTokens: number;
  /** Estimated cache hit rate */
  estimatedCacheHitRate: number;
}

/**
 * React hook for building cache-optimized prompts.
 * Structures prompts to maximize cache hits with AI providers.
 *
 * @param options - Prompt optimization options
 * @returns Prompt optimization utilities
 *
 * @example
 * ```tsx
 * function ChatComponent() {
 *   const {
 *     buildPrompt,
 *     toProviderRequest,
 *     cacheableTokens,
 *   } = usePromptOptimizer({
 *     provider: 'openai',
 *     model: 'gpt-4o',
 *     systemPrompt: 'You are a helpful assistant.',
 *     tools: myTools,
 *   });
 *
 *   const handleSend = async (userMessage: string) => {
 *     const optimizedPrompt = buildPrompt(messages, userMessage);
 *     const request = toProviderRequest(optimizedPrompt);
 *
 *     console.log(`Cacheable tokens: ${optimizedPrompt.cacheableTokens}`);
 *     // Make API request with optimized structure
 *   };
 * }
 * ```
 */
export function usePromptOptimizer(options: UsePromptOptimizerOptions): UsePromptOptimizerReturn {
  const {
    provider,
    model: _model,
    systemPrompt: initialSystemPrompt = '',
    tools: initialTools = [],
    contextDocuments: initialContext = [],
    maxInputTokens: _maxInputTokens,
  } = options;

  // State for configurable segments
  const [systemPrompt, setSystemPromptState] = useState(initialSystemPrompt);
  const [tools, setToolsState] = useState<Tool[]>(initialTools);
  const [contextDocuments, setContextDocumentsState] = useState<string[]>(initialContext);

  // Memoize static segments
  const staticSegments = useMemo((): PromptSegment[] => {
    const segments: PromptSegment[] = [];

    if (systemPrompt) {
      segments.push(createSystemSegment(systemPrompt, 'system-main'));
    }

    if (tools.length > 0) {
      segments.push(createToolsSegment(tools, 'tools-main'));
    }

    if (contextDocuments.length > 0) {
      const combinedContext = contextDocuments.join('\n\n---\n\n');
      segments.push(createContextSegment(combinedContext, 'context-main'));
    }

    return segments;
  }, [systemPrompt, tools, contextDocuments]);

  // Calculate cacheable tokens from static segments
  const cacheableTokens = useMemo(() => {
    return staticSegments.reduce((sum, s) => sum + (s.tokens ?? estimateTokens(s.content)), 0);
  }, [staticSegments]);

  // Build optimized prompt
  const buildPromptFn = useCallback(
    (messages: ChatMessage[], userMessage: string): CacheOptimizedPrompt => {
      const segments: PromptSegment[] = [...staticSegments];

      // Add conversation history (not cacheable)
      if (messages.length > 0) {
        segments.push(createHistorySegment(messages, 'history'));
      }

      // Add user message (never cacheable)
      if (userMessage) {
        segments.push(createUserSegment(userMessage));
      }

      return buildCacheAlignedPrompt(segments, {
        provider,
        minCacheableTokens: 1024,
        maxCacheBreakpoints: provider === 'anthropic' ? 4 : 10,
      });
    },
    [staticSegments, provider]
  );

  // Convert to provider format
  const toProviderRequestFn = useCallback(
    (prompt: CacheOptimizedPrompt): ProviderRequest => {
      return toProviderFormat(prompt, provider, tools);
    },
    [provider, tools]
  );

  // Analyze cache potential
  const analyzeCachePotentialFn = useCallback(
    (prompt: CacheOptimizedPrompt): CacheAnalysis => {
      return analyzeCachePotential(prompt);
    },
    []
  );

  // Estimate cache hit rate based on static content ratio
  const estimatedCacheHitRate = useMemo(() => {
    if (cacheableTokens < 1024) return 0;
    // Assume 80% hit rate if we have substantial cacheable content
    return cacheableTokens >= 2048 ? 0.8 : 0.5;
  }, [cacheableTokens]);

  return {
    buildPrompt: buildPromptFn,
    toProviderRequest: toProviderRequestFn,
    analyzeCachePotential: analyzeCachePotentialFn,
    setSystemPrompt: setSystemPromptState,
    setTools: setToolsState,
    setContext: setContextDocumentsState,
    cacheableTokens,
    estimatedCacheHitRate,
  };
}
