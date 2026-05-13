# ts-wire

**TypeScript + Express decorator framework — clean, simple, vibe-coding ready**

![npm version](https://img.shields.io/npm/v/@ts-wire/core?style=flat-square)
![GitHub stars](https://img.shields.io/github/stars/joseb/ts-wire?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)

---

## What

ts-wire wraps Express with TC39 Stage 3 decorators (no `experimentalDecorators`, no `reflect-metadata` needed). The library owns the **communication layer** — routing, middleware, auth, validation, caching. You own **business logic and output**.

Built for vibe coding: describe what you want, get working routes.

---

## Install

```bash
npm install @ts-wire/core
```

All other packages are optional — install only what you use.

---

## Quick Start

```typescript
// controllers/post.controller.ts
import { Controller, Post, Get, With } from '@ts-wire/core';
import { RequireAuth } from '@ts-wire/auth';
import { Validate } from '@ts-wire/validate';
import { Cache } from '@ts-wire/cache';
import { z } from 'zod';
import type { Request, Response } from 'express';
import type { Container } from '../infra/container';

const CreatePostSchema = z.object({
  title: z.string().min(1),
  body:  z.string().min(1),
});

@Controller('/posts')
@RequireAuth()
@With({ rateLimit: 100 })
export class PostController {
  @Get('/')
  @Cache({ ttlMs: 30_000 })
  list(req: Request, res: Response, { postService }: Container) {
    res.json(postService.findAll());
  }

  @Post('/')
  @Validate(CreatePostSchema)
  create(req: Request, res: Response, { postService }: Container) {
    const post = postService.create(req.body); // body is typed + validated
    res.status(201).json(post);
  }
}
```

```typescript
// index.ts
import { app } from '@ts-wire/core';
import { configureAuth } from '@ts-wire/auth';
import { PostController } from './controllers/post.controller';
import { container } from './infra/container';

configureAuth({ secret: process.env.JWT_SECRET! });

const server = app.bootstrap({
  controllers: [PostController],
  components: container,
});

server.listen(3000, () => console.log('http://localhost:3000'));
```

---

## Architecture

ts-wire only touches the **Controller** layer. Services and infra are plain classes — no decorators, no magic.

```
Controller  →  HTTP input/output             (@ts-wire handles this)
Service     →  business logic (plain class)  (you write this)
Infra       →  DB, email, S3 (plain class)   (you write this)
```

Wire dependencies manually with a container — explicit, easy to test, easy to trace:

```typescript
// infra/container.ts
const db    = new DatabaseClient(process.env.DATABASE_URL!);
const email = new EmailService(process.env.SMTP_KEY!);

export const container = {
  db,
  email,
  userService: new UserService(db, email),
} as const;

export type Container = typeof container;
```

```typescript
// index.ts
app.bootstrap({
  controllers: [UserController],
  components: container,   // passed as 3rd arg to every handler
});
```

---

## Packages

| Package | Install | Description |
|---------|---------|-------------|
| `@ts-wire/core` | `npm i @ts-wire/core` | `@Controller`, HTTP decorators, `@With`, `@Use`, `TsBoot` |
| `@ts-wire/errors` | `npm i @ts-wire/errors` | `NotFound`, `BadRequest`, `Unauthorized`, `Forbidden`, `Conflict`, `UnprocessableEntity`, `TooManyRequests`, `InternalError` |
| `@ts-wire/auth` | `npm i @ts-wire/auth` | `@RequireAuth()`, `configureAuth({ secret })` — JWT via Bearer token |
| `@ts-wire/validate` | `npm i @ts-wire/validate` | `@Validate(ZodSchema, source?)` — Zod validation on body / query / params |
| `@ts-wire/cache` | `npm i @ts-wire/cache` | `@Cache({ ttlMs, key?, store? })`, `@Idempotent({ header?, ttlMs? })` |
| `@ts-wire/storage` | `npm i @ts-wire/storage` | `@RequireFile({ field?, maxSizeMb?, allowedTypes? })` — multer upload |
| `@ts-wire/rate-limit` | `npm i @ts-wire/rate-limit` | `@RateLimit({ max?, windowMs?, message? })` — express-rate-limit wrapper |
| `@ts-wire/socket` | `npm i @ts-wire/socket` | `@SocketController`, `@OnEvent`, `@OnConnect`, `@OnDisconnect`, `SocketService` |
| `@ts-wire/scheduler` | `npm i @ts-wire/scheduler` | `@Scheduler`, `@Cron('* * * * *')`, `TsScheduler` |
| `@ts-wire/swagger` | `npm i @ts-wire/swagger` | `@ApiDoc({ summary })`, `@ApiTag(tag)`, `setupSwagger(app, controllers)` |
| `@ts-wire/testing` | `npm i -D @ts-wire/testing` | `createTestApp(options)`, `mockComponents(overrides)` — supertest wrapper |

---

## Core API

### `@Controller(basePath)`

Marks a class as a route controller and sets the base path.

```typescript
@Controller('/users')
export class UserController { ... }
```

### HTTP method decorators

`@Get`, `@Post`, `@Put`, `@Patch`, `@Delete` — all accept a path string.

```typescript
@Get('/:id')
getOne(req: Request, res: Response, { userService }: Container) {
  res.json(userService.findById(Number(req.params.id)));
}
```

### `@With(components)`

Inject additional components into specific routes (merged with global container).
Class-level applies to all routes; method-level merges; route-level wins on conflicts.

```typescript
@Controller('/admin')
@With({ adminService })       // available on every route
export class AdminController {
  @Get('/stats')
  @With({ statsService })     // merged for this route only
  stats(req, res, { adminService, statsService }: any) { ... }
}
```

### `@Use(...middlewares)`

Attach Express middlewares. Stacks the same way as `@With` — class-level runs first, then route-level.

```typescript
@Controller('/api')
@Use(logger)
export class ApiController {
  @Post('/secret')
  @Use(rateLimiter)
  secret(req, res, components) { ... }
}
```

### `@RequireAuth()` (`@ts-wire/auth`)

Validates `Authorization: Bearer <token>`. Can be placed on the class (all routes) or a single method.

```typescript
configureAuth({ secret: process.env.JWT_SECRET! });

@Controller('/profile')
@RequireAuth()
export class ProfileController { ... }
```

### `@Validate(schema, source?)` (`@ts-wire/validate`)

Validates and replaces `req.body` (default) with the parsed Zod output. Pass `'query'` or `'params'` to validate other sources.

```typescript
const Schema = z.object({ name: z.string() });

@Post('/')
@Validate(Schema)
create(req: Request, res: Response, components) {
  // req.body is typed and extra fields are stripped
}
```

### `@Cache({ ttlMs, key?, store? })` (`@ts-wire/cache`)

Caches the response. Default key: `METHOD:URL`. Provide a `key` function for custom cache keys.

```typescript
@Get('/')
@Cache({ ttlMs: 60_000 })
list(req, res, components) { ... }
```

### `@Idempotent({ header?, ttlMs? })` (`@ts-wire/cache`)

Reads the `Idempotency-Key` header and returns the stored response if the key has been seen before.

```typescript
@Post('/payments')
@Idempotent({ ttlMs: 86_400_000 })
pay(req, res, components) { ... }
```

### Error classes (`@ts-wire/errors`)

Throw these anywhere — the built-in error handler serializes them with the correct HTTP status code.

```typescript
import { NotFound, BadRequest, Unauthorized } from '@ts-wire/errors';

throw new NotFound('User not found');
throw new BadRequest('Invalid input');
throw new Unauthorized('Token expired');
```

---

## Testing

`createTestApp` boots a fresh Express instance without starting a server — wraps it with supertest.

```typescript
import { createTestApp, mockComponents } from '@ts-wire/testing';
import { UserController } from '../controllers/user.controller';
import { UserService } from '../services/user.service';

const mockUserService = {
  findAll: () => [{ id: 1, name: 'Alice' }],
  findById: (id: number) => ({ id, name: 'Alice' }),
};

const request = createTestApp({
  controllers: [UserController],
  components: mockComponents({ userService: mockUserService }),
});

it('GET /users returns list', async () => {
  const res = await request.get('/users');
  expect(res.status).toBe(200);
  expect(res.body).toHaveLength(1);
});
```

---

## Handler Signature

Every route handler receives **three arguments** (four if you need `next`):

```typescript
(req: Request, res: Response, components: YourComponents, next?: NextFunction) => void
```

`components` is the merged result of `bootstrap({ components })`, `@With`, and `@With` on the class. Destructure what you need:

```typescript
@Get('/:id')
getOne(req: Request, res: Response, { userService }: Container) {
  res.json(userService.findById(Number(req.params.id)));
}
```

---

## tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "ESNext"]
  }
}
```

**Do not** add `experimentalDecorators` or `emitDecoratorMetadata`. ts-wire uses the TC39 Stage 3 decorator API natively supported in TypeScript 5.x.

---

## License

MIT
