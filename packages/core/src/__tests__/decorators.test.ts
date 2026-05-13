import { Controller, Get, Post, Put, Delete, Patch, With, Use, MetadataKeys } from '@ts-wire/core';

const M = MetadataKeys;

function getMeta(cls: Function): Record<string, any> {
  return ((cls as any)[Symbol.metadata] ?? {}) as Record<string, any>;
}

// ── @Controller ─────────────────────────────────────────────────────────────
describe('@Controller', () => {
  test('sets BASE_PATH', () => {
    @Controller('/users') class C {}
    expect(getMeta(C)[M.BASE_PATH]).toBe('/users');
  });

  test('empty path is valid', () => {
    @Controller('') class C {}
    expect(getMeta(C)[M.BASE_PATH]).toBe('');
  });
});

// ── HTTP method decorators ───────────────────────────────────────────────────
describe('HTTP method decorators', () => {
  test('@Get registers route', () => {
    @Controller('/t') class C { @Get('/list') list() {} }
    expect(getMeta(C)[M.ROUTES]).toContainEqual({ method: 'get', path: '/list', handlerName: 'list' });
  });

  test('@Post registers route', () => {
    @Controller('/t') class C { @Post('/create') create() {} }
    expect(getMeta(C)[M.ROUTES]).toContainEqual({ method: 'post', path: '/create', handlerName: 'create' });
  });

  test('@Put registers route', () => {
    @Controller('/t') class C { @Put('/update') update() {} }
    expect(getMeta(C)[M.ROUTES]).toContainEqual({ method: 'put', path: '/update', handlerName: 'update' });
  });

  test('@Delete registers route', () => {
    @Controller('/t') class C { @Delete('/remove') remove() {} }
    expect(getMeta(C)[M.ROUTES]).toContainEqual({ method: 'delete', path: '/remove', handlerName: 'remove' });
  });

  test('@Patch registers route', () => {
    @Controller('/t') class C { @Patch('/patch') patch() {} }
    expect(getMeta(C)[M.ROUTES]).toContainEqual({ method: 'patch', path: '/patch', handlerName: 'patch' });
  });

  test('multiple routes accumulate', () => {
    @Controller('/t') class C {
      @Get('/a')    a() {}
      @Post('/b')   b() {}
      @Delete('/c') c() {}
    }
    expect(getMeta(C)[M.ROUTES]).toHaveLength(3);
  });
});

// ── @With ────────────────────────────────────────────────────────────────────
describe('@With', () => {
  test('class-level stores in CONTROLLER_COMPONENTS', () => {
    const svc = { greet: () => 'hi' };
    @Controller('/t') @With({ svc }) class C {}
    expect(getMeta(C)[M.CONTROLLER_COMPONENTS]).toEqual({ svc });
  });

  test('method-level stores in ROUTE_COMPONENTS under handler name', () => {
    @Controller('/t') class C {
      @Get('/') @With({ extra: 42 }) handler() {}
    }
    expect(getMeta(C)[M.ROUTE_COMPONENTS]['handler']).toEqual({ extra: 42 });
  });

  test('method-level merges multiple @With', () => {
    @Controller('/t') class C {
      @Get('/') @With({ a: 1 }) @With({ b: 2 }) handler() {}
    }
    expect(getMeta(C)[M.ROUTE_COMPONENTS]['handler']).toEqual({ a: 1, b: 2 });
  });

  test('class-level merges multiple @With', () => {
    @Controller('/t') @With({ a: 1 }) @With({ b: 2 }) class C {}
    expect(getMeta(C)[M.CONTROLLER_COMPONENTS]).toEqual({ a: 1, b: 2 });
  });
});

// ── @Use ─────────────────────────────────────────────────────────────────────
describe('@Use', () => {
  const mw = (_req: any, _res: any, next: any) => next();

  test('class-level stores in CONTROLLER_MIDDLEWARES', () => {
    @Controller('/t') @Use(mw) class C {}
    expect(getMeta(C)[M.CONTROLLER_MIDDLEWARES]).toContain(mw);
  });

  test('method-level stores in ROUTE_MIDDLEWARES', () => {
    @Controller('/t') class C { @Get('/') @Use(mw) handler() {} }
    expect(getMeta(C)[M.ROUTE_MIDDLEWARES]['handler']).toContain(mw);
  });

  test('multiple @Use accumulate', () => {
    const mw1 = () => {};
    const mw2 = () => {};
    @Controller('/t') @Use(mw1 as any) @Use(mw2 as any) class C {}
    const mws = getMeta(C)[M.CONTROLLER_MIDDLEWARES];
    expect(mws).toContain(mw1);
    expect(mws).toContain(mw2);
  });
});
