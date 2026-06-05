import { NextFunction, Request, Response } from 'express';

/**
 * Lightweight request logger — method, path, status, and duration.
 * Intentionally simple; no third-party logging dependency.
 */
export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const start = process.hrtime.bigint();

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
    console.log(
      `${req.method} ${req.originalUrl} ${res.statusCode} ${durationMs.toFixed(1)}ms`,
    );
  });

  next();
};
