/**
 * Operational error with an attached HTTP status code. Throw this from
 * services/controllers for expected failures (not found, forbidden, etc.);
 * the centralized error handler maps it to the standard error envelope.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly details?: unknown;

  constructor(message: string, statusCode = 400, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.details = details;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export const NotFoundError = (resource = 'Resource'): AppError =>
  new AppError(`${resource} not found`, 404);

export const UnauthorizedError = (message = 'Unauthorized'): AppError =>
  new AppError(message, 401);

export const ForbiddenError = (message = 'Forbidden'): AppError =>
  new AppError(message, 403);

export const ConflictError = (message = 'Conflict'): AppError =>
  new AppError(message, 409);
