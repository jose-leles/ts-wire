# @ts-wire/rate-limit

Rate limiting for ts-wire via express-rate-limit.

```bash
npm install @ts-wire/rate-limit
```

---

## `@RateLimit(options?)`

Limits the number of requests per IP within a time window. Apply at class or method level.

On limit reached → `429 Too Many Requests`.

---

## Examples

**Controller-level (all routes):**

```typescript
import { Controller, Get, Post } from '@ts-wire/core';
import { RateLimit } from '@ts-wire/rate-limit';

@Controller('/api')
@RateLimit({ max: 100, windowMs: 60_000 })  // 100 req/min per IP
export class ApiController {
  @Get('/') list(req, res, components) { ... }
  @Post('/') create(req, res, components) { ... }
}
```

**Route-level (stricter on sensitive routes):**

```typescript
@Controller('/auth')
export class AuthController {
  @Post('/login')
  @RateLimit({ max: 5, windowMs: 60_000, message: 'Too many login attempts' })
  login(req, res, components) { ... }
}
```

---

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `max` | `number` | `60` | Max requests per window |
| `windowMs` | `number` | `60_000` | Time window in ms |
| `message` | `string` | `'Too many requests'` | Error message |
| `keyGenerator` | `(req) => string` | IP address | Custom key function |
| `skipSuccessfulRequests` | `boolean` | `false` | Only count failed requests |

---

## Custom key

Rate-limit by authenticated user instead of IP:

```typescript
@RateLimit({
  max: 1000,
  windowMs: 3_600_000,
  keyGenerator: (req) => req.user?.sub ?? req.ip,
})
```
