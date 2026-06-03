import { Role } from '@prisma/client';
import { NextFunction, Request, Response } from 'express';
import { ForbiddenError, UnauthorizedError } from '../utils/AppError';

/**
 * Role-based access guard. Use after `authenticate`.
 *   roleGuard('SUPER_ADMIN')          — super admin only
 *   roleGuard('SUPER_ADMIN', 'ADMIN') — either role
 */
export const roleGuard =
  (...allowed: Role[]) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw UnauthorizedError('Authentication required');
    }
    if (!allowed.includes(req.user.role)) {
      throw ForbiddenError('You do not have permission to perform this action');
    }
    next();
  };

/** Convenience guards matching the Guide's naming (§3.3). */
export const isSuperAdmin = roleGuard(Role.SUPER_ADMIN);
export const isAdmin = roleGuard(Role.SUPER_ADMIN, Role.ADMIN);
