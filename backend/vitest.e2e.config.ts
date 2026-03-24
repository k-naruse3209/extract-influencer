import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.e2e.{spec,test}.ts', 'test/**/*.e2e.{spec,test}.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // Load .env.test before any test module is imported
    setupFiles: ['src/e2e/setup.ts'],
    // E2E tests run sequentially to avoid DB state conflicts
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
  },
})
