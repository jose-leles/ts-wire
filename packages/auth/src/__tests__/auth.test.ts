import request from 'supertest';
import jwt from 'jsonwebtoken';
import { Request, Response } from 'express';
import { TsBoot, Controller, Get } from '@ts-wire/core';
import { configureAuth, RequireAuth } from '@ts-wire/auth';

beforeAll(() => configureAuth({ secret: 'test-secret' }));
beforeEach(() => jest.spyOn(console, 'table').mockImplementation(() => {}));
afterEach(() => jest.restoreAllMocks());

function makeToken(payload = { id: 1, role: 'user' }) {
  return jwt.sign(payload, 'test-secret');
}

function boot(controllers: any[]) {
  return new TsBoot().bootstrap({ controllers });
}

// ── method-level @RequireAuth ───────────────────────────────────────────────
describe('@RequireAuth on method', () => {
  @Controller('/auth-method')
  class C {
    @Get('/protected')
    @RequireAuth()
    protected(_req: Request, res: Response) { res.json({ user: _req.user }); }

    @Get('/public')
    pub(_req: Request, res: Response) { res.json({ open: true }); }
  }

  const app = boot([C]);

  test('no token → 401', async () => {
    await request(app).get('/auth-method/protected').expect(401);
  });

  test('invalid token → 401', async () => {
    await request(app)
      .get('/auth-method/protected')
      .set('Authorization', 'Bearer bad.token.here')
      .expect(401);
  });

  test('valid token → 200 with user', async () => {
    const token = makeToken({ id: 7, role: 'admin' });
    const res = await request(app)
      .get('/auth-method/protected')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.user.id).toBe(7);
  });

  test('public route accessible without token', async () => {
    await request(app).get('/auth-method/public').expect(200, { open: true });
  });
});

// ── class-level @RequireAuth ────────────────────────────────────────────────
describe('@RequireAuth on class', () => {
  @Controller('/auth-class')
  @RequireAuth()
  class C {
    @Get('/a') a(_: Request, res: Response) { res.json({ a: true }); }
    @Get('/b') b(_: Request, res: Response) { res.json({ b: true }); }
  }

  const app = boot([C]);

  test('all routes blocked without token', async () => {
    await request(app).get('/auth-class/a').expect(401);
    await request(app).get('/auth-class/b').expect(401);
  });

  test('all routes accessible with valid token', async () => {
    const token = makeToken();
    await request(app).get('/auth-class/a').set('Authorization', `Bearer ${token}`).expect(200);
    await request(app).get('/auth-class/b').set('Authorization', `Bearer ${token}`).expect(200);
  });
});
