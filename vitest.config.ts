import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'extension/src/shared'),
    },
  },
  test: {
    include: ['extension/src/**/*.test.ts'],
  },
});
