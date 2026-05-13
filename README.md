<p align="center">
  <img src=".github/logo.svg" width="100" alt="ts-wire" />
</p>

<h1 align="center">ts-wire</h1>

<p align="center">
  <a href="https://www.npmjs.com/package/@ts-wire/core"><img src="https://img.shields.io/npm/v/@ts-wire/core?style=flat-square" alt="npm version" /></a>
  <a href="https://github.com/jose-leles/ts-wire"><img src="https://img.shields.io/github/stars/jose-leles/ts-wire?style=flat-square" alt="GitHub stars" /></a>
  <img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="License" />
</p>

---

## What

Stop wiring Express by hand.

ts-wire gives you decorator-driven routing, auth, validation, caching, sockets, and cron jobs — all from the same mental model. Describe what you want, get working routes.

Built on TC39 Stage 3 decorators — no `experimentalDecorators`, no `reflect-metadata`, no legacy flags. TypeScript 5.x native, works out of the box.

NestJS power without the complexity: no module system, no circular dependency hell, no magic DI container. One `components.ts` wires everything — read it top to bottom and every dependency is explicit.

---

## Install

```bash
npm install @ts-wire/core
```

All other packages are optional — install only what you use.

---

## Quick Start

```typescript
import { app, Controller, Get, Post } from '@ts-wire/core';
import type { Request, Response } from 'express';

@Controller('/users')
class UserController {
  @Get('/')
  list(_req: Request, res: Response) {
    res.json([{ id: 1, name: 'Alice' }]);
  }

  @Post('/')
  create(req: Request, res: Response) {
    res.status(201).json({ id: 2, ...req.body });
  }
}

app.bootstrap({ controllers: [UserController] }).listen(3000);
```

That's it. No router setup, no `app.use`, no middleware plumbing.

---

## Real world

Same mental model — just add decorators as you need them.

```typescript
// components.ts
import { UserService } from './services/user.service';

export const components = { userService: new UserService() } as const;
export type Components = typeof components;
```

```typescript
// controllers/user.controller.ts
@Controller('/users')
@RequireAuth()
@With(components)
export class UserController {
  @Get('/')
  list(_req: Request, res: Response, { userService }: Components) {
    res.json(userService.findAll());
  }

  @Post('/')
  @Validate(CreateUserSchema)
  create(req: Request, res: Response, { userService }: Components) {
    res.status(201).json(userService.create(req.body));
  }
}
```

```typescript
// index.ts
configureAuth({ secret: process.env.JWT_SECRET! });
app.bootstrap({ controllers: [UserController], components }).listen(3000);
```

---

## Architecture

ts-wire handles every **entry point** — the channel that triggers your logic. Business logic lives in services and knows nothing about channels.

```
Entry Points (ts-wire handles):
  controllers/    ← triggered by HTTP
  schedulers/     ← triggered by time (cron)
  consumers/      ← triggered by message queue

Business Logic:
  services/       ← domain logic, channel-agnostic

Infrastructure (via components):
  DB clients, queue producers, email senders, external APIs

Schemas:
  schemas/in/     ← input validation per channel (Zod)
  schemas/models/ ← domain types (what services work with)
  schemas/out/    ← output types (response shapes, published events)
```

**The key rule:** services only know `models/`. Entry points map their input format → domain model before calling the service. The same `UserService` is callable from an HTTP controller, a cron job, or a queue consumer.

```
HTTP req → @Validate(CreateUserSchema)   (in/)
         → controller maps to UserModel  (models/)
         → userService.create(model)
         → service publishes event        (via components.queue)
         → controller maps to response   (out/)
         → res.json(response)
```

### components.ts

Wire all dependencies in one explicit file. No magic DI — you control construction order and can trace every dependency by reading one file.

```typescript
// components.ts
import { DatabaseClient } from './infra/database';
import { QueueClient }    from './infra/queue';
import { EmailService }   from './infra/email';
import { UserService }    from './services/user.service';
import { OrderService }   from './services/order.service';

const db    = new DatabaseClient(process.env.DATABASE_URL!);
const queue = new QueueClient(process.env.QUEUE_URL!);
const email = new EmailService(process.env.SMTP_KEY!);

export const components = {
  db,
  queue,   // producer — called from services
  email,
  userService:  new UserService(db, queue, email),
  orderService: new OrderService(db, queue),
} as const;

export type Components = typeof components;
```

```typescript
// index.ts
app.bootstrap({
  controllers: [UserController, OrderController],
  components,
});
```

### Multiple entry points, same service

```typescript
// controllers/user.controller.ts — HTTP trigger
@Controller('/users')
export class UserController {
  @Post('/') @Validate(RegisterSchema)
  register(req, res, { userService }: Components) {
    const user = await userService.register(req.body);
    res.status(201).json(user);
  }
}

// consumers/user.consumer.ts — queue trigger
@Consumer('user.import')
export class UserImportConsumer {
  @OnMessage()
  async handle(msg, { userService }: Components) {
    await userService.register(msg.payload);
  }
}

// schedulers/user.scheduler.ts — time trigger
@Scheduler()
export class UserScheduler {
  @Cron('0 2 * * *', { name: 'cleanup-inactive' })
  async cleanup({ userService }: Components) {
    await userService.removeInactive({ olderThanDays: 90 });
  }
}
```

---

## Packages

| Package | Install | Docs |
|---------|---------|------|
| `@ts-wire/core` | `npm i @ts-wire/core` | this file |
| `@ts-wire/errors` | `npm i @ts-wire/errors` | [→ docs](packages/errors/README.md) |
| `@ts-wire/auth` | `npm i @ts-wire/auth` | [→ docs](packages/auth/README.md) |
| `@ts-wire/validate` | `npm i @ts-wire/validate` | [→ docs](packages/validate/README.md) |
| `@ts-wire/cache` | `npm i @ts-wire/cache` | [→ docs](packages/cache/README.md) |
| `@ts-wire/storage` | `npm i @ts-wire/storage` | [→ docs](packages/storage/README.md) |
| `@ts-wire/rate-limit` | `npm i @ts-wire/rate-limit` | [→ docs](packages/rate-limit/README.md) |
| `@ts-wire/socket` | `npm i @ts-wire/socket` | [→ docs](packages/socket/README.md) |
| `@ts-wire/scheduler` | `npm i @ts-wire/scheduler` | [→ docs](packages/scheduler/README.md) |
| `@ts-wire/swagger` | `npm i @ts-wire/swagger` | [→ docs](packages/swagger/README.md) |
| `@ts-wire/testing` | `npm i -D @ts-wire/testing` | [→ docs](packages/testing/README.md) |

---

## Core API

### `@Controller(basePath)`

```typescript
@Controller('/users')
export class UserController { ... }
```

### HTTP decorators — `@Get` `@Post` `@Put` `@Patch` `@Delete`

```typescript
@Get('/:id')
getOne(req: Request, res: Response, { userService }: Components) {
  res.json(userService.findById(Number(req.params.id)));
}
```

### `@With(components)`

Injects components into a controller (all routes) or a single route. Method-level merges with class-level; conflicts resolved in favor of the inner decorator.

```typescript
@Controller('/admin')
@With({ adminService: components.adminService })
export class AdminController {
  @Get('/report')
  @With({ reportService: components.reportService })
  report(req, res, { adminService, reportService }: any) { ... }
}
```

### `@Use(middleware)`

Attaches Express middleware. Class-level runs before route-level.

```typescript
@Controller('/api')
@Use(requestLogger)
export class ApiController {
  @Post('/upload')
  @Use(antiVirusMiddleware)
  upload(req, res, components) { ... }
}
```

### `@RequireAuth()` — `@ts-wire/auth`

Validates `Authorization: Bearer <token>`. Class or method level.

```typescript
configureAuth({ secret: process.env.JWT_SECRET! });

@Controller('/profile')
@RequireAuth()
export class ProfileController { ... }
```

### `@Validate(schema, source?)` — `@ts-wire/validate`

Validates and replaces `req[source]` with the Zod-parsed output. Source defaults to `'body'`.

```typescript
// schemas/in/update-user.ts
export const UpdateUserSchema = z.object({ name: z.string().min(2) });

// controller
@Put('/:id')
@Validate(UpdateUserSchema)
update(req: Request, res: Response, { userService }: Components) {
  const user = userService.update(Number(req.params.id), req.body);
  res.json(user);
}
```

### `@Cache` and `@Idempotent` — `@ts-wire/cache`

```typescript
@Get('/')
@Cache({ ttlMs: 60_000 })
list(req, res, components) { ... }

@Post('/payments')
@Idempotent({ ttlMs: 86_400_000 })
pay(req, res, components) { ... }
```

### `@RateLimit` — `@ts-wire/rate-limit`

```typescript
@Controller('/api')
@RateLimit({ max: 100, windowMs: 60_000 })
export class ApiController { ... }
```

### Swagger — `@ts-wire/swagger`

Auto-generates OpenAPI 3.0 spec from your existing decorators. Call `setupSwagger` after bootstrap — no changes to controllers required. `@ApiDoc` and `@ApiTag` are optional enhancements.

```typescript
import { setupSwagger } from '@ts-wire/swagger';

const server = app.bootstrap({ controllers });
setupSwagger(server, controllers, { title: 'My API', version: '1.0.0' });

// GET /api-docs      → OpenAPI JSON spec
// GET /api-docs/ui/  → Swagger UI
```

### Error classes — `@ts-wire/errors`

Throw anywhere — the built-in error handler serializes them with the correct HTTP status.

```typescript
import { NotFound, BadRequest, Unauthorized } from '@ts-wire/errors';

throw new NotFound('User not found');       // → 404
throw new BadRequest('Invalid payload');    // → 400
throw new Unauthorized('Token expired');    // → 401
```

---

## Testing

```typescript
import { createTestApp } from '@ts-wire/testing';
import { UserController } from '../controllers/user.controller';

const mockUserService = {
  findAll: () => [{ id: 1, name: 'Alice' }],
  findById: (id: number) => ({ id, name: 'Alice' }),
};

const api = createTestApp({
  controllers: [UserController],
  components: { userService: mockUserService },
});

it('GET /users returns list', async () => {
  const res = await api.get('/users');
  expect(res.status).toBe(200);
  expect(res.body).toHaveLength(1);
});
```

---

## Handler Signature

```typescript
(req: Request, res: Response, components: YourComponents, next?: NextFunction) => void
```

`components` is the merged result of `bootstrap({ components })` + class-level `@With` + method-level `@With`. Destructure what the handler needs:

```typescript
@Get('/:id')
getOne(req: Request, res: Response, { userService }: Components) {
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

Do **not** add `experimentalDecorators` or `emitDecoratorMetadata` — ts-wire uses the TC39 Stage 3 decorator API natively supported in TypeScript 5.x.

---

## License

MIT
