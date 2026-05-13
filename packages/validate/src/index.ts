import { Request, Response, NextFunction } from 'express';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { Use } from '@ts-wire/core';

type Constructor<T = object> = new (...args: any[]) => T;

function httpError(status: number, message: string, details?: unknown): Error & { statusCode: number; details?: unknown } {
  const err = new Error(message) as Error & { statusCode: number; details?: unknown };
  err.statusCode = status;
  err.details = details;
  return err;
}

export function Validate<T extends object>(DtoClass: Constructor<T>, source: 'body' | 'query' | 'params' = 'body') {
  const middleware = async (req: Request, _res: Response, next: NextFunction) => {
    const instance = plainToInstance(DtoClass, req[source]);
    const errors = await validate(instance, { whitelist: true, forbidNonWhitelisted: false });

    if (errors.length > 0) {
      const details = errors.map(e => ({
        field: e.property,
        constraints: Object.values(e.constraints ?? {}),
      }));
      return next(httpError(400, 'Validation failed', details));
    }

    req[source] = instance as any;
    next();
  };

  return Use(middleware);
}
