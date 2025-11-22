import { beforeAll, afterAll, afterEach } from 'vitest';
import '@testing-library/jest-dom';

// Global test setup
beforeAll(async () => {
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://localhost/test_10x_k_factor';
  process.env.NEXTAUTH_SECRET = 'test-secret-key-for-testing-only';
  process.env.NEXTAUTH_URL = 'http://localhost:3000';
});

// Clean up after each test
afterEach(async () => {
  // Clear any test data if needed
  // This will be implemented when we add database tests
});

// Global teardown
afterAll(async () => {
  // Close any open connections
});
