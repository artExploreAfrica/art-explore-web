import { Request } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { env } from '../config/env';
import { errorResponse } from '../utils/response';
import { UpstashRateLimitStore } from './redisRateStore';

/**
 * Brute-force protection for the auth endpoints (login/register/refresh/logout).
 * Backed by Upstash Redis so limit state survives restarts and is shared across
 * instances (backend-prd.md §7). Disabled under NODE_ENV=test so the suite stays
 * deterministic and never touches Redis.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 20, // per IP per window
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  store: new UpstashRateLimitStore(),
  skip: () => env.NODE_ENV === 'test',
  handler: (_req, res) =>
    errorResponse(res, 'Too many requests — please try again later', 429),
});

/**
 * Throttle contributor writes (submissions, reviews, submission uploads).
 * Keyed by account rather than IP: these routes are all authenticated, and a
 * per-IP budget would let one spammer exhaust the allowance for everyone behind
 * the same NAT — a real constraint on a shared Lagos connection.
 *
 * Without this, any signed-up USER could flood the review queue indefinitely;
 * the auth limiter never covered these paths.
 */
export const contributorWriteLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  limit: 30, // per account per hour
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  store: new UpstashRateLimitStore(),
  skip: () => env.NODE_ENV === 'test',
  // `authenticate` runs first on every route this guards, so req.user is set;
  // the ip fallback only matters if that order ever changes. It goes through
  // ipKeyGenerator so an IPv6 client cannot sidestep the limit by rotating
  // addresses within its own /56.
  keyGenerator: (req: Request) => req.user?.id ?? ipKeyGenerator(req.ip ?? 'unknown'),
  handler: (_req, res) =>
    errorResponse(
      res,
      'Too many submissions — please try again later',
      429,
    ),
});
