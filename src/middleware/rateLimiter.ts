import rateLimit from 'express-rate-limit';
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
