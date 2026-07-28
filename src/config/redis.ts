import { Redis } from '@upstash/redis';
import { env } from './env';

/**
 * Upstash Redis client (singleton).
 *
 * Used for:
 *   1. Refresh-token storage     — key `refresh:{userId}`, TTL 7 days.
 *   2. Response caching          — keys `cache:institutions:*`, TTL 60s.
 *   3. Password-reset tokens     — key `reset:{sha256}`, TTL 1 hour.
 *   4. Auth endpoint rate limits — Upstash-backed store for express-rate-limit.
 *
 * Do NOT use Redis for sessions, pub/sub, or queues beyond the above.
 */
export const redis = new Redis({
  url: env.UPSTASH_REDIS_REST_URL,
  token: env.UPSTASH_REDIS_REST_TOKEN,
});
