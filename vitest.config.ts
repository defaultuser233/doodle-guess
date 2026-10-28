import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: [
        'src/lib/backup.ts',
        'src/lib/categories.ts',
        'src/lib/classifier.ts',
        'src/lib/drawing.ts',
        'src/lib/stats.ts',
        'src/lib/storage.ts',
        'src/lib/theme.ts',
      ],
      exclude: ['src/lib/**/*.test.ts'],
      thresholds: {
        lines: 60,
        functions: 60,
        statements: 60,
        branches: 50,
      },
    },
  },
})
