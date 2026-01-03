/**
 * Regression check for token counting and cost estimation
 *
 * This script runs accuracy checks to ensure no regressions in:
 * 1. Token counting accuracy
 * 2. Cost estimation accuracy
 * 3. Cache savings calculations
 */

import {
  estimateTokens,
  estimateChatTokens,
  estimateCost,
  getAllPricing,
} from '../src/index.js';

interface RegressionResult {
  passed: boolean;
  name: string;
  expected: unknown;
  actual: unknown;
  tolerance?: number;
}

const results: RegressionResult[] = [];

function check(
  name: string,
  actual: number,
  expected: number,
  tolerance = 0.1
): void {
  const diff = Math.abs(actual - expected);
  const relativeError = expected !== 0 ? diff / expected : diff;
  const passed = relativeError <= tolerance;

  results.push({
    passed,
    name,
    expected,
    actual,
    tolerance,
  });

  if (!passed) {
    console.error(`FAIL: ${name}`);
    console.error(`  Expected: ${expected} (±${tolerance * 100}%)`);
    console.error(`  Actual: ${actual}`);
    console.error(`  Relative error: ${(relativeError * 100).toFixed(2)}%`);
  } else {
    console.log(`PASS: ${name}`);
  }
}

function checkRange(
  name: string,
  actual: number,
  min: number,
  max: number
): void {
  const passed = actual >= min && actual <= max;

  results.push({
    passed,
    name,
    expected: `${min}-${max}`,
    actual,
  });

  if (!passed) {
    console.error(`FAIL: ${name}`);
    console.error(`  Expected range: ${min}-${max}`);
    console.error(`  Actual: ${actual}`);
  } else {
    console.log(`PASS: ${name}`);
  }
}

async function runRegressionChecks() {
  console.log('='.repeat(60));
  console.log('Token Optimizer Regression Check');
  console.log('='.repeat(60));
  console.log('');

  // ============================================
  // Token Counting Accuracy
  // ============================================
  console.log('--- Token Counting Accuracy ---');

  // Known token counts using estimation
  check('Short text tokens', estimateTokens('Hello, world!'), 4, 0.5);
  check('Empty text tokens', estimateTokens(''), 0, 0);
  check('Number tokens', estimateTokens('12345'), 2, 0.5);
  // Unicode estimation varies by tokenizer - just check it returns reasonable value
  checkRange('Unicode tokens', estimateTokens('你好世界'), 1, 10);

  // Paragraph token count (approximately 4 tokens per word)
  const paragraph = 'The quick brown fox jumps over the lazy dog. This is a test.';
  checkRange('Paragraph tokens', estimateTokens(paragraph), 10, 25);

  console.log('');

  // ============================================
  // Chat Token Estimation
  // ============================================
  console.log('--- Chat Token Estimation ---');

  const simpleChat = [
    { role: 'system' as const, content: 'You are a helpful assistant.' },
    { role: 'user' as const, content: 'Hello!' },
    { role: 'assistant' as const, content: 'Hi!' },
  ];

  const chatTokens = estimateChatTokens(simpleChat);
  checkRange('Simple chat tokens', chatTokens, 15, 50);

  // Chat with longer messages
  const longerChat = [
    {
      role: 'system' as const,
      content:
        'You are a helpful coding assistant specialized in TypeScript and React.',
    },
    {
      role: 'user' as const,
      content:
        'Can you explain how to use the useEffect hook in React? I want to fetch data from an API.',
    },
    {
      role: 'assistant' as const,
      content: `The useEffect hook is used for side effects in React functional components.
Here's how to fetch data:

\`\`\`typescript
useEffect(() => {
  fetch('/api/data')
    .then(res => res.json())
    .then(data => setData(data));
}, []);
\`\`\`

The empty dependency array means it runs once on mount.`,
    },
  ];

  const longerChatTokens = estimateChatTokens(longerChat);
  checkRange('Longer chat tokens', longerChatTokens, 80, 250);

  console.log('');

  // ============================================
  // Cost Estimation Accuracy
  // ============================================
  console.log('--- Cost Estimation Accuracy ---');

  // GPT-4o pricing: $2.50/1M input, $10/1M output
  const gpt4oCost = estimateCost('gpt-4o', 1000000, 0);
  check('GPT-4o input cost (1M tokens)', gpt4oCost.inputCost, 2.5, 0.1);

  const gpt4oOutputCost = estimateCost('gpt-4o', 0, 1000000);
  check('GPT-4o output cost (1M tokens)', gpt4oOutputCost.outputCost, 10, 0.1);

  // Claude 3 Opus pricing: $15/1M input, $75/1M output
  const opusCost = estimateCost('claude-3-opus', 1000000, 0);
  check('Claude Opus input cost (1M tokens)', opusCost.inputCost, 15, 0.1);

  const opusOutputCost = estimateCost('claude-3-opus', 0, 1000000);
  check('Claude Opus output cost (1M tokens)', opusOutputCost.outputCost, 75, 0.1);

  console.log('');

  // ============================================
  // Cache Savings Calculation
  // ============================================
  console.log('--- Cache Savings Calculation ---');

  const withoutCache = estimateCost('gpt-4o', 10000, 5000, 0);
  const withCache = estimateCost('gpt-4o', 10000, 5000, 5000);

  // Cached tokens should save ~50% on input cost for those tokens
  const expectedSavings = 5000 * (2.5 / 1000000) * 0.5; // 50% savings for cached
  check(
    'Cache savings calculation',
    withCache.savings?.fromCache ?? 0,
    expectedSavings,
    0.3
  );

  // Total cost with cache should be less
  if (withCache.totalCost >= withoutCache.totalCost) {
    results.push({
      passed: false,
      name: 'Cached cost is lower than non-cached',
      expected: `< ${withoutCache.totalCost}`,
      actual: withCache.totalCost,
    });
    console.error('FAIL: Cached cost is lower than non-cached');
  } else {
    results.push({
      passed: true,
      name: 'Cached cost is lower than non-cached',
      expected: `< ${withoutCache.totalCost}`,
      actual: withCache.totalCost,
    });
    console.log('PASS: Cached cost is lower than non-cached');
  }

  console.log('');

  // ============================================
  // Pricing Data Completeness
  // ============================================
  console.log('--- Pricing Data Completeness ---');

  const pricing = getAllPricing();
  const requiredModels = [
    'gpt-4o',
    'gpt-4o-mini',
    'gpt-4-turbo',
    'gpt-3.5-turbo',
    'claude-3-opus',
    'claude-3-sonnet',
    'claude-3-haiku',
  ];

  for (const model of requiredModels) {
    const hasPricing = model in pricing;
    results.push({
      passed: hasPricing,
      name: `Pricing exists for ${model}`,
      expected: true,
      actual: hasPricing,
    });
    if (hasPricing) {
      console.log(`PASS: Pricing exists for ${model}`);
    } else {
      console.error(`FAIL: Pricing exists for ${model}`);
    }
  }

  console.log('');

  // ============================================
  // Summary
  // ============================================
  console.log('='.repeat(60));
  console.log('Summary');
  console.log('='.repeat(60));

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  console.log(`Total checks: ${results.length}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);

  if (failed > 0) {
    console.log('');
    console.log('Failed checks:');
    for (const r of results.filter((r) => !r.passed)) {
      console.log(`  - ${r.name}`);
    }
    process.exit(1);
  }

  console.log('');
  console.log('All regression checks passed!');
}

runRegressionChecks().catch((error) => {
  console.error('Regression check failed:', error);
  process.exit(1);
});
