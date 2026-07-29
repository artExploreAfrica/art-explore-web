import { NextFunction, Request, Response } from 'express';
import prisma from '../config/db';
import { asyncHandler } from '../utils/asyncHandler';
import { UnauthorizedError } from '../utils/AppError';
import { verifyAccessToken } from '../utils/jwtHelper';

/**
 * Verifies the Bearer access token, re-loads the user from the DB (so
 * deactivation / role changes take effect immediately), and attaches `req.user`.
 * Chain `roleGuard(...)` after this on routes that need a specific role.
 */
export const authenticate = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction) => {
    const header = req.headers.authorization;

    if (!header || !header.startsWith('Bearer ')) {
      throw UnauthorizedError('Missing or malformed Authorization header');
    }

    const token = header.slice('Bearer '.length).trim();

    let userId: string;
    try {
      const payload = verifyAccessToken(token);
      userId = payload.sub;
    } catch {
      throw UnauthorizedError('Invalid or expired access token');
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, role: true, isActive: true },
    });

    if (!user || !user.isActive) {
      throw UnauthorizedError('Invalid or expired access token');
    }

    // Prefer DB role/email over JWT claims so role changes apply without re-login.
    req.user = { id: user.id, email: user.email, role: user.role };
    next();
  },
);
