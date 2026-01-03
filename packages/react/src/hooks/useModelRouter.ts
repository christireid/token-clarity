/**
 * @module hooks/useModelRouter
 * Smart model routing for cost optimization
 */

import { useState, useCallback, useMemo } from 'react';
import {
  estimateTokens,
  estimateCost,
  type CostEstimate,
} from '@token-optimizer/core';

/**
 * Extended provider type including all supported providers
 */
export type ModelProvider = 'openai' | 'anthropic' | 'google' | 'azure' | 'bedrock' | 'mistral' | 'cohere' | 'groq';

/**
 * Task complexity levels
 */
export type TaskComplexity = 'simple' | 'moderate' | 'complex' | 'expert';

/**
 * Model tier for routing
 */
export interface ModelTier {
  /** Model identifier */
  model: string;
  /** Provider name */
  provider: ModelProvider;
  /** Maximum complexity this model handles well */
  maxComplexity: TaskComplexity;
  /** Cost per 1K tokens (for sorting) */
  costPer1k: number;
  /** Quality score (0-100) */
  qualityScore: number;
  /** Speed score (0-100, higher = faster) */
  speedScore: number;
  /** Context window size */
  contextWindow: number;
}

/**
 * Default model tiers
 */
export const defaultModelTiers: ModelTier[] = [
  // OpenAI
  {
    model: 'gpt-4o',
    provider: 'openai',
    maxComplexity: 'expert',
    costPer1k: 0.0025,
    qualityScore: 95,
    speedScore: 80,
    contextWindow: 128000,
  },
  {
    model: 'gpt-4o-mini',
    provider: 'openai',
    maxComplexity: 'moderate',
    costPer1k: 0.00015,
    qualityScore: 75,
    speedScore: 95,
    contextWindow: 128000,
  },
  // Anthropic
  {
    model: 'claude-3-5-sonnet',
    provider: 'anthropic',
    maxComplexity: 'expert',
    costPer1k: 0.003,
    qualityScore: 98,
    speedScore: 75,
    contextWindow: 200000,
  },
  {
    model: 'claude-3-haiku',
    provider: 'anthropic',
    maxComplexity: 'simple',
    costPer1k: 0.00025,
    qualityScore: 70,
    speedScore: 98,
    contextWindow: 200000,
  },
  // Google
  {
    model: 'gemini-1.5-pro',
    provider: 'google',
    maxComplexity: 'expert',
    costPer1k: 0.00125,
    qualityScore: 92,
    speedScore: 85,
    contextWindow: 1000000,
  },
  {
    model: 'gemini-1.5-flash',
    provider: 'google',
    maxComplexity: 'moderate',
    costPer1k: 0.000075,
    qualityScore: 78,
    speedScore: 95,
    contextWindow: 1000000,
  },
  // Groq (fast inference)
  {
    model: 'llama-3.1-70b-versatile',
    provider: 'groq',
    maxComplexity: 'moderate',
    costPer1k: 0.00059,
    qualityScore: 80,
    speedScore: 99,
    contextWindow: 131072,
  },
  {
    model: 'llama-3.1-8b-instant',
    provider: 'groq',
    maxComplexity: 'simple',
    costPer1k: 0.00005,
    qualityScore: 60,
    speedScore: 100,
    contextWindow: 131072,
  },
];

/**
 * Routing strategy
 */
export type RoutingStrategy = 'cost' | 'quality' | 'speed' | 'balanced';

/**
 * Complexity hints from text analysis
 */
export interface ComplexityHints {
  /** Contains code */
  hasCode: boolean;
  /** Requires reasoning */
  needsReasoning: boolean;
  /** Requires specialized knowledge */
  needsExpertise: boolean;
  /** Is a simple query */
  isSimpleQuery: boolean;
  /** Estimated complexity */
  estimatedComplexity: TaskComplexity;
}

/**
 * Model routing result
 */
export interface RoutingResult {
  /** Recommended model */
  model: string;
  /** Provider */
  provider: ModelProvider;
  /** Why this model was chosen */
  reason: string;
  /** Estimated cost */
  estimatedCost: CostEstimate | null;
  /** Alternative models */
  alternatives: Array<{
    model: string;
    provider: ModelProvider;
    estimatedCost: CostEstimate | null;
    tradeoff: string;
  }>;
  /** Detected complexity */
  complexity: TaskComplexity;
}

/**
 * Options for useModelRouter
 */
export interface UseModelRouterOptions {
  /** Available model tiers (defaults to all) */
  modelTiers?: ModelTier[];
  /** Default routing strategy */
  defaultStrategy?: RoutingStrategy;
  /** Allowed providers (empty = all) */
  allowedProviders?: ModelProvider[];
  /** Maximum cost per request */
  maxCostPerRequest?: number;
  /** Minimum quality score required */
  minQualityScore?: number;
  /** Custom complexity detector */
  customComplexityDetector?: (text: string) => TaskComplexity;
}

/**
 * Return type for useModelRouter
 */
export interface UseModelRouterReturn {
  /** Current routing strategy */
  strategy: RoutingStrategy;
  /** Set routing strategy */
  setStrategy: (strategy: RoutingStrategy) => void;
  /** Route a request to optimal model */
  route: (text: string, hints?: Partial<ComplexityHints>) => RoutingResult;
  /** Analyze text complexity */
  analyzeComplexity: (text: string) => ComplexityHints;
  /** Get available models for a complexity level */
  getModelsForComplexity: (complexity: TaskComplexity) => ModelTier[];
  /** Available model tiers */
  modelTiers: ModelTier[];
}

/**
 * Complexity level ordering
 */
const complexityOrder: Record<TaskComplexity, number> = {
  simple: 1,
  moderate: 2,
  complex: 3,
  expert: 4,
};

/**
 * Patterns for complexity detection
 */
const complexityPatterns = {
  code: /```|\bfunction\b|\bclass\b|\bdef\b|\bconst\b|\blet\b|\bvar\b|=>|import\s+|export\s+/i,
  reasoning: /\bwhy\b|\bhow\b|\bexplain\b|\banalyze\b|\bcompare\b|\bevaluate\b|\bcritique\b/i,
  expertise: /\btechnical\b|\barchitect\b|\bdesign\b|\bimplement\b|\boptimize\b|\bdebug\b|\bsecurity\b/i,
  simple: /^(hi|hello|hey|thanks|ok|yes|no|sure|what is|who is|when is|where is)\b/i,
};

/**
 * useModelRouter - Smart model selection for cost optimization
 *
 * @param options - Configuration options
 * @returns Model routing utilities
 *
 * @example
 * ```tsx
 * function ChatInput() {
 *   const { route, strategy, setStrategy } = useModelRouter({
 *     defaultStrategy: 'balanced',
 *     maxCostPerRequest: 0.05,
 *   });
 *
 *   const handleSend = (message: string) => {
 *     const { model, provider, reason } = route(message);
 *     console.log(`Using ${model} because: ${reason}`);
 *     // Send to API with selected model
 *   };
 * }
 * ```
 */
export function useModelRouter(options: UseModelRouterOptions = {}): UseModelRouterReturn {
  const {
    modelTiers = defaultModelTiers,
    defaultStrategy = 'balanced',
    allowedProviders = [],
    maxCostPerRequest,
    minQualityScore = 0,
    customComplexityDetector,
  } = options;

  const [strategy, setStrategy] = useState<RoutingStrategy>(defaultStrategy);

  // Filter available models
  const availableModels = useMemo(() => {
    let models = modelTiers.filter((m) => m.qualityScore >= minQualityScore);
    if (allowedProviders.length > 0) {
      models = models.filter((m) => allowedProviders.includes(m.provider));
    }
    return models;
  }, [modelTiers, allowedProviders, minQualityScore]);

  // Analyze text complexity
  const analyzeComplexity = useCallback(
    (text: string): ComplexityHints => {
      if (customComplexityDetector) {
        return {
          hasCode: false,
          needsReasoning: false,
          needsExpertise: false,
          isSimpleQuery: false,
          estimatedComplexity: customComplexityDetector(text),
        };
      }

      const hasCode = complexityPatterns.code.test(text);
      const needsReasoning = complexityPatterns.reasoning.test(text);
      const needsExpertise = complexityPatterns.expertise.test(text);
      const isSimpleQuery = complexityPatterns.simple.test(text);

      // Estimate tokens - longer prompts often indicate complexity
      const tokenCount = estimateTokens(text);

      let estimatedComplexity: TaskComplexity = 'simple';

      if (needsExpertise || (hasCode && needsReasoning)) {
        estimatedComplexity = 'expert';
      } else if (hasCode || needsReasoning || tokenCount > 2000) {
        estimatedComplexity = 'complex';
      } else if (!isSimpleQuery && tokenCount > 500) {
        estimatedComplexity = 'moderate';
      }

      return {
        hasCode,
        needsReasoning,
        needsExpertise,
        isSimpleQuery,
        estimatedComplexity,
      };
    },
    [customComplexityDetector]
  );

  // Get models suitable for a complexity level
  const getModelsForComplexity = useCallback(
    (complexity: TaskComplexity): ModelTier[] => {
      const requiredLevel = complexityOrder[complexity];
      return availableModels.filter(
        (m) => complexityOrder[m.maxComplexity] >= requiredLevel
      );
    },
    [availableModels]
  );

  // Route a request to optimal model
  const route = useCallback(
    (text: string, hints?: Partial<ComplexityHints>): RoutingResult => {
      const analyzed = analyzeComplexity(text);
      const complexity = hints?.estimatedComplexity ?? analyzed.estimatedComplexity;

      // Get suitable models
      let suitableModels = getModelsForComplexity(complexity);

      // Filter by max cost if specified
      if (maxCostPerRequest !== undefined) {
        const tokenCount = estimateTokens(text);
        suitableModels = suitableModels.filter((m) => {
          try {
            const cost = estimateCost(m.model, tokenCount, 500);
            return cost.totalCost <= maxCostPerRequest;
          } catch {
            return false;
          }
        });
      }

      if (suitableModels.length === 0) {
        // Fallback to cheapest available
        suitableModels = [...availableModels].sort((a, b) => a.costPer1k - b.costPer1k);
      }

      // Sort based on strategy
      const sortedModels = [...suitableModels].sort((a, b) => {
        switch (strategy) {
          case 'cost':
            return a.costPer1k - b.costPer1k;
          case 'quality':
            return b.qualityScore - a.qualityScore;
          case 'speed':
            return b.speedScore - a.speedScore;
          case 'balanced':
          default:
            // Weighted score: 40% quality, 30% speed, 30% cost (inverted)
            const scoreA = a.qualityScore * 0.4 + a.speedScore * 0.3 + (100 - a.costPer1k * 1000) * 0.3;
            const scoreB = b.qualityScore * 0.4 + b.speedScore * 0.3 + (100 - b.costPer1k * 1000) * 0.3;
            return scoreB - scoreA;
        }
      });

      const selected = sortedModels[0]!;
      const tokenCount = estimateTokens(text);

      let estimatedCost: CostEstimate | null = null;
      try {
        estimatedCost = estimateCost(selected.model, tokenCount, 500);
      } catch {
        // Ignore cost estimation errors
      }

      // Generate reason
      let reason: string;
      switch (strategy) {
        case 'cost':
          reason = `Lowest cost option for ${complexity} task`;
          break;
        case 'quality':
          reason = `Highest quality option for ${complexity} task`;
          break;
        case 'speed':
          reason = `Fastest option for ${complexity} task`;
          break;
        case 'balanced':
        default:
          reason = `Best balance of quality, speed, and cost for ${complexity} task`;
      }

      // Generate alternatives
      const alternatives = sortedModels.slice(1, 4).map((m) => {
        let altCost: CostEstimate | null = null;
        try {
          altCost = estimateCost(m.model, tokenCount, 500);
        } catch {
          // Ignore
        }

        let tradeoff: string;
        if (m.costPer1k < selected.costPer1k) {
          tradeoff = 'Cheaper but lower quality';
        } else if (m.qualityScore > selected.qualityScore) {
          tradeoff = 'Higher quality but more expensive';
        } else if (m.speedScore > selected.speedScore) {
          tradeoff = 'Faster but different quality/cost';
        } else {
          tradeoff = 'Alternative option';
        }

        return {
          model: m.model,
          provider: m.provider,
          estimatedCost: altCost,
          tradeoff,
        };
      });

      return {
        model: selected.model,
        provider: selected.provider,
        reason,
        estimatedCost,
        alternatives,
        complexity,
      };
    },
    [strategy, analyzeComplexity, getModelsForComplexity, availableModels, maxCostPerRequest]
  );

  return {
    strategy,
    setStrategy,
    route,
    analyzeComplexity,
    getModelsForComplexity,
    modelTiers: availableModels,
  };
}
