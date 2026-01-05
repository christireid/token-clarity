# Repository Inventory Report

**Generated:** 2026-01-05
**Repository:** token-optimizer/token-clarity

---

## 1. Overview

| Metric | Value |
|--------|-------|
| Total TypeScript Files | 99 |
| Total Lines of Code | ~15,818 |
| Packages | 3 |
| Test Files | 12 |
| Tests | 292 |

---

## 2. Root Structure

```
token-clarity/
├── .changeset/           # Changesets for versioning
├── .github/              # CI/CD workflows
│   └── workflows/
│       ├── ci.yml        # CI pipeline
│       └── release.yml   # Release automation
├── docs/                 # Documentation
├── packages/             # Monorepo packages
│   ├── core/             # @token-optimizer/core
│   ├── react/            # @token-optimizer/react
│   └── semantic-cache/   # @token-optimizer/semantic-cache
├── reports/              # Generated reports
├── research/             # Market research & analysis
├── package.json          # Root workspace config
├── pnpm-workspace.yaml   # pnpm workspace definition
├── tsconfig.base.json    # Shared TypeScript config
└── vitest.config.ts      # Test configuration
```

---

## 3. Packages Inventory

### 3.1 @token-optimizer/core

| Field | Value |
|-------|-------|
| Path | `/packages/core` |
| Version | 0.1.0 |
| Description | Core utilities for AI token optimization |
| Entry Points | 6 (main, tokenizers, budget, cost, compression, providers) |

**Directory Structure:**
```
packages/core/src/
├── adapters/          # Provider adapters (8 providers)
│   ├── __tests__/     # 70 tests
│   ├── base.ts        # Base adapter class
│   ├── openai.ts      # OpenAI adapter
│   ├── anthropic.ts   # Anthropic adapter
│   ├── google.ts      # Google adapter
│   ├── azure.ts       # Azure OpenAI adapter
│   ├── bedrock.ts     # AWS Bedrock adapter
│   ├── mistral.ts     # Mistral adapter
│   ├── cohere.ts      # Cohere adapter
│   ├── groq.ts        # Groq adapter
│   └── types.ts       # Type definitions
├── budget/            # Budget management
│   ├── __tests__/     # 18 tests
│   ├── manager.ts     # Budget manager
│   ├── presets.ts     # Model presets
│   └── types.ts       # Type definitions
├── compression/       # Context compression
│   ├── __tests__/     # 18 tests
│   └── history.ts     # History compression
├── cost/              # Cost tracking & estimation
│   ├── __tests__/     # 21 tests
│   ├── pricing.ts     # Model pricing data
│   ├── tracker.ts     # Usage tracker
│   ├── remote-pricing.ts # Remote pricing fetcher
│   └── types.ts       # Type definitions
├── policy/            # Token policy management
│   ├── __tests__/     # 39 tests
│   ├── trim.ts        # Trim strategies
│   ├── prefix.ts      # Prefix management
│   ├── summarize.ts   # Summarization
│   ├── pack.ts        # Context packing
│   └── types.ts       # Type definitions
├── providers/         # Provider cache optimization
│   ├── __tests__/     # 16 tests
│   └── cache-alignment.ts
├── telemetry/         # Telemetry & tracing
│   ├── __tests__/     # 32 tests
│   ├── collector.ts   # Telemetry collector
│   ├── exporters.ts   # 6 exporter types
│   └── types.ts       # Type definitions
├── tokenizers/        # Token counting
│   ├── __tests__/     # 26 tests
│   ├── estimation.ts  # Fast estimation
│   └── gpt.ts         # GPT tokenizer
├── types/             # Shared types
│   └── index.ts
└── index.ts           # Main entry
```

**Dependencies:**
- `gpt-tokenizer` (peer, optional)

---

### 3.2 @token-optimizer/react

| Field | Value |
|-------|-------|
| Path | `/packages/react` |
| Version | 0.1.0 |
| Description | React hooks for AI token optimization |
| Entry Points | 4 (main, hooks, context, components) |

**Directory Structure:**
```
packages/react/src/
├── __tests__/         # 18 tests (devtools.test.tsx)
├── components/        # UI components
│   ├── devtools/      # Composable devtools (NEW)
│   │   ├── tabs/      # Individual tab components
│   │   ├── DevtoolsContext.tsx
│   │   ├── DevtoolsPanel.tsx
│   │   ├── theme.ts   # Theming system
│   │   └── utils.ts   # Formatting utilities
│   ├── TokenDevtoolsPanel.tsx  # Legacy (1019 lines)
│   └── index.ts
├── context/           # React context
│   └── TokenOptimizerContext.tsx
├── hooks/             # Custom hooks
│   ├── useBudgetGuardrails.ts  # NEW
│   ├── useCostPreview.ts       # NEW
│   ├── useCostTracker.ts
│   ├── useDevtools.ts
│   ├── useModelRouter.ts       # NEW
│   ├── useOptimizedChat.ts
│   ├── usePromptOptimizer.ts
│   ├── useTokenBudget.ts
│   └── index.ts
└── index.ts
```

**Dependencies:**
- `@token-optimizer/core` (workspace)
- `react` (peer)

---

### 3.3 @token-optimizer/semantic-cache

| Field | Value |
|-------|-------|
| Path | `/packages/semantic-cache` |
| Version | 0.1.0 |
| Description | Semantic caching for AI responses |
| Entry Points | 2 (main, react) |

**Directory Structure:**
```
packages/semantic-cache/src/
├── __tests__/
│   ├── embeddings.test.ts  # 8 tests
│   ├── similarity.test.ts  # 15 tests
│   └── storage.test.ts     # 11 tests
├── embeddings/        # Embedding providers
│   ├── transformers.ts
│   ├── tfidf.ts
│   └── index.ts
├── react/             # React integration
│   ├── useSemanticCache.ts
│   └── index.ts
├── similarity/        # Similarity algorithms
│   └── index.ts
├── storage/           # Storage adapters
│   ├── memory.ts
│   ├── indexeddb.ts
│   └── index.ts
├── cache.ts           # Main cache implementation
├── types.ts           # Type definitions
└── index.ts           # Main entry
```

**Dependencies:**
- `@token-optimizer/core` (workspace)
- `react` (peer, optional)
- `@xenova/transformers` (peer, optional)

---

## 4. Documentation Files

| File | Path | Purpose |
|------|------|---------|
| README.md | `/` | Main project documentation |
| CONTRIBUTING.md | `/` | Contribution guidelines |
| LICENSE | `/` | MIT License |
| README.md | `/packages/core/` | Core package docs |
| README.md | `/packages/react/` | React package docs |
| README.md | `/packages/semantic-cache/` | Semantic cache docs |
| roadmap-token-optimization.md | `/docs/` | Development roadmap |
| token-optimization-landscape.md | `/research/` | Market analysis |
| gap-analysis-vs-market.md | `/research/` | Competitive gap analysis |

---

## 5. Configuration Files

| File | Purpose |
|------|---------|
| `package.json` | Root workspace configuration |
| `pnpm-workspace.yaml` | Workspace package definition |
| `tsconfig.base.json` | Shared TypeScript settings |
| `vitest.config.ts` | Test runner configuration |
| `.eslintrc.cjs` | ESLint configuration |
| `.prettierrc` | Prettier configuration |
| `.changeset/config.json` | Changesets versioning |

---

## 6. CI/CD Workflows

### ci.yml
- Lint, typecheck, test, build
- Token/cost regression checks
- Benchmarks
- Publish dry-run

### release.yml
- Automated releases via changesets

---

## 7. Build Output

Each package builds to `/dist/`:
- ES modules (`.js`)
- CommonJS (`.cjs`)
- TypeScript declarations (`.d.ts`, `.d.cts`)

---

## 8. Test Coverage

| Package | Test Files | Tests |
|---------|------------|-------|
| core | 8 | 240 |
| react | 1 | 18 |
| semantic-cache | 3 | 34 |
| **Total** | **12** | **292** |

---

## 9. Benchmarks

Located in `/packages/core/benchmarks/`:
- `regression-check.ts` - 20 validation checks
- `token-accuracy.bench.ts` - Performance benchmarks

---

## 10. Summary

The repository is a well-structured pnpm monorepo with:
- **3 publishable packages** with proper exports configuration
- **292 tests** with comprehensive coverage
- **CI/CD automation** for releases
- **Type-safe** with strict TypeScript
- **Tree-shakeable** with proper sideEffects configuration
- **Dual format** (ESM + CJS) builds

**Recent Additions (This Session):**
- Composable DevtoolsPanel architecture
- useCostPreview, useModelRouter, useBudgetGuardrails hooks
- RemotePricingFetcher for dynamic pricing
- SSR-safe telemetry singleton
- Provider comparison component
