import { Scheduler, Cron, ScheduleWith, TsScheduler } from '../index';

// ── node-cron mock ────────────────────────────────────────────────────────────
// We mock node-cron so tests never touch real cron scheduling.

const mockStop = jest.fn();
const mockSchedule = jest.fn().mockReturnValue({ stop: mockStop });

jest.mock('node-cron', () => ({
  __esModule: true,
  default: {
    schedule: (...args: any[]) => mockSchedule(...args),
  },
}));

// ── helpers ───────────────────────────────────────────────────────────────────

function getMeta(cls: Function): Record<string, any> {
  return ((cls as any)[Symbol.metadata] ?? {}) as Record<string, any>;
}

const JOBS       = 'sched:jobs';
const COMPONENTS = 'sched:components';
const METHOD_COMPONENTS = 'sched:method-components';

// ── Reset mocks between tests ─────────────────────────────────────────────────

beforeEach(() => {
  mockSchedule.mockClear();
  mockStop.mockClear();
  mockSchedule.mockReturnValue({ stop: mockStop });
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ── 1. @Scheduler() sets metadata ─────────────────────────────────────────────

describe('@Scheduler()', () => {
  test('sets sched:jobs array in metadata', () => {
    @Scheduler()
    class MyScheduler {}

    const meta = getMeta(MyScheduler);
    expect(Array.isArray(meta[JOBS])).toBe(true);
  });
});

// ── 2. @Cron registers job metadata ───────────────────────────────────────────

describe('@Cron()', () => {
  test('registers job with correct expression and handlerName', () => {
    @Scheduler()
    class MyScheduler {
      @Cron('* * * * *')
      tick() {}
    }

    const meta = getMeta(MyScheduler);
    const jobs = meta[JOBS] as any[];
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({
      cronExpression: '* * * * *',
      handlerName: 'tick',
    });
  });

  test('registers options alongside job entry', () => {
    @Scheduler()
    class MyScheduler {
      @Cron('0 8 * * *', { name: 'daily', timezone: 'America/Sao_Paulo' })
      daily() {}
    }

    const jobs = getMeta(MyScheduler)[JOBS] as any[];
    expect(jobs[0].options).toEqual({ name: 'daily', timezone: 'America/Sao_Paulo' });
  });

  test('multiple @Cron decorators accumulate', () => {
    @Scheduler()
    class MyScheduler {
      @Cron('* * * * *') a() {}
      @Cron('0 9 * * *') b() {}
    }

    const jobs = getMeta(MyScheduler)[JOBS] as any[];
    expect(jobs).toHaveLength(2);
    expect(jobs.map((j: any) => j.handlerName)).toEqual(
      expect.arrayContaining(['a', 'b'])
    );
  });
});

// ── 3. @ScheduleWith class-level stores components ────────────────────────────

describe('@ScheduleWith class-level', () => {
  test('stores components in sched:components', () => {
    const svc = { ping: () => 'pong' };

    @Scheduler()
    @ScheduleWith({ svc })
    class MyScheduler {}

    const meta = getMeta(MyScheduler);
    expect(meta[COMPONENTS]).toEqual({ svc });
  });

  test('merges multiple @ScheduleWith calls', () => {
    const a = { x: 1 };
    const b = { y: 2 };

    @Scheduler()
    @ScheduleWith(a)
    @ScheduleWith(b)
    class MyScheduler {}

    const meta = getMeta(MyScheduler);
    expect(meta[COMPONENTS]).toEqual({ x: 1, y: 2 });
  });
});

// ── 4. @ScheduleWith method-level stores per-handler components ───────────────

describe('@ScheduleWith method-level', () => {
  test('stores components under the handler name', () => {
    const extra = { value: 42 };

    @Scheduler()
    class MyScheduler {
      @Cron('* * * * *')
      @ScheduleWith({ extra })
      handler() {}
    }

    const meta = getMeta(MyScheduler);
    const methodComps = meta[METHOD_COMPONENTS] as Record<string, any>;
    expect(methodComps['handler']).toEqual({ extra });
  });

  test('merges multiple method-level @ScheduleWith', () => {
    @Scheduler()
    class MyScheduler {
      @Cron('* * * * *')
      @ScheduleWith({ a: 1 })
      @ScheduleWith({ b: 2 })
      handler() {}
    }

    const meta = getMeta(MyScheduler);
    const methodComps = meta[METHOD_COMPONENTS] as Record<string, any>;
    expect(methodComps['handler']).toEqual({ a: 1, b: 2 });
  });
});

// ── 5. TsScheduler.start() with runOnInit calls handler immediately ───────────

describe('TsScheduler.start() with runOnInit', () => {
  test('handler is called immediately when runOnInit is true', async () => {
    const called = jest.fn();

    @Scheduler()
    class MyScheduler {
      @Cron('* * * * *', { runOnInit: true })
      tick(components: Record<string, any>) {
        called(components);
      }
    }

    const ts = new TsScheduler();
    ts.start({ schedulers: [MyScheduler] });

    // Allow microtasks (the void handler() call) to flush
    await Promise.resolve();

    expect(called).toHaveBeenCalledTimes(1);
  });
});

// ── 6. TsScheduler.stop() stops all tasks ────────────────────────────────────

describe('TsScheduler.stop()', () => {
  test('calls stop() on every scheduled task', () => {
    const stop1 = jest.fn();
    const stop2 = jest.fn();
    mockSchedule
      .mockReturnValueOnce({ stop: stop1 })
      .mockReturnValueOnce({ stop: stop2 });

    @Scheduler()
    class MyScheduler {
      @Cron('* * * * *') a() {}
      @Cron('0 9 * * *') b() {}
    }

    const ts = new TsScheduler();
    ts.start({ schedulers: [MyScheduler] });
    ts.stop();

    expect(stop1).toHaveBeenCalled();
    expect(stop2).toHaveBeenCalled();
  });
});

// ── 7. Components are injected into handler ───────────────────────────────────

describe('component injection', () => {
  test('global components are passed to handler via runOnInit', async () => {
    const received: Record<string, any>[] = [];
    const db = { query: () => 'result' };

    @Scheduler()
    class MyScheduler {
      @Cron('* * * * *', { runOnInit: true })
      tick(components: Record<string, any>) {
        received.push(components);
      }
    }

    const ts = new TsScheduler();
    ts.start({ schedulers: [MyScheduler], components: { db } });

    await Promise.resolve();

    expect(received).toHaveLength(1);
    expect(received[0].db).toBe(db);
  });

  test('class constructor components are instantiated before injection', async () => {
    const received: Record<string, any>[] = [];

    class DbService {
      query() { return 'db-result'; }
    }

    @Scheduler()
    @ScheduleWith({ db: DbService })
    class MyScheduler {
      @Cron('* * * * *', { runOnInit: true })
      tick(components: Record<string, any>) {
        received.push(components);
      }
    }

    const ts = new TsScheduler();
    ts.start({ schedulers: [MyScheduler] });

    await Promise.resolve();

    expect(received[0].db).toBeInstanceOf(DbService);
  });
});

// ── 8. Class-level and method-level components are merged ─────────────────────

describe('component merging', () => {
  test('method-level components are merged with class-level ones', async () => {
    const received: Record<string, any>[] = [];
    const dbInstance = { ping: () => 'db' };
    const emailInstance = { send: () => 'email' };

    @Scheduler()
    @ScheduleWith({ db: dbInstance })
    class MyScheduler {
      @Cron('* * * * *', { runOnInit: true })
      @ScheduleWith({ email: emailInstance })
      tick(components: Record<string, any>) {
        received.push(components);
      }
    }

    const ts = new TsScheduler();
    ts.start({ schedulers: [MyScheduler] });

    await Promise.resolve();

    expect(received[0]).toMatchObject({
      db: dbInstance,
      email: emailInstance,
    });
  });

  test('method-level components override class-level with same key', async () => {
    const received: Record<string, any>[] = [];
    const classDb = { version: 'class' };
    const methodDb = { version: 'method' };

    @Scheduler()
    @ScheduleWith({ db: classDb })
    class MyScheduler {
      @Cron('* * * * *', { runOnInit: true })
      @ScheduleWith({ db: methodDb })
      tick(components: Record<string, any>) {
        received.push(components);
      }
    }

    const ts = new TsScheduler();
    ts.start({ schedulers: [MyScheduler] });

    await Promise.resolve();

    expect(received[0].db).toBe(methodDb);
  });

  test('global components are merged with class- and method-level', async () => {
    const received: Record<string, any>[] = [];
    const globalLogger = { log: () => {} };
    const classDb = { query: () => {} };
    const methodEmail = { send: () => {} };

    @Scheduler()
    @ScheduleWith({ db: classDb })
    class MyScheduler {
      @Cron('* * * * *', { runOnInit: true })
      @ScheduleWith({ email: methodEmail })
      tick(components: Record<string, any>) {
        received.push(components);
      }
    }

    const ts = new TsScheduler();
    ts.start({
      schedulers: [MyScheduler],
      components: { logger: globalLogger },
    });

    await Promise.resolve();

    expect(received[0]).toMatchObject({
      logger: globalLogger,
      db: classDb,
      email: methodEmail,
    });
  });
});
