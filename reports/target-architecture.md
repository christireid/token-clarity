# Target Architecture

**Generated:** 2026-01-05

---

## 1. Design Principles

1. **Single Source of Truth**: Each type, function, and component exists in exactly one place
2. **Clear Ownership**: Each package has a well-defined responsibility
3. **Minimal Surface Area**: Export only what's needed; keep internals private
4. **Backwards Compatibility**: Provide aliases and deprecation paths for breaking changes
5. **Tree-Shakeable**: Side-effect-free modules with proper exports configuration

---

## 2. Target Package Structure

```
token-clarity/
├── .changeset/              # Versioning (unchanged)
├── .github/workflows/       # CI/CD (unchanged)
├── docs/                    # Master documentation site
│   ├── README.md            # Documentation index
│   ├── getting-started.md   # Quick start guide
│   ├── api/                 # API reference (generated)
│   ├── guides/              # Usage guides
│   │   ├── cost-tracking.md
│   │   ├── budget-management.md
│   │   ├── caching.md
│   │   └── devtools.md
│   └── roadmap.md           # Development roadmap
├── packages/
│   ├── core/                # @token-optimizer/core
│   ├── react/               # @token-optimizer/react
│   └── semantic-cache/      # @token-optimizer/semantic-cache
├── reports/                 # Analysis reports (this directory)
├── research/                # Market research (unchanged)
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── vitest.config.ts
```

---

## 3. Type Consolidation Plan

### 3.1 Unified Types Location

**Target:** `/packages/core/src/types/index.ts`

This file becomes the single source of truth for all shared types.

### 3.2 CostEstimate Interface Unification

**Current State:**
- `cost/types.ts` - basic version
- `adapters/types.ts` - extended version with model/provider

**Target:**
```typescript
// /packages/core/src/types/index.ts
export interface CostEstimate {
  inputCost: number;
  outputCost: number;
  totalCost: number;
  // Optional extended fields
  savings?: {
    fromCache: number;
    percentage: number;
  };
  cacheSavings?: number;  // Legacy alias for savings.fromCache
  model?: string;
  provider?: string;
}
```

**Migration:**
1. Update `/packages/core/src/types/index.ts` with unified interface
2. Update `/packages/core/src/cost/types.ts` to re-export from types/index.ts
3. Update `/packages/core/src/adapters/types.ts` to re-export from types/index.ts
4. Add JSDoc deprecation notices for cacheSavings

### 3.3 ModelPricing Interface Unification

**Current State:**
- `cost/types.ts` - basic version
- `adapters/types.ts` - extended with contextWindow, maxOutputTokens

**Target:**
```typescript
// /packages/core/src/types/index.ts
export interface ModelPricing {
  inputPer1kTokens: number;
  outputPer1kTokens: number;
  // Optional extended fields (from adapters version)
  contextWindow?: number;
  maxOutputTokens?: number;
  // Provider metadata
  provider?: string;
  modelId?: string;
}
```

**Migration:**
1. Merge into `/packages/core/src/types/index.ts`
2. Update both `cost/types.ts` and `adapters/types.ts` to re-export
3. Ensure backwards compatibility with existing consumers

### 3.4 TokenUsage Interface (Keep Both)

**Rationale:** The two versions serve different purposes:
- `types/index.ts` - Public API with descriptive property names
- `adapters/types.ts` - Internal API matching provider responses

**Action:** Add JSDoc to clarify distinction:
```typescript
// types/index.ts
/**
 * Public API token usage with descriptive property names.
 * Use AdapterTokenUsage for internal provider response mapping.
 */
export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cachedTokens?: number;
  totalTokens: number;
}

// adapters/types.ts
/**
 * Internal token usage format matching provider API responses.
 * Use TokenUsage from types/index.ts for public API.
 */
export interface AdapterTokenUsage {
  input: number;
  output: number;
  cached?: number;
  total: number;
}
```

---

## 4. Component Consolidation Plan

### 4.1 DevtoolsPanel Architecture

**Current State:**
- `TokenDevtoolsPanel.tsx` (1019 lines) - legacy monolith
- `devtools/DevtoolsPanel.tsx` (180 lines) - new composable version

**Target Architecture:**
```
components/
├── devtools/                 # Composable devtools (PRIMARY)
│   ├── DevtoolsContext.tsx   # Context provider
│   ├── DevtoolsPanel.tsx     # Main panel wrapper
│   ├── theme.ts              # Theming system
│   ├── utils.ts              # Formatting utilities (CANONICAL)
│   ├── tabs/
│   │   ├── OverviewTab.tsx
│   │   ├── RequestsTab.tsx
│   │   ├── BreakdownTab.tsx
│   │   ├── CacheTab.tsx
│   │   └── CompareTab.tsx
│   └── index.ts
├── TokenDevtoolsPanel.tsx    # @deprecated - re-exports DevtoolsPanel
└── index.ts
```

### 4.2 Migration Steps

**Phase 1 (v0.1.x - Current):**
1. ✅ Create composable devtools (DONE)
2. Remove duplicated formatting functions from TokenDevtoolsPanel
3. Import from devtools/utils.ts instead
4. Add `@deprecated` JSDoc to TokenDevtoolsPanel

**Phase 2 (v0.2.0):**
1. TokenDevtoolsPanel becomes a thin wrapper that re-exports DevtoolsPanel
2. Console warning on usage
3. Update all documentation to reference DevtoolsPanel

**Phase 3 (v1.0.0):**
1. Remove TokenDevtoolsPanel entirely
2. Final migration guide in release notes

---

## 5. Utility Function Consolidation

### 5.1 Formatting Functions

**Current State:** Duplicated in TokenDevtoolsPanel.tsx and devtools/utils.ts

**Target:** Single source in `/packages/react/src/components/devtools/utils.ts`

| Function | Remove From | Keep In |
|----------|-------------|---------|
| `formatCurrency` | TokenDevtoolsPanel.tsx:316-320 | devtools/utils.ts:12-17 |
| `formatCompact` | TokenDevtoolsPanel.tsx:325-329 | devtools/utils.ts:19-26 |
| `formatDuration` | TokenDevtoolsPanel.tsx:334-337 | devtools/utils.ts:28-35 |
| `formatPercent` | TokenDevtoolsPanel.tsx:342-344 | devtools/utils.ts:40-42 |
| `formatRelativeTime` | TokenDevtoolsPanel.tsx:349-355 | devtools/utils.ts:47-53 |

**Action:** Update TokenDevtoolsPanel.tsx to import from `./devtools/utils.js`

---

## 6. Export Structure

### 6.1 @token-optimizer/core

```typescript
// Main entry: /packages/core/src/index.ts
export * from './types/index.js';
export * from './adapters/index.js';
export * from './budget/index.js';
export * from './compression/index.js';
export * from './cost/index.js';
export * from './policy/index.js';
export * from './providers/index.js';
export * from './telemetry/index.js';
export * from './tokenizers/index.js';

// Subpath exports in package.json:
// "@token-optimizer/core" → main
// "@token-optimizer/core/tokenizers" → tokenizers submodule
// "@token-optimizer/core/budget" → budget submodule
// "@token-optimizer/core/cost" → cost submodule
// "@token-optimizer/core/compression" → compression submodule
// "@token-optimizer/core/providers" → providers submodule
```

### 6.2 @token-optimizer/react

```typescript
// Main entry: /packages/react/src/index.ts
export * from './hooks/index.js';
export * from './context/index.js';
export * from './components/index.js';

// Subpath exports in package.json:
// "@token-optimizer/react" → main
// "@token-optimizer/react/hooks" → hooks only
// "@token-optimizer/react/context" → context only
// "@token-optimizer/react/components" → components only
```

---

## 7. Documentation Structure

### 7.1 Current State
- Root README.md
- Package-level README.md files
- docs/roadmap-token-optimization.md
- research/*.md

### 7.2 Target Structure

```
docs/
├── README.md                    # Index/landing page
├── getting-started.md           # Quick start for all packages
├── api/                         # Auto-generated API docs
│   ├── core.md
│   ├── react.md
│   └── semantic-cache.md
├── guides/
│   ├── cost-tracking.md         # Cost tracking guide
│   ├── budget-management.md     # Budget & guardrails
│   ├── caching.md               # Semantic caching
│   ├── devtools.md              # DevtoolsPanel usage
│   ├── telemetry.md             # Telemetry & tracing
│   └── migration.md             # Migration from legacy
└── roadmap.md                   # Moved from docs/roadmap-token-optimization.md
```

### 7.3 Package README Pattern

Each package README should be concise and link to main docs:

```markdown
# @token-optimizer/[package]

[One-line description]

## Installation
[npm/pnpm/yarn commands]

## Quick Start
[Minimal example - 10-15 lines max]

## Documentation
See the [full documentation](../../docs/README.md) for:
- [Guide 1](../../docs/guides/xxx.md)
- [Guide 2](../../docs/guides/yyy.md)
- [API Reference](../../docs/api/[package].md)

## License
MIT
```

---

## 8. File Transformations

### 8.1 Current → Target Mapping

| Current Location | Action | Target Location |
|------------------|--------|-----------------|
| `core/src/cost/types.ts` CostEstimate | MOVE | `core/src/types/index.ts` |
| `core/src/adapters/types.ts` CostEstimate | DELETE | Import from types/index.ts |
| `core/src/cost/types.ts` ModelPricing | MOVE | `core/src/types/index.ts` |
| `core/src/adapters/types.ts` ModelPricing | DELETE | Import from types/index.ts |
| `react/components/TokenDevtoolsPanel.tsx` formatters | DELETE | Import from devtools/utils.ts |
| `docs/roadmap-token-optimization.md` | MOVE | `docs/roadmap.md` |

### 8.2 Files to Create

| File | Purpose |
|------|---------|
| `docs/getting-started.md` | Quick start guide |
| `docs/guides/cost-tracking.md` | Cost tracking guide |
| `docs/guides/budget-management.md` | Budget guardrails guide |
| `docs/guides/devtools.md` | DevtoolsPanel guide |
| `docs/guides/migration.md` | Legacy migration guide |

### 8.3 Files to Archive/Delete

| File | Version | Action |
|------|---------|--------|
| `TokenDevtoolsPanel.tsx` | v0.2.0 | Convert to re-export wrapper |
| `TokenDevtoolsPanel.tsx` | v1.0.0 | DELETE entirely |

---

## 9. Backwards Compatibility Strategy

### 9.1 Type Aliases

After consolidation, maintain aliases in original locations:

```typescript
// /packages/core/src/cost/types.ts
export { CostEstimate, ModelPricing } from '../types/index.js';
// @deprecated - Import directly from @token-optimizer/core

// /packages/core/src/adapters/types.ts
export { CostEstimate, ModelPricing } from '../types/index.js';
// @deprecated - Import directly from @token-optimizer/core
```

### 9.2 Component Aliases

```typescript
// /packages/react/src/components/TokenDevtoolsPanel.tsx (v0.2.0)
/**
 * @deprecated Use DevtoolsPanel from '@token-optimizer/react/components' instead.
 * This component will be removed in v1.0.0.
 */
export { DevtoolsPanel as TokenDevtoolsPanel } from './devtools/index.js';
```

---

## 10. Implementation Order

### Phase 4 Tasks (Execute Now)

1. **HIGH PRIORITY: Remove duplicate formatting functions**
   - Edit TokenDevtoolsPanel.tsx to import from devtools/utils.ts
   - Remove inline formatCurrency, formatCompact, formatDuration, formatPercent, formatRelativeTime

2. **Add deprecation notices**
   - Add @deprecated JSDoc to TokenDevtoolsPanel
   - Add deprecation comments to duplicate type locations

3. **Unify CostEstimate interface**
   - Update types/index.ts with complete CostEstimate
   - Update cost/types.ts to re-export
   - Update adapters/types.ts to re-export

4. **Unify ModelPricing interface**
   - Update types/index.ts with complete ModelPricing
   - Update cost/types.ts to re-export
   - Update adapters/types.ts to re-export

5. **Documentation consolidation**
   - Update docs/ structure
   - Ensure all package READMEs follow the pattern

---

## 11. Success Criteria

After Phase 4 completion:

- [ ] No duplicate utility functions
- [ ] Single source for CostEstimate type
- [ ] Single source for ModelPricing type
- [ ] TokenDevtoolsPanel marked as deprecated
- [ ] All tests passing (292+)
- [ ] TypeScript compilation successful
- [ ] No circular dependencies
- [ ] Tree-shaking working (verify with bundler analysis)

---

## 12. Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Breaking changes | Re-exports maintain old import paths |
| Test failures | Run tests after each change |
| Type conflicts | Use strict TypeScript to catch issues |
| Bundle size increase | Verify tree-shaking with build analysis |

---

## Conclusion

This architecture consolidates duplicates while maintaining full backwards compatibility. The key changes are:

1. **Type unification** into `core/src/types/index.ts`
2. **Utility consolidation** into `devtools/utils.ts`
3. **Component deprecation** path for TokenDevtoolsPanel
4. **Documentation centralization** in `docs/` directory

Implementation can proceed incrementally with no breaking changes until v1.0.0.
