import request from 'supertest';
import { Request, Response } from 'express';
import { TsBoot, Controller, Get, Post } from '@ts-wire/core';
import { Cache, Idempotent, MemoryStore } from '@ts-wire/cache';

beforeEach(() => jest.spyOn(console, 'table').mockImplementation(() => {}));
afterEach(() => jest.restoreAllMocks());

// ── @Cache ───────────────────────────────────────────────────────────────────
describe('@Cache', () => {
  test('second request returns cached response', async () => {
    let calls = 0;
    @Controller('/cache')
    class C {
      @Get('/')
      @Cache({ ttlMs: 5000 })
      list(_: Request, res: Response) { res.json({ calls: ++calls }); }
    }
    const app = new TsBoot().bootstrap({ controllers: [C] });
    await request(app).get('/cache').expect(200, { calls: 1 });
    await request(app).get('/cache').expect(200, { calls: 1 }); // cached
    expect(calls).toBe(1);
  });

  test('different URLs cached separately', async () => {
    let calls = 0;
    @Controller('/cache-url')
    class C {
      @Get('/:id')
      @Cache({ ttlMs: 5000 })
      get(req: Request, res: Response) { res.json({ id: req.params.id, calls: ++calls }); }
    }
    const app = new TsBoot().bootstrap({ controllers: [C] });
    await request(app).get('/cache-url/1').expect(200);
    await request(app).get('/cache-url/2').expect(200);
    expect(calls).toBe(2);
    await request(app).get('/cache-url/1').expect(200);
    expect(calls).toBe(2); // /1 still cached
  });

  test('cache expires after TTL', async () => {
    const store = new MemoryStore();
    let calls = 0;
    @Controller('/cache-ttl')
    class C {
      @Get('/')
      @Cache({ ttlMs: 1, store })
      get(_: Request, res: Response) { res.json({ calls: ++calls }); }
    }
    const app = new TsBoot().bootstrap({ controllers: [C] });
    await request(app).get('/cache-ttl');
    await new Promise(r => setTimeout(r, 10)); // wait for TTL
    await request(app).get('/cache-ttl');
    expect(calls).toBe(2);
  });

  test('custom key function used', async () => {
    let calls = 0;
    @Controller('/cache-key')
    class C {
      @Get('/')
      @Cache({ ttlMs: 5000, key: () => 'fixed-key' })
      get(_: Request, res: Response) { res.json({ calls: ++calls }); }
    }
    const app = new TsBoot().bootstrap({ controllers: [C] });
    await request(app).get('/cache-key?foo=1');
    await request(app).get('/cache-key?foo=2'); // different URL, same key
    expect(calls).toBe(1);
  });
});

// ── @Idempotent ──────────────────────────────────────────────────────────────
describe('@Idempotent', () => {
  test('same key returns same response', async () => {
    let calls = 0;
    @Controller('/idempotent')
    class C {
      @Post('/')
      @Idempotent()
      create(_: Request, res: Response) { res.status(201).json({ id: ++calls }); }
    }
    const app = new TsBoot().bootstrap({ controllers: [C] });
    const r1 = await request(app).post('/idempotent').set('idempotency-key', 'key-abc');
    const r2 = await request(app).post('/idempotent').set('idempotency-key', 'key-abc');
    expect(r1.body).toEqual(r2.body);
    expect(calls).toBe(1);
  });

  test('different keys processed independently', async () => {
    let calls = 0;
    @Controller('/idempotent-diff')
    class C {
      @Post('/')
      @Idempotent()
      create(_: Request, res: Response) { res.status(201).json({ id: ++calls }); }
    }
    const app = new TsBoot().bootstrap({ controllers: [C] });
    await request(app).post('/idempotent-diff').set('idempotency-key', 'k1');
    await request(app).post('/idempotent-diff').set('idempotency-key', 'k2');
    expect(calls).toBe(2);
  });

  test('no key → handler always runs', async () => {
    let calls = 0;
    @Controller('/idempotent-nokey')
    class C {
      @Post('/')
      @Idempotent()
      create(_: Request, res: Response) { res.json({ id: ++calls }); }
    }
    const app = new TsBoot().bootstrap({ controllers: [C] });
    await request(app).post('/idempotent-nokey');
    await request(app).post('/idempotent-nokey');
    expect(calls).toBe(2);
  });
});
