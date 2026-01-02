# Contributing to Token Optimizer

Thank you for your interest in contributing to Token Optimizer!

## Development Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/token-optimizer/token-optimizer.git
   cd token-optimizer
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Build all packages:
   ```bash
   pnpm build
   ```

4. Run tests:
   ```bash
   pnpm test
   ```

## Project Structure

```
token-optimizer/
├── packages/
│   ├── core/              # Provider-agnostic utilities
│   ├── react/             # React hooks & components
│   └── semantic-cache/    # Embedding-based caching
├── examples/              # Example applications
└── docs/                  # Documentation
```

## Development Workflow

1. Create a new branch for your feature/fix:
   ```bash
   git checkout -b feature/my-feature
   ```

2. Make your changes and add tests

3. Run linting and type checking:
   ```bash
   pnpm lint
   pnpm typecheck
   ```

4. Run tests:
   ```bash
   pnpm test
   ```

5. Create a changeset (if your change should be released):
   ```bash
   pnpm changeset
   ```

6. Submit a pull request

## Code Style

- Use TypeScript strict mode
- No `any` types in public APIs
- Use JSDoc comments for public functions
- Follow the existing code style

## Testing

- Write tests for all new functionality
- Aim for >90% code coverage
- Test edge cases and error conditions

## Pull Request Guidelines

- Include a clear description of the changes
- Reference any related issues
- Ensure all CI checks pass
- Add a changeset for releasable changes

## Release Process

Releases are managed automatically via Changesets:

1. Run `pnpm changeset` to create a changeset
2. Commit the changeset file
3. When merged to main, a release PR will be created
4. Merging the release PR publishes to npm

## Questions?

Open an issue or start a discussion on GitHub.
