# @ts-wire/errors

HTTP error classes for ts-wire. Throw anywhere — the built-in error handler serializes them with the correct HTTP status.

```bash
npm install @ts-wire/errors
```

---

## Usage

```typescript
import { NotFound, BadRequest, Unauthorized, Forbidden, Conflict, UnprocessableEntity, TooManyRequests, InternalError } from '@ts-wire/errors';

// throw from a controller or service
throw new NotFound('User not found');          // 404
throw new BadRequest('Invalid payload');       // 400
throw new Unauthorized('Token expired');       // 401
throw new Forbidden('Access denied');          // 403
throw new Conflict('Email already in use');    // 409
throw new UnprocessableEntity('Invalid data'); // 422
throw new TooManyRequests('Slow down');        // 429
throw new InternalError('Something failed');   // 500
```

Errors with structured details:

```typescript
throw new BadRequest('Validation failed', [
  { field: 'email', message: 'Invalid email' },
  { field: 'name',  message: 'Too short' },
]);
```

Response shape:

```json
{
  "error": "Validation failed",
  "details": [
    { "field": "email", "message": "Invalid email" }
  ]
}
```

---

## Custom errors

```typescript
import { HttpError } from '@ts-wire/errors';

export class PaymentRequired extends HttpError {
  constructor(message = 'Payment required') {
    super(402, message);
  }
}
```
