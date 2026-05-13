import request from 'supertest';
import express, { Request, Response } from 'express';
import { Controller, Get, Post, TsBoot } from '@ts-wire/core';
import { setupSwagger, ApiDoc, ApiTag } from '../index';

beforeEach(() => jest.spyOn(console, 'table').mockImplementation(() => {}));
afterEach(() => jest.restoreAllMocks());

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildApp(controllers: (new (...args: any[]) => any)[], swaggerOpts?: Parameters<typeof setupSwagger>[2]) {
  const boot = new TsBoot();
  const app = boot.bootstrap({ controllers });
  setupSwagger(app, controllers, swaggerOpts);
  return app;
}

// ── /api-docs JSON spec ───────────────────────────────────────────────────────

describe('GET /api-docs', () => {
  test('returns 200 with openapi: "3.0.0"', async () => {
    @Controller('/ping')
    class PingController {
      @Get('/')
      ping(_req: Request, res: Response) { res.json({ pong: true }); }
    }

    const app = buildApp([PingController]);
    const res = await request(app).get('/api-docs').expect(200);
    expect(res.body.openapi).toBe('3.0.0');
  });

  test('spec contains info with title and version from options', async () => {
    @Controller('/health')
    class HealthController {
      @Get('/')
      health(_req: Request, res: Response) { res.json({ status: 'ok' }); }
    }

    const app = buildApp([HealthController], { title: 'My API', version: '2.0.0' });
    const res = await request(app).get('/api-docs').expect(200);
    expect(res.body.info.title).toBe('My API');
    expect(res.body.info.version).toBe('2.0.0');
  });

  test('paths contain controller routes', async () => {
    @Controller('/items')
    class ItemController {
      @Get('/')
      list(_req: Request, res: Response) { res.json([]); }

      @Post('/')
      create(_req: Request, res: Response) { res.status(201).json({}); }
    }

    const app = buildApp([ItemController]);
    const res = await request(app).get('/api-docs').expect(200);
    expect(res.body.paths['/items/']).toBeDefined();
    expect(res.body.paths['/items/'].get).toBeDefined();
    expect(res.body.paths['/items/'].post).toBeDefined();
  });

  test('routes from multiple controllers all appear in paths', async () => {
    @Controller('/users')
    class UserController {
      @Get('/')
      list(_req: Request, res: Response) { res.json([]); }
    }

    @Controller('/orders')
    class OrderController {
      @Get('/')
      list(_req: Request, res: Response) { res.json([]); }
    }

    const app = buildApp([UserController, OrderController]);
    const res = await request(app).get('/api-docs').expect(200);
    expect(res.body.paths['/users/']).toBeDefined();
    expect(res.body.paths['/orders/']).toBeDefined();
  });

  test('path params are converted from Express :param to OpenAPI {param}', async () => {
    @Controller('/users')
    class UserController {
      @Get('/:id')
      getOne(_req: Request, res: Response) { res.json({}); }
    }

    const app = buildApp([UserController]);
    const res = await request(app).get('/api-docs').expect(200);
    expect(res.body.paths['/users/{id}']).toBeDefined();
    expect(res.body.paths['/users/{id}'].get.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'id', in: 'path', required: true }),
      ])
    );
  });

  test('nested path params are all extracted', async () => {
    @Controller('/users')
    class UserController {
      @Get('/:userId/posts/:postId')
      getPost(_req: Request, res: Response) { res.json({}); }
    }

    const app = buildApp([UserController]);
    const res = await request(app).get('/api-docs').expect(200);
    const pathEntry = res.body.paths['/users/{userId}/posts/{postId}'];
    expect(pathEntry).toBeDefined();
    const params: any[] = pathEntry.get.parameters;
    const names = params.map((p: any) => p.name);
    expect(names).toContain('userId');
    expect(names).toContain('postId');
  });
});

// ── @ApiDoc decorator ─────────────────────────────────────────────────────────

describe('@ApiDoc', () => {
  test('summary appears in generated spec', async () => {
    @Controller('/products')
    class ProductController {
      @Get('/')
      @ApiDoc({ summary: 'List all products' })
      list(_req: Request, res: Response) { res.json([]); }
    }

    const app = buildApp([ProductController]);
    const res = await request(app).get('/api-docs').expect(200);
    expect(res.body.paths['/products/'].get.summary).toBe('List all products');
  });

  test('description appears in generated spec', async () => {
    @Controller('/products')
    class ProductController {
      @Get('/')
      @ApiDoc({ description: 'Returns a full list of available products' })
      list(_req: Request, res: Response) { res.json([]); }
    }

    const app = buildApp([ProductController]);
    const res = await request(app).get('/api-docs').expect(200);
    expect(res.body.paths['/products/'].get.description).toBe('Returns a full list of available products');
  });

  test('route-level tags appear in generated spec', async () => {
    @Controller('/catalog')
    class CatalogController {
      @Get('/')
      @ApiDoc({ tags: ['catalog', 'public'] })
      index(_req: Request, res: Response) { res.json({}); }
    }

    const app = buildApp([CatalogController]);
    const res = await request(app).get('/api-docs').expect(200);
    expect(res.body.paths['/catalog/'].get.tags).toEqual(
      expect.arrayContaining(['catalog', 'public'])
    );
  });

  test('deprecated flag appears in generated spec', async () => {
    @Controller('/legacy')
    class LegacyController {
      @Get('/')
      @ApiDoc({ deprecated: true })
      old(_req: Request, res: Response) { res.json({}); }
    }

    const app = buildApp([LegacyController]);
    const res = await request(app).get('/api-docs').expect(200);
    expect(res.body.paths['/legacy/'].get.deprecated).toBe(true);
  });

  test('custom responses appear in generated spec', async () => {
    @Controller('/secure')
    class SecureController {
      @Get('/')
      @ApiDoc({ responses: { 200: { description: 'Success' }, 401: { description: 'Unauthorized' } } })
      get(_req: Request, res: Response) { res.json({}); }
    }

    const app = buildApp([SecureController]);
    const res = await request(app).get('/api-docs').expect(200);
    const responses = res.body.paths['/secure/'].get.responses;
    expect(responses['200'].description).toBe('Success');
    expect(responses['401'].description).toBe('Unauthorized');
  });

  test('route without @ApiDoc defaults to 200 OK response', async () => {
    @Controller('/bare')
    class BareController {
      @Get('/')
      get(_req: Request, res: Response) { res.json({}); }
    }

    const app = buildApp([BareController]);
    const res = await request(app).get('/api-docs').expect(200);
    expect(res.body.paths['/bare/'].get.responses['200'].description).toBe('OK');
  });
});

// ── @ApiTag decorator ─────────────────────────────────────────────────────────

describe('@ApiTag', () => {
  test('controller tag appears in all routes of that controller', async () => {
    @Controller('/users')
    @ApiTag('users')
    class UserController {
      @Get('/')
      list(_req: Request, res: Response) { res.json([]); }

      @Post('/')
      create(_req: Request, res: Response) { res.status(201).json({}); }
    }

    const app = buildApp([UserController]);
    const res = await request(app).get('/api-docs').expect(200);
    expect(res.body.paths['/users/'].get.tags).toContain('users');
    expect(res.body.paths['/users/'].post.tags).toContain('users');
  });

  test('multiple @ApiTag values all appear in route tags', async () => {
    @Controller('/admin')
    @ApiTag('admin')
    @ApiTag('internal')
    class AdminController {
      @Get('/')
      list(_req: Request, res: Response) { res.json([]); }
    }

    const app = buildApp([AdminController]);
    const res = await request(app).get('/api-docs').expect(200);
    expect(res.body.paths['/admin/'].get.tags).toContain('admin');
    expect(res.body.paths['/admin/'].get.tags).toContain('internal');
  });

  test('@ApiTag and @ApiDoc tags are merged', async () => {
    @Controller('/shop')
    @ApiTag('shop')
    class ShopController {
      @Get('/')
      @ApiDoc({ tags: ['public'] })
      list(_req: Request, res: Response) { res.json([]); }
    }

    const app = buildApp([ShopController]);
    const res = await request(app).get('/api-docs').expect(200);
    const tags: string[] = res.body.paths['/shop/'].get.tags;
    expect(tags).toContain('shop');
    expect(tags).toContain('public');
  });
});

// ── Swagger UI ────────────────────────────────────────────────────────────────

describe('GET /api-docs/ui', () => {
  test('returns 200 with HTML content', async () => {
    @Controller('/ping')
    class PingController {
      @Get('/')
      ping(_req: Request, res: Response) { res.json({ pong: true }); }
    }

    const app = buildApp([PingController]);
    const res = await request(app).get('/api-docs/ui/').expect(200);
    expect(res.headers['content-type']).toMatch(/html/);
  });

  test('swagger UI serves even with no routes', async () => {
    const app = express();
    setupSwagger(app, []);
    await request(app).get('/api-docs/ui/').expect(200);
  });
});

// ── SwaggerOptions ────────────────────────────────────────────────────────────

describe('SwaggerOptions', () => {
  test('description is included in info when provided', async () => {
    @Controller('/v1')
    class V1Controller {
      @Get('/')
      index(_req: Request, res: Response) { res.json({}); }
    }

    const app = buildApp([V1Controller], { description: 'My awesome API' });
    const res = await request(app).get('/api-docs').expect(200);
    expect(res.body.info.description).toBe('My awesome API');
  });

  test('servers array is included when provided', async () => {
    @Controller('/v1')
    class V1Controller {
      @Get('/')
      index(_req: Request, res: Response) { res.json({}); }
    }

    const app = buildApp([V1Controller], {
      servers: [
        { url: 'https://api.example.com', description: 'Production' },
        { url: 'http://localhost:3000', description: 'Local' },
      ],
    });
    const res = await request(app).get('/api-docs').expect(200);
    expect(res.body.servers).toHaveLength(2);
    expect(res.body.servers[0].url).toBe('https://api.example.com');
  });

  test('defaults used when options not provided', async () => {
    @Controller('/v1')
    class V1Controller {
      @Get('/')
      index(_req: Request, res: Response) { res.json({}); }
    }

    const app = buildApp([V1Controller]);
    const res = await request(app).get('/api-docs').expect(200);
    expect(res.body.info.title).toBe('API');
    expect(res.body.info.version).toBe('0.1.0');
  });
});
