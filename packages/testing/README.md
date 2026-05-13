# @ts-wire/testing

Test utilities for ts-wire. Wraps supertest for integration testing controllers without spinning up a real server.

```bash
npm install -D @ts-wire/testing
```

---

## `createTestApp(options)`

Creates a supertest-wrapped Express app with your controllers and mock components.

```typescript
import { createTestApp } from '@ts-wire/testing';
import { UserController } from '../controllers/user.controller';

const mockUserService = {
  findAll:  () => [{ id: 1, name: 'Alice' }],
  findById: (id: number) => ({ id, name: 'Alice' }),
  create:   (data: any) => ({ id: 2, ...data }),
};

const api = createTestApp({
  controllers: [UserController],
  components: { userService: mockUserService },
});
```

---

## Examples

```typescript
it('GET /users returns list', async () => {
  const res = await api.get('/users').expect(200);
  expect(res.body).toHaveLength(1);
});

it('GET /users/:id returns user', async () => {
  const res = await api.get('/users/1').expect(200);
  expect(res.body.name).toBe('Alice');
});

it('POST /users creates user', async () => {
  const res = await api
    .post('/users')
    .send({ name: 'Bob', email: 'bob@example.com' })
    .expect(201);
  expect(res.body.name).toBe('Bob');
});

it('returns 404 for unknown user', async () => {
  const res = await api.get('/users/999').expect(404);
  expect(res.body.error).toBe('User not found');
});
```

---

## `mockComponents(overrides)`

Creates a fully-typed partial mock of your components object. Useful when you only need to override a few methods:

```typescript
import { mockComponents } from '@ts-wire/testing';
import { components } from '../components';

const mock = mockComponents(components, {
  userService: {
    findAll: () => [],
  },
});

const api = createTestApp({ controllers: [UserController], components: mock });
```

---

## Testing with auth

Pass auth headers directly:

```typescript
import jwt from 'jsonwebtoken';

const token = jwt.sign({ sub: '1', role: 'admin' }, 'test-secret');

const api = createTestApp({
  controllers: [ProfileController],
  components,
  authSecret: 'test-secret',
});

const res = await api
  .get('/profile')
  .set('Authorization', `Bearer ${token}`)
  .expect(200);
```
