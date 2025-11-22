import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.test.ts',
        '**/*.test.tsx',
        '**/*.spec.ts',
        '**/*.spec.tsx',
        '**/types.ts',
        '**/types/**',
        '**/*.config.ts',
        '**/*.config.js',
        'scripts/',
        'public/',
        '.next/',
        'drizzle/'
      ],
      include: [
        'lib/**/*.ts',
        'app/api/**/*.ts',
        'components/**/*.tsx',
        'hooks/**/*.ts'
      ]
    },
    testTimeout: 10000,
    hookTimeout: 10000
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './')
    }
  }
});
