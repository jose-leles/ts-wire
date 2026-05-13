# @ts-wire/swagger

Auto-generated OpenAPI 3.0 spec and Swagger UI for ts-wire.

```bash
npm install @ts-wire/swagger
```

---

## Setup

Call `setupSwagger` after `bootstrap` — no changes to controllers required.

```typescript
import { app } from '@ts-wire/core';
import { setupSwagger } from '@ts-wire/swagger';
import { UserController, OrderController } from './controllers';

const server = app.bootstrap({ controllers: [UserController, OrderController] });

setupSwagger(server, [UserController, OrderController], {
  title: 'My API',
  version: '1.0.0',
  description: 'User and order management',
  servers: [
    { url: 'https://api.example.com', description: 'Production' },
    { url: 'http://localhost:3000',   description: 'Local' },
  ],
});

// GET /api-docs      → OpenAPI JSON spec
// GET /api-docs/ui/  → Swagger UI
```

The spec is generated from your existing `@Controller`, `@Get`, `@Post`, etc. decorators — no annotations required.

---

## `@ApiDoc` — route-level metadata

Optional decorator to enrich a specific route:

```typescript
import { Get } from '@ts-wire/core';
import { ApiDoc } from '@ts-wire/swagger';

@Get('/:id')
@ApiDoc({
  summary: 'Get user by ID',
  description: 'Returns a single user. Returns 404 if not found.',
  tags: ['users'],
  deprecated: false,
  responses: {
    200: { description: 'User found' },
    404: { description: 'User not found' },
  },
})
getOne(req, res, components) { ... }
```

---

## `@ApiTag` — controller-level tag

Adds a tag to all routes in the controller. Multiple `@ApiTag` decorators are merged.

```typescript
import { Controller } from '@ts-wire/core';
import { ApiTag } from '@ts-wire/swagger';

@Controller('/users')
@ApiTag('users')
export class UserController { ... }

@Controller('/admin')
@ApiTag('admin')
@ApiTag('internal')
export class AdminController { ... }
```

Tags from `@ApiDoc` and `@ApiTag` are merged per route.

---

## Path params

Express `:param` syntax is automatically converted to OpenAPI `{param}` syntax with `in: path, required: true`.

```
GET /users/:id/posts/:postId
→
GET /users/{id}/posts/{postId}
```

---

## `setupSwagger` options

| Option | Type | Default |
|--------|------|---------|
| `title` | `string` | `'API'` |
| `version` | `string` | `'0.1.0'` |
| `description` | `string` | — |
| `servers` | `Array<{ url, description? }>` | `[]` |
