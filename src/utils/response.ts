import { Response } from 'express';

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/**
 * Consistent success envelope: { success, message, data, pagination? }.
 * Never return raw Prisma results directly — always pass through this helper.
 */
export const successResponse = <T>(
  res: Response,
  data: T,
  message = 'Success',
  statusCode = 200,
  pagination?: PaginationMeta,
): Response => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    ...(pagination && { pagination }),
  });
};

/**
 * Consistent error envelope: { success, message, errors? }.
 * Primarily used by the centralized error handler.
 */
export const errorResponse = (
  res: Response,
  message = 'Error',
  statusCode = 400,
  errors?: unknown,
): Response => {
  return res.status(statusCode).json({
    success: false,
    message,
    ...(errors !== undefined && errors !== null ? { errors } : {}),
  });
};
