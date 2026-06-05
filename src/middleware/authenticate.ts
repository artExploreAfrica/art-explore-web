import { NextFunction, Request, Response } from 'express';
import { UnauthorizedError } from '../utils/AppError';
import { verifyAccessToken } from '../utils/jwtHelper';

/**
 * Verifies the Bearer access token and attaches `req.user`.
 * Chain `roleGuard(...)` after this on routes that need a specific role.
 */
export const authenticate = (req: Request, _res: Response, next: NextFunction): void => {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    throw UnauthorizedError('Missing or malformed Authorization header');
  }

  const token = header.slice('Bearer '.length).trim();

  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, email: payload.email, role: payload.role };
    next();
  } catch {
    throw UnauthorizedError('Invalid or expired access token');
  }
};
