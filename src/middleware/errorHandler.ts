import { Prisma } from '@prisma/client';
import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { env } from '../config/env';
import { AppError } from '../utils/AppError';
import { errorResponse } from '../utils/response';

/**
 * Centralized error handler. Maps known error types to consistent JSON
 * responses and proper status codes. Never leaks stack traces in production.
 *
 * Must be registered LAST, after all routes.
 */
export const errorHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): Response => {
  // Zod validation errors → 400 with field-level detail.
  if (err instanceof ZodError) {
    const details = err.issues.map((i) => ({
      field: i.path.join('.'),
      message: i.message,
    }));
    return errorResponse(res, 'Validation failed', 400, details);
  }

  // Operational errors we threw deliberately.
  if (err instanceof AppError) {
    return errorResponse(res, err.message, err.statusCode, err.details);
  }

  // Known Prisma request errors.
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case 'P2002':
        return errorResponse(res, 'A record with that value already exists', 409, {
          target: err.meta?.target,
        });
      case 'P2025':
        return errorResponse(res, 'Record not found', 404);
      default:
        return errorResponse(res, 'Database request error', 400, { code: err.code });
    }
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    return errorResponse(res, 'Invalid data sent to the database', 400);
  }

  // Unknown / unexpected errors → 500. Log full error server-side only.
  console.error('Unhandled error:', err);
  const message =
    env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err instanceof Error
        ? err.message
        : 'Internal server error';

  return errorResponse(res, message, 500);
};

/** 404 fallback for unmatched routes. */
export const notFoundHandler = (req: Request, res: Response): Response =>
  errorResponse(res, `Route not found: ${req.method} ${req.originalUrl}`, 404);
