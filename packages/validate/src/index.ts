import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { Use } from '@ts-wire/core';

function httpError(status: number, message: string, details?: unknown): Error & { statusCode: number; details?: unknown } {
  const err = new Error(message) as Error & { statusCode: number; details?: unknown };
  err.statusCode = status;
  err.details = details;
  return err;
}

export function Validate(schema: ZodSchema, source: 'body' | 'query' | 'params' = 'body') {
  const middleware = (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const details = (result.error as ZodError).issues.map(i => ({
        field: i.path.join('.'),
        message: i.message,
      }));
      return next(httpError(400, 'Validation failed', details));
    }
    req[source] = result.data;
    next();
  };

  return Use(middleware);
}
