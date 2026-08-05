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
        // Clear first rather than merging: keys the schema stripped must not
        // survive, or an attacker could vary junk params to make every request
        // a unique response-cache key (see utils/institutionCache).
        const parsed = schemas.query.parse(req.query);
        const query = req.query as Record<string, unknown>;
        for (const key of Object.keys(query)) delete query[key];
        Object.assign(query, parsed);
      }
      if (schemas.params) {
        Object.assign(req.params, schemas.params.parse(req.params));
      }
      next();
    } catch (err) {
      next(err);
    }
  };
