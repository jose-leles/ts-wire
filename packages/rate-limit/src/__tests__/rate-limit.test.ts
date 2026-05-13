import request from 'supertest';
import { Request, Response } from 'express';
import { TsBoot, Controller, Get, Post } from '@ts-wire/core';
import { RateLimit } from '@ts-wire/rate-limit';

beforeEach(() => jest.spyOn(console, 'table').mockImplementation(() => {}));
afterEach(() => jest.restoreAllMocks());

function boot(controllers: any[]) {
  return new TsBoot().bootstrap({ controllers });
}

// ── method-level @RateLimit ────────────────────────────────────────────────
describe('@RateLimit on method', () => {
  @Controller('/rl-method')
  class C {
    @Get('/limited')
    @RateLimit({ max: 2, windowMs: 60_000 })
    limited(_req: Request, res: Response) { res.json({ ok: true }); }

    @Get('/unlimited')
    unlimited(_req: Request, res: Response) { res.json({ open: true }); }
  }

  const app = boot([C]);

  test('requests below limit → 200', async () => {
    await request(app).get('/rl-method/limited').expect(200, { ok: true });
    await request(app).get('/rl-method/limited').expect(200, { ok: true });
  });

  test('request exceeding limit → 429', async () => {
    // first two are fine (already used above; each test gets a fresh app instance
    // but express-rate-limit uses in-memory store keyed by IP, so create a fresh app)
    @Controller('/rl-method-429')
    class D {
      @Get('/limited')
      @RateLimit({ max: 2, windowMs: 60_000 })
      limited(_req: Request, res: Response) { res.json({ ok: true }); }
    }

    const freshApp = boot([D]);
    await request(freshApp).get('/rl-method-429/limited').expect(200);
    await request(freshApp).get('/rl-method-429/limited').expect(200);
    await request(freshApp).get('/rl-method-429/limited').expect(429);
  });

  test('method-level decorator does not block sibling route', async () => {
    @Controller('/rl-method-sibling')
    class E {
      @Get('/limited')
      @RateLimit({ max: 2, windowMs: 60_000 })
      limited(_req: Request, res: Response) { res.json({ ok: true }); }

      @Get('/open')
      open(_req: Request, res: Response) { res.json({ open: true }); }
    }

    const freshApp = boot([E]);
    // exhaust the limit on /limited
    await request(freshApp).get('/rl-method-sibling/limited').expect(200);
    await request(freshApp).get('/rl-method-sibling/limited').expect(200);
    await request(freshApp).get('/rl-method-sibling/limited').expect(429);
    // /open is not affected
    await request(freshApp).get('/rl-method-sibling/open').expect(200, { open: true });
  });
});

// ── class-level @RateLimit ─────────────────────────────────────────────────
describe('@RateLimit on class', () => {
  test('class-level decorator blocks all routes when limit exceeded', async () => {
    @Controller('/rl-class')
    @RateLimit({ max: 2, windowMs: 60_000 })
    class F {
      @Get('/a') a(_: Request, res: Response) { res.json({ a: true }); }
      @Post('/b') b(_: Request, res: Response) { res.json({ b: true }); }
    }

    const app = boot([F]);
    // consume the shared limit
    await request(app).get('/rl-class/a').expect(200);
    await request(app).get('/rl-class/a').expect(200);
    // both routes now blocked
    await request(app).get('/rl-class/a').expect(429);
    await request(app).post('/rl-class/b').expect(429);
  });
});
