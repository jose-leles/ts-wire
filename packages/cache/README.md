# @ts-wire/cache

In-memory response caching and idempotency for ts-wire.

```bash
npm install @ts-wire/cache
```

---

## `@Cache(options)`

Caches the response for a given TTL. Subsequent requests with the same cache key return the cached response without calling the handler.

```typescript
import { Controller, Get } from '@ts-wire/core';
import { Cache } from '@ts-wire/cache';

@Controller('/products')
export class ProductController {
  @Get('/')
  @Cache({ ttlMs: 30_000 })  // cache for 30 seconds
  list(req, res, { productService }: Components) {
    res.json(productService.findAll());
  }
}
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `ttlMs` | `number` | required | Cache TTL in milliseconds |
| `key` | `(req) => string` | `req.method + req.originalUrl` | Custom cache key function |
| `store` | `CacheStore` | in-memory | Custom store (e.g. Redis adapter) |

**Custom key:**

```typescript
@Get('/:id')
@Cache({ ttlMs: 60_000, key: (req) => `product:${req.params.id}` })
getOne(req, res, components) { ... }
```

---

## `@Idempotent(options)`

Prevents duplicate processing of POST/PUT requests. On the first call the response is stored; repeated calls with the same idempotency key return the stored response.

By default reads the `Idempotency-Key` header.

```typescript
import { Controller, Post } from '@ts-wire/core';
import { Idempotent } from '@ts-wire/cache';

@Controller('/payments')
export class PaymentController {
  @Post('/')
  @Idempotent({ ttlMs: 86_400_000 })  // 24 hours
  pay(req, res, { paymentService }: Components) {
    const result = paymentService.charge(req.body);
    res.status(201).json(result);
  }
}
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `ttlMs` | `number` | `86_400_000` | Key TTL (24h) |
| `header` | `string` | `'Idempotency-Key'` | Request header to read the key from |
| `store` | `CacheStore` | in-memory | Custom store |

---

## Custom store

Implement `CacheStore` to plug in Redis or any other backend:

```typescript
import type { CacheStore } from '@ts-wire/cache';

const redisStore: CacheStore = {
  get: (key) => redis.get(key).then((v) => v ? JSON.parse(v) : undefined),
  set: (key, value, ttlMs) => redis.set(key, JSON.stringify(value), 'PX', ttlMs),
};

@Cache({ ttlMs: 60_000, store: redisStore })
```
