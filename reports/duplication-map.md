# Duplication Map

**Generated:** 2026-01-05

---

## Summary

| Category | Duplicates Found | Severity |
|----------|-----------------|----------|
| Type Definitions | 4 | Medium |
| Utility Functions | 4 | Low |
| Components | 1 | Medium |
| File Names | 2 | None (Expected) |

---

## 1. Type Definition Duplicates

### 1.1 TokenUsage Interface

**Locations:**
- `/packages/core/src/types/index.ts:82`
- `/packages/core/src/adapters/types.ts:11`

**Analysis:**
```typescript
// types/index.ts version
interface TokenUsage {
  inputTokens: number;    // Different property name
  outputTokens: number;   // Different property name
  cachedTokens?: number;
  totalTokens: number;
}

// adapters/types.ts version
interface TokenUsage {
  input: number;          // Shorter name
  output: number;         // Shorter name
  cached?: number;
  total: number;
}
```

**Recommendation:** These are intentionally different - the adapters version is for internal use with provider APIs (shorter names), while types/index.ts is the public API. **KEEP BOTH** but clarify in documentation.

**Action:** Add JSDoc clarifying the distinction. The core index.ts already aliases: `type AdapterTokenUsage`.

---

### 1.2 CostEstimate Interface

**Locations:**
- `/packages/core/src/cost/types.ts:23`
- `/packages/core/src/adapters/types.ts:25`

**Analysis:**
```typescript
// cost/types.ts version
interface CostEstimate {
  inputCost: number;
  outputCost: number;
  totalCost: number;
  savings?: { fromCache: number; percentage: number; };
}

// adapters/types.ts version
interface CostEstimate {
  inputCost: number;
  outputCost: number;
  totalCost: number;
  cacheSavings?: number;  // Different structure
  model: string;          // Additional fields
  provider: string;       // Additional fields
}
```

**Recommendation:** The adapter version includes more metadata. **MERGE** into one interface with optional fields.

**Action:**
- Move unified CostEstimate to `/packages/core/src/types/index.ts`
- Update both modules to import from types
- Keep backwards-compatible aliases

---

### 1.3 ModelPricing Interface

**Locations:**
- `/packages/core/src/cost/types.ts:11`
- `/packages/core/src/adapters/types.ts:43`

**Analysis:** The adapters version has additional fields (contextWindow, maxOutputTokens).

**Recommendation:** **MERGE** - use the more complete adapter version.

---

### 1.4 Other Minor Type Duplicates

| Interface | Locations | Action |
|-----------|-----------|--------|
| HistoricalStats | cost/types.ts, types/index.ts | Already imported - OK |
| BudgetAlert | cost/types.ts, hooks | Different purposes - OK |

---

## 2. Utility Function Duplicates

### 2.1 Formatting Functions in DevtoolsPanel

**Locations:**
- `/packages/react/src/components/TokenDevtoolsPanel.tsx` (lines 316-355)
- `/packages/react/src/components/devtools/utils.ts` (lines 12-48)

**Functions Duplicated:**
| Function | Lines in Legacy | Lines in New |
|----------|-----------------|--------------|
| `formatCurrency` | 316-320 | 12-17 |
| `formatCompact` | 325-329 | 19-26 |
| `formatDuration` | 334-337 | 28-35 |
| `formatPercent` | 342-344 | 40-42 |
| `formatRelativeTime` | 349-355 | 47-53 |

**Recommendation:** The new `devtools/utils.ts` is the canonical location. **DELETE** functions from `TokenDevtoolsPanel.tsx` and import from utils.

**Action:** Update `TokenDevtoolsPanel.tsx` to import from `./devtools/utils.js`

---

## 3. Component Duplicates

### 3.1 TokenDevtoolsPanel vs DevtoolsPanel

**Locations:**
- `/packages/react/src/components/TokenDevtoolsPanel.tsx` (1019 lines) - LEGACY
- `/packages/react/src/components/devtools/DevtoolsPanel.tsx` (180 lines) - NEW

**Analysis:**
- `TokenDevtoolsPanel.tsx` is the original monolithic component
- `devtools/` folder contains the refactored, composable version
- Both are currently exported for backwards compatibility

**Recommendation:**
1. Phase 1 (Now): Keep both, document legacy deprecation
2. Phase 2 (v0.2.0): Remove TokenDevtoolsPanel, keep DevtoolsPanel
3. Add deprecation warning to TokenDevtoolsPanel

**Action:** Mark TokenDevtoolsPanel as `@deprecated` in JSDoc

---

## 4. File Name Patterns (Acceptable Duplicates)

These are expected in a monorepo:

| Filename | Count | Reason |
|----------|-------|--------|
| `index.ts` | 21 | Standard module entry points |
| `types.ts` | 9 | Type definitions per module |
| `tsup.config.ts` | 3 | Build config per package |

**No action needed.**

---

## 5. Documentation Duplicates

**Checked areas:**
- README files: Each package has unique content ✓
- API documentation: Inline JSDoc (no external docs site) ✓
- Research docs: Unique content ✓

**No documentation duplicates found.**

---

## 6. Priority Actions

### HIGH Priority (Do Now)
1. ✅ Refactor `TokenDevtoolsPanel.tsx` to use `devtools/utils.ts` imports
2. Add `@deprecated` tag to `TokenDevtoolsPanel`

### MEDIUM Priority (Next Release)
3. Unify `CostEstimate` interface into single source
4. Unify `ModelPricing` interface into single source
5. Remove `TokenDevtoolsPanel.tsx` (breaking change for v0.2.0)

### LOW Priority (Future)
6. Consider creating a shared `@token-optimizer/shared` package for common types
7. Add architectural decision record (ADR) explaining type aliasing strategy

---

## 7. Recommended Merges

| Current Location | Merge Into | Notes |
|------------------|------------|-------|
| TokenDevtoolsPanel formatting functions | devtools/utils.ts | Import instead of duplicate |
| adapters/types.ts CostEstimate | types/index.ts | Unified with optional fields |
| adapters/types.ts ModelPricing | cost/types.ts | Use more complete version |

---

## 8. Files to Archive/Delete

| File | Action | Reason |
|------|--------|--------|
| TokenDevtoolsPanel.tsx | Deprecate (v0.1.x), Delete (v0.2.0) | Replaced by composable devtools |

---

## Conclusion

The repository has **minimal duplication** for a codebase of this size. The main issues are:

1. **Intentional type variants** (TokenUsage) - acceptable with documentation
2. **Legacy component** (TokenDevtoolsPanel) - planned deprecation path
3. **Duplicated utility functions** - easy fix by importing

Overall cleanliness score: **8/10**
