# @token-optimizer/react

React hooks for AI token optimization. Provides easy-to-use hooks for budget management, cost tracking, and cache optimization.

## Installation

```bash
npm install @token-optimizer/react
```

## Features

- `useTokenBudget` - Token counting and budget management
- `useCostTracker` - Cost tracking with persistence
- `usePromptOptimizer` - Cache-aligned prompt building
- `useOptimizedChat` - Complete chat with all optimizations
- `TokenOptimizerProvider` - Global configuration context

## Usage

### Provider Setup

```tsx
import { TokenOptimizerProvider } from '@token-optimizer/react';

function App() {
  return (
    <TokenOptimizerProvider
      config={{
        defaultModel: 'gpt-4o',
        defaultProvider: 'openai',
        globalBudget: { daily: 10.00 },
      }}
    >
      <YourApp />
    </TokenOptimizerProvider>
  );
}
```

### useOptimizedChat

```tsx
import { useOptimizedChat } from '@token-optimizer/react';

function Chat() {
  const {
    messages,
    input,
    setInput,
    sendMessage,
    isLoading,
    tokenBudget,
    costTracker,
  } = useOptimizedChat({
    api: '/api/chat',
    model: 'gpt-4o',
    provider: 'openai',
  });

  return (
    <div>
      <div>Status: {tokenBudget.status}</div>
      <div>Cost: ${costTracker.sessionCost.toFixed(4)}</div>
      {messages.map((m, i) => (
        <div key={i}>{m.role}: {m.content}</div>
      ))}
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
      />
    </div>
  );
}
```

### useTokenBudget

```tsx
import { useTokenBudget } from '@token-optimizer/react';

function TokenCounter() {
  const { countTokens, status, remainingInput } = useTokenBudget({
    model: 'gpt-4o',
    maxInputTokens: 4096,
  });

  const [text, setText] = useState('');
  const tokens = countTokens(text);

  return (
    <div>
      <textarea value={text} onChange={(e) => setText(e.target.value)} />
      <div>Tokens: {tokens} / {remainingInput} remaining</div>
    </div>
  );
}
```

### useCostTracker

```tsx
import { useCostTracker } from '@token-optimizer/react';

function CostDisplay() {
  const { sessionCost, totalSavings, trackRequest } = useCostTracker({
    model: 'gpt-4o',
    budgetLimit: 10.00,
  });

  return (
    <div>
      <div>Spent: ${sessionCost.toFixed(4)}</div>
      <div>Saved: ${totalSavings.toFixed(4)}</div>
    </div>
  );
}
```

## API Reference

See the [full documentation](../README.md) for complete API reference.

## License

MIT
