import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'tokenizers/index': 'src/tokenizers/index.ts',
    'budget/index': 'src/budget/index.ts',
    'cost/index': 'src/cost/index.ts',
    'compression/index': 'src/compression/index.ts',
    'providers/index': 'src/providers/index.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  splitting: true,
  treeshake: true,
  minify: false,
  external: ['gpt-tokenizer'],
});
