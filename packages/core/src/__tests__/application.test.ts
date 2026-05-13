import request from 'supertest';
import { Request, Response } from 'express';
import { TsBoot, Controller, Get, Post, With, Use } from '@ts-wire/core';

beforeEach(() => jest.spyOn(console, 'table').mockImplementation(() => {}));
afterEach(() => jest.restoreAllMocks());

function boot(controllers: any[]) {
  return new TsBoot().bootstrap({ controllers });
}

// ── basic routing ───────────────────────────────────────────────────────────
describe('routing', () => {
  test('GET route returns 200', async () => {
    @Controller('/test')
    class C {
      @Get('/hello')
      hello(_req: Request, res: Response) { res.json({ ok: true }); }
    }
    await request(boot([C])).get('/test/hello').expect(200, { ok: true });
  });

  test('POST route returns 201', async () => {
    @Controller('/items')
    class C {
      @Post('/')
      create(_req: Request, res: Response) { res.status(201).json({ created: true }); }
    }
    await request(boot([C])).post('/items').expect(201, { created: true });
  });

  test('unknown route returns 404', async () => {
    @Controller('/x')
    class C {
      @Get('/') index(_: Request, res: Response) { res.json({}); }
    }
    await request(boot([C])).get('/x/nope').expect(404);
  });

  test('multiple controllers registered', async () => {
    @Controller('/a')
    class A { @Get('/') get(_: Request, res: Response) { res.json({ a: true }); } }
    @Controller('/b')
    class B { @Get('/') get(_: Request, res: Response) { res.json({ b: true }); } }
    const app = boot([A, B]);
    await request(app).get('/a').expect(200, { a: true });
    await request(app).get('/b').expect(200, { b: true });
  });
});

// ── component injection ─────────────────────────────────────────────────────
describe('component injection', () => {
  test('instance component passed to handler', async () => {
    const svc = { name: () => 'ts-wire' };
    @Controller('/comp')
    @With({ svc })
    class C {
      @Get('/')
      get(_req: Request, res: Response, { svc }: any) { res.json({ name: svc.name() }); }
    }
    await request(boot([C])).get('/comp').expect(200, { name: 'ts-wire' });
  });

  test('class component is instantiated', async () => {
    class Counter { count = 42; }
    @Controller('/class')
    @With({ counter: Counter })
    class C {
      @Get('/')
      get(_req: Request, res: Response, { counter }: any) { res.json({ count: counter.count }); }
    }
    await request(boot([C])).get('/class').expect(200, { count: 42 });
  });

  test('route-level @With overrides controller-level', async () => {
    const base = { label: 'base' };
    const override = { label: 'override' };
    @Controller('/merge')
    @With({ svc: base })
    class C {
      @Get('/')
      @With({ svc: override })
      get(_req: Request, res: Response, { svc }: any) { res.json({ label: svc.label }); }
    }
    await request(boot([C])).get('/merge').expect(200, { label: 'override' });
  });

  test('global components available in all routes', async () => {
    @Controller('/global')
    class C {
      @Get('/')
      get(_req: Request, res: Response, { db }: any) { res.json({ db: db.name }); }
    }
    const app = new TsBoot().bootstrap({
      controllers: [C],
      components: { db: { name: 'postgres' } },
    });
    await request(app).get('/global').expect(200, { db: 'postgres' });
  });
});

// ── middlewares ─────────────────────────────────────────────────────────────
describe('middlewares', () => {
  test('controller middleware runs before handler', async () => {
    const order: string[] = [];
    const mw = (_req: Request, _res: Response, next: any) => { order.push('mw'); next(); };
    @Controller('/mw')
    @Use(mw)
    class C {
      @Get('/')
      get(_req: Request, res: Response) { order.push('handler'); res.json({}); }
    }
    await request(boot([C])).get('/mw');
    expect(order).toEqual(['mw', 'handler']);
  });

  test('route middleware runs before handler', async () => {
    const calls: string[] = [];
    const mw = (_: Request, __: Response, next: any) => { calls.push('mw'); next(); };
    @Controller('/rmw')
    class C {
      @Get('/')
      @Use(mw)
      get(_: Request, res: Response) { calls.push('h'); res.json({}); }
    }
    await request(boot([C])).get('/rmw');
    expect(calls).toEqual(['mw', 'h']);
  });

  test('middleware can abort request', async () => {
    const block = (_: Request, res: Response) => res.status(403).json({ blocked: true });
    @Controller('/block')
    @Use(block as any)
    class C {
      @Get('/')
      get(_: Request, res: Response) { res.json({ reached: true }); }
    }
    await request(boot([C])).get('/block').expect(403, { blocked: true });
  });
});

// ── error handling ──────────────────────────────────────────────────────────
describe('error handling', () => {
  test('thrown error returns 500', async () => {
    @Controller('/err')
    class C {
      @Get('/')
      get() { throw new Error('boom'); }
    }
    const res = await request(boot([C])).get('/err');
    expect(res.status).toBe(500);
    expect(res.body.message).toBe('boom');
  });

  test('error with statusCode uses it', async () => {
    @Controller('/http-err')
    class C {
      @Get('/')
      get() {
        const e = Object.assign(new Error('not found'), { statusCode: 404 });
        throw e;
      }
    }
    await request(boot([C])).get('/http-err').expect(404, { message: 'not found' });
  });

  test('error with details includes them in response', async () => {
    @Controller('/detail-err')
    class C {
      @Get('/')
      get() {
        const e = Object.assign(new Error('invalid'), { statusCode: 400, details: [{ field: 'name' }] });
        throw e;
      }
    }
    const res = await request(boot([C])).get('/detail-err').expect(400);
    expect(res.body.details).toEqual([{ field: 'name' }]);
  });

  test('async errors are caught', async () => {
    @Controller('/async-err')
    class C {
      @Get('/')
      async get() {
        await Promise.resolve();
        throw Object.assign(new Error('async fail'), { statusCode: 422 });
      }
    }
    await request(boot([C])).get('/async-err').expect(422);
  });
});
