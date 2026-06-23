import type { IncrementResponse, Options, Store } from 'express-rate-limit';
import { redis } from '../config/redis';

/**
 * express-rate-limit Store backed by Upstash Redis (REST client).
 *
 * The Upstash SDK doesn't expose the `sendCommand` interface that
 * `rate-limit-redis` expects, so this implements the Store contract directly
 * with INCR + PEXPIRE. Counters live under `ratelimit:{key}` and expire after
 * one window, so limit state survives process restarts and is shared across
 * instances — the "stateless API" requirement in backend-prd.md §7.
 */
export class UpstashRateLimitStore implements Store {
  prefix = 'ratelimit:';
  localKeys = false;
  private windowMs = 60_000;

  init(options: Options): void {
    this.windowMs = options.windowMs;
  }

  async increment(key: string): Promise<IncrementResponse> {
    const k = this.prefix + key;
    const totalHits = await redis.incr(k);

    let pttl: number;
    if (totalHits === 1) {
      // First hit in this window — arm the expiry.
      await redis.pexpire(k, this.windowMs);
      pttl = this.windowMs;
    } else {
      pttl = await redis.pttl(k);
      // A counter with no expiry (e.g. a PEXPIRE that didn't land) — re-arm it
      // so the key can never become a permanent block.
      if (pttl < 0) {
        await redis.pexpire(k, this.windowMs);
        pttl = this.windowMs;
      }
    }

    return { totalHits, resetTime: new Date(Date.now() + pttl) };
  }

  async decrement(key: string): Promise<void> {
    await redis.decr(this.prefix + key);
  }

  async resetKey(key: string): Promise<void> {
    await redis.del(this.prefix + key);
  }
}
