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

/** Stable hash of a normalized query object. */
const queryHash = (query: Record<string, unknown>): string =>
  createHash('sha1')
    .update(JSON.stringify(query, Object.keys(query).sort()))
    .digest('hex');

/** Deterministic key for a list query (stable hash of the normalized query). */
export const listCacheKey = (query: Record<string, unknown>): string =>
  `${PREFIX}:list:${queryHash(query)}`;

/**
 * Key for the public cross-venue exhibition list. Kept under the same PREFIX on
 * purpose: exhibition and institution writes already call
 * invalidateInstitutionCache, so these entries drop with everything else rather
 * than needing a second invalidation path that could be forgotten.
 */
export const exhibitionListCacheKey = (query: Record<string, unknown>): string =>
  `${PREFIX}:exhibitions:${queryHash(query)}`;

/**
 * The cache is an optimisation, never a dependency: if Redis is down or slow,
 * callers fall through to the database instead of failing the request.
 * Each cache call gets CACHE_TIMEOUT_MS before it is abandoned, because the
 * Upstash client retries for several seconds on a refused connection.
 */
const CACHE_TIMEOUT_MS = 1000;

const withTimeout = <T>(work: Promise<T>): Promise<T> => {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`timed out after ${CACHE_TIMEOUT_MS}ms`)),
      CACHE_TIMEOUT_MS,
    );
  });
  // An abandoned call may still reject later; swallow that so it is not
  // reported as an unhandled rejection.
  work.catch(() => {});
  return Promise.race([work, timeout]).finally(() => clearTimeout(timer));
};

const warn = (action: string, err: unknown): void => {
  const reason = err instanceof Error ? err.message : String(err);
  console.warn(`[cache] ${action} skipped, Redis unavailable: ${reason}`);
};

/** Cached value for `key`, or null on a miss or when Redis is unavailable. */
export const getCached = async <T>(key: string): Promise<T | null> => {
  try {
    return (await withTimeout(redis.get<T>(key))) ?? null;
  } catch (err) {
    warn('read', err);
    return null;
  }
};

/** Best-effort write; a Redis failure is logged, never thrown. */
export const setCached = async (key: string, value: unknown): Promise<void> => {
  try {
    await withTimeout(redis.set(key, value, { ex: TTL_SECONDS }));
  } catch (err) {
    warn('write', err);
  }
};

/**
 * Invalidate every institution cache entry. Called on any admin write.
 * Uses SCAN to collect matching keys, then deletes them.
 *
 * Best-effort: the admin write has already been committed by the time this
 * runs, so a Redis failure must not turn it into an error. Entries left
 * behind expire within TTL_SECONDS.
 */
export const invalidateInstitutionCache = async (): Promise<void> => {
  try {
    let cursor = 0;
    const keys: string[] = [];
    do {
      const [next, batch] = await withTimeout(
        redis.scan(cursor, { match: `${PREFIX}:*`, count: 100 }),
      );
      cursor = Number(next);
      keys.push(...batch);
    } while (cursor !== 0);

    if (keys.length > 0) {
      await withTimeout(redis.del(...keys));
    }
  } catch (err) {
    warn('invalidate', err);
  }
};
