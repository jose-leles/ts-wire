import { Request, Response, NextFunction } from 'express';
import { Use } from '@ts-wire/core';
import { CacheStore, defaultStore } from './store';

export type { CacheStore };
export { MemoryStore } from './store';

export interface CacheOptions {
  ttlMs?: number;
  key?: (req: Request) => string;
  store?: CacheStore;
}

export function Cache(options: CacheOptions = {}) {
  const { ttlMs = 60_000, key, store = defaultStore } = options;

  const middleware = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const cacheKey = key ? key(req) : `${req.method}:${req.originalUrl}`;
    const cached = await store.get(cacheKey);

    if (cached !== undefined) {
      res.json(cached);
      return;
    }

    const originalJson = res.json.bind(res);
    res.json = (body: unknown) => {
      store.set(cacheKey, body, ttlMs).catch(() => {});
      return originalJson(body);
    };

    next();
  };

  return Use(middleware);
}

export interface IdempotentOptions {
  header?: string;
  ttlMs?: number;
  store?: CacheStore;
}

export function Idempotent(options: IdempotentOptions = {}) {
  const { header = 'idempotency-key', ttlMs = 86_400_000, store = defaultStore } = options;

  const middleware = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const idempotencyKey = req.headers[header] as string | undefined;
    if (!idempotencyKey) return next();

    const storeKey = `idempotent:${idempotencyKey}`;
    const cached = await store.get(storeKey) as { status: number; body: unknown } | undefined;

    if (cached) {
      res.status(cached.status).json(cached.body);
      return;
    }

    const originalJson = res.json.bind(res);
    res.json = (body: unknown) => {
      store.set(storeKey, { status: res.statusCode, body }, ttlMs).catch(() => {});
      return originalJson(body);
    };

    next();
  };

  return Use(middleware);
}
