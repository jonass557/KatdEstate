import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';

export function validateRequest(
  schema: ZodType,
  source: 'body' | 'query' | 'params' = 'body',
): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      next(result.error);
      return;
    }
    req[source] = result.data;
    next();
  };
}
