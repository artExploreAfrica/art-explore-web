import { defineConfig } from 'vitest/config';

/**
 * Test config for the smoke/integration suite.
 *
 * `env` is applied to process.env before any module loads, so the Zod env
 * validation in src/config/env.ts passes with deterministic dummy values —
 * the tests never touch a real database, Redis, or AWS (those clients are
 * mocked per test file). This means the suite runs anywhere, including CI,
 * with no secrets.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    env: {
      NODE_ENV: 'test',
      PORT: '4000',
      DATABASE_URL: 'postgresql://test:test@localhost:5432/test?schema=public',
      JWT_ACCESS_SECRET: 'test-access-secret-0123456789abcdef',
      JWT_REFRESH_SECRET: 'test-refresh-secret-0123456789abcdef',
      JWT_ACCESS_EXPIRES_IN: '15m',
      JWT_REFRESH_EXPIRES_IN: '7d',
      AWS_ACCESS_KEY_ID: 'test-key-id',
      AWS_SECRET_ACCESS_KEY: 'test-secret-key',
      AWS_REGION: 'eu-west-1',
      AWS_S3_BUCKET_NAME: 'test-bucket',
      UPSTASH_REDIS_REST_URL: 'https://test.upstash.io',
      UPSTASH_REDIS_REST_TOKEN: 'test-token',
    },
  },
});
