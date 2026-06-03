import { NextFunction, Request, Response } from 'express';
import { ZodTypeAny } from 'zod';

interface ValidationSchemas {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
}

/**
 * Validates request body/query/params against Zod schemas before the
 * controller runs. Parsed (and coerced) values replace the originals so
 * controllers receive clean, typed data. ZodErrors are forwarded to the
 * centralized error handler.
 */
export const validate =
  (schemas: ValidationSchemas) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (schemas.body) req.body = schemas.body.parse(req.body);
      if (schemas.query) {
        // req.query is read-only in newer Express typings; mutate in place.
        Object.assign(req.query, schemas.query.parse(req.query));
      }
      if (schemas.params) {
        Object.assign(req.params, schemas.params.parse(req.params));
      }
      next();
    } catch (err) {
      next(err);
    }
  };
