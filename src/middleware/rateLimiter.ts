import rateLimit from 'express-rate-limit';
import { env } from '../config/env';
import { errorResponse } from '../utils/response';

/**
 * Brute-force protection for the auth endpoints (login/register/refresh/logout).
 * In-memory store — adequate for a single instance; front with a shared store
 * if the API is scaled horizontally. Disabled under NODE_ENV=test so the suite
 * stays deterministic.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 20, // per IP per window
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => env.NODE_ENV === 'test',
  handler: (_req, res) =>
    errorResponse(res, 'Too many requests — please try again later', 429),
});
