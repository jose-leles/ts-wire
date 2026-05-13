# @ts-wire/auth

JWT Bearer token authentication for ts-wire.

```bash
npm install @ts-wire/auth
```

---

## Setup

Call `configureAuth` once at startup before `bootstrap`:

```typescript
import { configureAuth } from '@ts-wire/auth';

configureAuth({ secret: process.env.JWT_SECRET! });
```

---

## `@RequireAuth()`

Validates `Authorization: Bearer <token>` on every request. Apply at class or method level.

```typescript
import { Controller, Get } from '@ts-wire/core';
import { RequireAuth } from '@ts-wire/auth';

// protect entire controller
@Controller('/profile')
@RequireAuth()
export class ProfileController {
  @Get('/')
  get(req, res) {
    res.json(req.user); // decoded JWT payload
  }
}

// protect a single route
@Controller('/users')
export class UserController {
  @Get('/')
  list(req, res, components) { ... }

  @Delete('/:id')
  @RequireAuth()
  remove(req, res, components) { ... }
}
```

On failure → `401 Unauthorized`.

---

## Accessing the decoded token

The decoded JWT payload is attached to `req.user`:

```typescript
@Get('/me')
me(req: Request, res: Response) {
  const { sub, email, role } = req.user as { sub: string; email: string; role: string };
  res.json({ sub, email, role });
}
```

---

## Issuing tokens

`@ts-wire/auth` only handles verification. Issue tokens with `jsonwebtoken`:

```typescript
import jwt from 'jsonwebtoken';

const token = jwt.sign({ sub: user.id, email: user.email }, process.env.JWT_SECRET!, {
  expiresIn: '7d',
});
```
