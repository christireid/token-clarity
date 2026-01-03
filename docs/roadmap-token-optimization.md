# Token Optimizer Roadmap

> Path to becoming the provider-agnostic, best-in-market React token optimization library.

## Vision

**@token-optimizer** will be the essential toolkit for any React application using AI/LLM providers, offering:
- Drop-in integration with zero configuration
- Provider-agnostic token counting, cost estimation, and budget management
- Intelligent caching that "just works"
- Developer-friendly debugging tools

## Milestones

### v0.2.0 - Provider Foundation (Current)
**Status**: In Progress

#### P0 - Critical
- [ ] Fix 3 failing tests (budget trim, compression, provider ordering)
- [ ] Create `ProviderAdapter` interface
- [ ] Implement core adapters:
  - [ ] OpenAI (enhanced)
  - [ ] Anthropic (enhanced)
  - [ ] Google Gemini (enhanced)
  - [ ] Azure OpenAI (new)
  - [ ] AWS Bedrock (new)
- [ ] Create telemetry event system
- [ ] Enhance `BudgetManager` with per-turn/session limits

#### P1 - High
- [ ] `TokenPolicy` pure functions
- [ ] `TokenDevtoolsPanel` component
- [ ] CI benchmarks for token/cost regression

### v0.3.0 - Extended Providers
**Status**: Planned

- [ ] Mistral adapter
- [ ] Cohere adapter
- [ ] Groq adapter
- [ ] OpenAI-compatible generic adapter
- [ ] Streaming token tracking
- [ ] Enhanced compression algorithms

### v0.4.0 - Developer Experience
**Status**: Planned

- [ ] Interactive documentation site
- [ ] Example applications
- [ ] VS Code extension (optional)
- [ ] Performance benchmarks dashboard

### v1.0.0 - Production Ready
**Status**: Planned

- [ ] 100% test coverage
- [ ] Full documentation
- [ ] Security audit
- [ ] Bundle size optimization
- [ ] Breaking change freeze

---

## Architecture

### Core Package (`@token-optimizer/core`)

```
packages/core/
├── adapters/           # NEW: Provider adapters
│   ├── types.ts        # ProviderAdapter interface
│   ├── openai.ts
│   ├── anthropic.ts
│   ├── google.ts
│   ├── azure.ts
│   ├── bedrock.ts
│   └── index.ts
├── policies/           # NEW: Token policies
│   ├── types.ts
│   ├── trim.ts
│   ├── compress.ts
│   ├── template.ts
│   └── index.ts
├── telemetry/          # NEW: Observability
│   ├── types.ts
│   ├── events.ts
│   ├── otel.ts
│   └── index.ts
├── tokenizers/         # EXISTING: Enhanced
├── budget/             # EXISTING: Enhanced
├── cost/               # EXISTING
├── compression/        # EXISTING: Enhanced
└── providers/          # EXISTING → migrate to adapters
```

### React Package (`@token-optimizer/react`)

```
packages/react/
├── hooks/
│   ├── useTokenBudget.ts       # EXISTING
│   ├── useCostTracker.ts       # EXISTING
│   ├── usePromptOptimizer.ts   # EXISTING
│   ├── useOptimizedChat.ts     # EXISTING: Enhanced
│   ├── useTelemetry.ts         # NEW
│   └── useProviderAdapter.ts   # NEW
├── components/
│   ├── TokenDevtoolsPanel.tsx  # NEW
│   └── BudgetIndicator.tsx     # NEW
└── context/
    └── TokenOptimizerProvider.tsx  # EXISTING: Enhanced
```

---

## API Design

### ProviderAdapter Interface

```typescript
interface ProviderAdapter {
  readonly name: string;
  readonly supports: ProviderCapabilities;

  // Token counting
  countTokens(text: string, options?: CountOptions): Promise<number>;
  countMessages(messages: Message[], options?: CountOptions): Promise<number>;

  // Cost estimation
  estimateCost(usage: TokenUsage, model: string): CostEstimate;
  getPricing(model: string): ModelPricing;

  // Message normalization
  normalizeMessages(messages: Message[]): ProviderMessage[];
  normalizeResponse(response: unknown): NormalizedResponse;

  // Cache optimization
  formatForCaching?(prompt: CacheOptimizedPrompt): ProviderRequest;
}

interface ProviderCapabilities {
  caching: boolean;
  cacheTTL?: number[];
  streaming: boolean;
  tools: boolean;
  multiModal: boolean;
  maxContextTokens: Record<string, number>;
}
```

### TokenPolicy Functions

```typescript
// Pure functions - no side effects, fully testable
const TokenPolicy = {
  // Trimming strategies
  trimOldestFirst<T extends Message>(messages: T[], budget: number): T[];
  trimByPriority<T extends Message>(messages: T[], budget: number, getPriority: (m: T) => number): T[];
  trimByImportance<T extends Message>(messages: T[], budget: number, scorer: ImportanceScorer): T[];

  // Compression
  compressExtractive(text: string, targetRatio: number): CompressionResult;
  compressQueryAware(text: string, query: string, targetRatio: number): CompressionResult;

  // Templating (cache-optimized)
  stablePrefix(template: string, staticVars: Record<string, string>): string;
  dynamicSuffix(template: string, dynamicVars: Record<string, string>): string;

  // Analysis
  analyzePrompt(prompt: CacheOptimizedPrompt): PromptAnalysis;
  suggestOptimizations(prompt: CacheOptimizedPrompt): Suggestion[];
};
```

### Telemetry Events

```typescript
interface TelemetryEvent {
  type: TelemetryEventType;
  timestamp: number;
  sessionId?: string;
  requestId?: string;

  // Token metrics
  tokens: {
    input: number;
    output: number;
    cached?: number;
    total: number;
  };

  // Cost metrics
  cost: {
    input: number;
    output: number;
    total: number;
    saved?: number;
    currency: 'USD';
  };

  // Context
  model: string;
  provider: string;

  // Performance
  latencyMs?: number;
  cacheHit?: boolean;

  // Custom metadata
  metadata?: Record<string, unknown>;
}

type TelemetryEventType =
  | 'request_start'
  | 'request_complete'
  | 'cache_hit'
  | 'cache_miss'
  | 'cache_write'
  | 'budget_warning'
  | 'budget_exceeded'
  | 'compression_applied';
```

### BudgetManager Enhanced

```typescript
interface BudgetConfig {
  // Token limits
  maxTokensPerRequest?: number;
  maxTokensPerTurn?: number;
  maxTokensPerSession?: number;
  maxInputTokens?: number;
  maxOutputTokens?: number;

  // Cost limits
  maxCostPerRequest?: number;
  maxCostPerTurn?: number;
  maxCostPerSession?: number;
  maxCostPerDay?: number;
  maxCostPerMonth?: number;

  // Thresholds
  warningThreshold?: number;  // 0-1
  criticalThreshold?: number; // 0-1

  // Behavior
  onWarning?: (status: BudgetStatus) => void;
  onExceeded?: (status: BudgetStatus) => 'block' | 'allow' | 'trim';
  autoTrimStrategy?: 'oldest-first' | 'by-priority' | 'summarize';
}

interface BudgetManager {
  // Status checks
  checkBudget(tokens: TokenUsage): BudgetStatus;
  getRemainingBudget(): RemainingBudget;

  // Enforcement
  validateRequest(tokens: TokenUsage): ValidationResult;
  trimToFit(messages: Message[]): TrimResult;

  // Tracking
  recordUsage(tokens: TokenUsage, cost: number): void;
  getUsageStats(): UsageStats;
  resetSession(): void;

  // Configuration
  updateConfig(config: Partial<BudgetConfig>): void;
}
```

---

## Implementation Plan

### Sprint 1: Foundation (Days 1-5)

**Day 1-2: Fix Existing Issues**
- [ ] Analyze and fix 3 failing tests
- [ ] Clean up TypeScript errors
- [ ] Ensure all builds pass

**Day 3-4: ProviderAdapter Interface**
- [ ] Design interface based on research
- [ ] Create types.ts with full type definitions
- [ ] Implement OpenAI adapter (reference)
- [ ] Write comprehensive tests

**Day 5: CI/Benchmarks**
- [ ] Add token counting accuracy benchmarks
- [ ] Add cost estimation accuracy benchmarks
- [ ] Add bundle size checks to CI

### Sprint 2: Core Adapters (Days 6-10)

**Day 6-7: Anthropic & Google Adapters**
- [ ] Migrate existing provider code to adapter pattern
- [ ] Add cache_control support for Anthropic
- [ ] Add context caching for Google
- [ ] Write tests

**Day 8-9: Azure & Bedrock Adapters**
- [ ] Implement Azure OpenAI adapter
- [ ] Implement AWS Bedrock adapter
- [ ] Handle authentication patterns
- [ ] Write tests

**Day 10: Telemetry Foundation**
- [ ] Create event types
- [ ] Implement event emitter
- [ ] Add OTel-compatible output format

### Sprint 3: Enhanced Features (Days 11-15)

**Day 11-12: BudgetManager Enhancement**
- [ ] Add per-turn/session tracking
- [ ] Add cost-based limits
- [ ] Add warning/exceeded callbacks
- [ ] Write tests

**Day 13-14: TokenPolicy Functions**
- [ ] Implement trimming strategies
- [ ] Implement stable-prefix templating
- [ ] Add compression enhancements
- [ ] Write tests

**Day 15: React Integration**
- [ ] Update hooks to use new adapters
- [ ] Add useTelemetry hook
- [ ] Update TokenOptimizerProvider

### Sprint 4: Developer Experience (Days 16-20)

**Day 16-17: TokenDevtoolsPanel**
- [ ] Design component layout
- [ ] Implement token usage display
- [ ] Implement cost breakdown
- [ ] Implement cache statistics

**Day 18-19: Documentation**
- [ ] Update README files
- [ ] Add JSDoc to all public APIs
- [ ] Create migration guide
- [ ] Add examples

**Day 20: Release Preparation**
- [ ] Final testing
- [ ] Changelog
- [ ] Version bump
- [ ] Release v0.2.0

---

## Success Criteria

### Technical Metrics
| Metric | Target | Current |
|--------|--------|---------|
| Test pass rate | 100% | 97.7% |
| Core bundle size | <10KB | ~15KB |
| React bundle size | <5KB | ~7KB |
| Type coverage | 100% | ~95% |

### Feature Metrics
| Feature | Target | Current |
|---------|--------|---------|
| Providers supported | 8+ | 3 |
| Token count accuracy | ±5% | Unknown |
| Cost estimation accuracy | ±1% | Unknown |

### Quality Metrics
| Metric | Target | Current |
|--------|--------|---------|
| Documentation coverage | 100% | ~60% |
| Example apps | 3+ | 0 |
| Breaking changes | 0 | N/A |

---

## Risks & Mitigations

### Technical Risks
1. **Bundle size creep** → Aggressive tree-shaking, lazy loading
2. **Provider API changes** → Adapter abstraction, version pinning
3. **Tokenizer accuracy** → Benchmark suite, provider validation

### Schedule Risks
1. **Scope creep** → P0/P1/P2 prioritization, MVP focus
2. **Testing overhead** → Test-driven development, automation
3. **Documentation debt** → Doc-as-you-go policy

---

## Open Questions

1. Should we support custom tokenizers beyond gpt-tokenizer?
2. Should DevTools be a separate package for bundle size?
3. How do we handle provider-specific edge cases (e.g., Anthropic's extended thinking)?
4. Should we integrate with LangSmith/Langfuse for observability?

---

*Roadmap version: 1.0*
*Last updated: January 2025*
*Next review: After Sprint 1*
