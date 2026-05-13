# @ts-wire/validate

Zod schema validation for ts-wire request body, query, and params.

```bash
npm install @ts-wire/validate zod
```

---

## `@Validate(schema, source?)`

Validates and replaces `req[source]` with the Zod-parsed output. Source defaults to `'body'`.

On failure → `400 Bad Request` with a `details` array of field errors.

---

## Examples

**Body validation (default):**

```typescript
// schemas/in/create-user.ts
import { z } from 'zod';
export const CreateUserSchema = z.object({
  name:  z.string().min(2),
  email: z.string().email(),
});
export type CreateUserInput = z.infer<typeof CreateUserSchema>;
```

```typescript
import { Controller, Post } from '@ts-wire/core';
import { Validate } from '@ts-wire/validate';
import { CreateUserSchema } from '../schemas/in/create-user';

@Controller('/users')
export class UserController {
  @Post('/')
  @Validate(CreateUserSchema)
  create(req: Request, res: Response, { userService }: Components) {
    // req.body is now typed as CreateUserInput
    const user = userService.create(req.body);
    res.status(201).json(user);
  }
}
```

**Query params:**

```typescript
const SearchSchema = z.object({
  q:     z.string().min(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

@Get('/search')
@Validate(SearchSchema, 'query')
search(req: Request, res: Response, { userService }: Components) {
  const { q, limit } = req.query as z.infer<typeof SearchSchema>;
  res.json(userService.search(q, limit));
}
```

**Path params:**

```typescript
const ParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

@Get('/:id')
@Validate(ParamsSchema, 'params')
getOne(req: Request, res: Response, { userService }: Components) {
  res.json(userService.findById(req.params.id as any));
}
```

---

## Error response

```json
{
  "error": "Validation failed",
  "details": [
    { "field": "email", "message": "Invalid email" },
    { "field": "name",  "message": "String must contain at least 2 character(s)" }
  ]
}
```
