import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['server/**/*.test.js', 'client/src/**/*.test.js'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/dist-driver/**'],
    environment: 'node',
  },
});
