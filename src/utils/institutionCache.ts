import { createHash } from 'crypto';
import { redis } from '../config/redis';

/**
 * Response cache for the public institution endpoints (Guide §3.4).
 * Keys:
 *   cache:institutions:{queryHash}  — GET /api/v1/institutions
 *   cache:institutions:map          — GET /api/v1/institutions/map
 * TTL is 60s. Any admin write to institutions invalidates the whole set.
 */
const TTL_SECONDS = 60;
const PREFIX = 'cache:institutions';
export const MAP_CACHE_KEY = `${PREFIX}:map`;

/** Deterministic key for a list query (stable hash of the normalized query). */
export const listCacheKey = (query: Record<string, unknown>): string => {
  const normalized = JSON.stringify(query, Object.keys(query).sort());
  const hash = createHash('sha1').update(normalized).digest('hex');
  return `${PREFIX}:list:${hash}`;
};

export const getCached = async <T>(key: string): Promise<T | null> => {
  return (await redis.get<T>(key)) ?? null;
};

export const setCached = async (key: string, value: unknown): Promise<void> => {
  await redis.set(key, value, { ex: TTL_SECONDS });
};

/**
 * Invalidate every institution cache entry. Called on any admin write.
 * Uses SCAN to collect matching keys, then deletes them.
 */
export const invalidateInstitutionCache = async (): Promise<void> => {
  let cursor = 0;
  const keys: string[] = [];
  do {
    const [next, batch] = await redis.scan(cursor, {
      match: `${PREFIX}:*`,
      count: 100,
    });
    cursor = Number(next);
    keys.push(...batch);
  } while (cursor !== 0);

  if (keys.length > 0) {
    await redis.del(...keys);
  }
};
