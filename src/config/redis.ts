import { Redis } from '@upstash/redis';
import { env } from './env';

/**
 * Upstash Redis client (singleton).
 *
 * Used for exactly two purposes in this project (per Guide §3.4):
 *   1. Refresh-token storage  — key `refresh:{userId}`, TTL 7 days.
 *   2. Response caching        — keys `cache:institutions:*`, TTL 60s.
 *
 * Do NOT use Redis for sessions, pub/sub, queues, or anything else.
 */
export const redis = new Redis({
  url: env.UPSTASH_REDIS_REST_URL,
  token: env.UPSTASH_REDIS_REST_TOKEN,
});
