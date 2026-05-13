import './polyfill';
import cron, { ScheduleOptions, ScheduledTask } from 'node-cron';

// ── Metadata keys ────────────────────────────────────────────────────────────

const SCHED = {
  JOBS:       'sched:jobs',        // Array<JobEntry>
  COMPONENTS: 'sched:components',  // ComponentMap (class-level)
  METHOD_COMPONENTS: 'sched:method-components', // Record<string, ComponentMap>
} as const;

// ── Types ────────────────────────────────────────────────────────────────────

export interface CronOptions {
  timezone?: string;
  runOnInit?: boolean;  // run immediately on startup
  name?: string;        // human-readable job name for logging
}

interface JobEntry {
  cronExpression: string;
  handlerName: string;
  options?: CronOptions;
}

export interface SchedulerBootstrapOptions {
  schedulers: (new (...args: any[]) => any)[];
  components?: Record<string, any>;
}

// ── Decorators ───────────────────────────────────────────────────────────────

/**
 * @Scheduler() — marks a class as a cron job container.
 *
 * @example
 * @Scheduler()
 * class ReportScheduler { ... }
 */
export function Scheduler(): (
  _: unknown,
  context: ClassDecoratorContext
) => void {
  return (_: unknown, context: ClassDecoratorContext) => {
    // Ensure the jobs array exists so the class is recognized as a scheduler
    if (!Array.isArray(context.metadata[SCHED.JOBS])) {
      context.metadata[SCHED.JOBS] = [];
    }
  };
}

/**
 * @Cron(expression, options?) — registers a method as a cron handler.
 *
 * @example
 * @Cron('0 8 * * *', { name: 'daily-report', timezone: 'America/Sao_Paulo' })
 * async daily({ db }) { ... }
 */
export function Cron(
  expression: string,
  options?: CronOptions
): (_: unknown, context: ClassMethodDecoratorContext) => void {
  return (_: unknown, context: ClassMethodDecoratorContext) => {
    const handlerName = String(context.name);
    const existing: JobEntry[] =
      (context.metadata[SCHED.JOBS] as JobEntry[] | undefined) ?? [];
    existing.push({ cronExpression: expression, handlerName, options });
    context.metadata[SCHED.JOBS] = existing;
  };
}

/**
 * @ScheduleWith({ db, email }) — injects components at class or method level.
 * Class-level components are merged with method-level ones at execution time,
 * with method-level taking precedence.
 *
 * @example
 * @Scheduler()
 * @ScheduleWith({ db: DbService })
 * class ReportScheduler {
 *   @Cron('0 8 * * *')
 *   @ScheduleWith({ email: EmailService })
 *   async daily({ db, email }) { ... }
 * }
 */
export function ScheduleWith(
  components: Record<string, any>
): (
  _: unknown,
  context: ClassDecoratorContext | ClassMethodDecoratorContext
) => void {
  return (
    _: unknown,
    context: ClassDecoratorContext | ClassMethodDecoratorContext
  ) => {
    if (context.kind === 'class') {
      const existing =
        (context.metadata[SCHED.COMPONENTS] as Record<string, any> | undefined) ?? {};
      context.metadata[SCHED.COMPONENTS] = { ...existing, ...components };
    } else {
      const name = String(context.name);
      const existing =
        (context.metadata[SCHED.METHOD_COMPONENTS] as Record<string, Record<string, any>> | undefined) ?? {};
      existing[name] = { ...(existing[name] ?? {}), ...components };
      context.metadata[SCHED.METHOD_COMPONENTS] = existing;
    }
  };
}

// ── Component resolution (mirrors core) ─────────────────────────────────────

function resolveComponents(componentMap: Record<string, any>): Record<string, any> {
  return Object.entries(componentMap).reduce((acc, [key, value]) => {
    const isClass =
      typeof value === 'function' && /^\s*class[\s{]/.test(value.toString());
    acc[key] = isClass ? new value() : value;
    return acc;
  }, {} as Record<string, any>);
}

// ── TsScheduler ──────────────────────────────────────────────────────────────

export class TsScheduler {
  private tasks: ScheduledTask[] = [];

  /**
   * Registers all scheduler classes and starts their cron jobs.
   * Returns `this` for chaining.
   */
  start(options: SchedulerBootstrapOptions): this {
    const { schedulers, components: globalComponents = {} } = options;

    for (const SchedulerClass of schedulers) {
      const instance: Record<string, Function> =
        new SchedulerClass() as Record<string, Function>;
      const meta = (
        (SchedulerClass as any)[Symbol.metadata] ?? {}
      ) as Record<string, any>;

      const jobs: JobEntry[] = (meta[SCHED.JOBS] as JobEntry[] | undefined) ?? [];
      const classComponents: Record<string, any> =
        (meta[SCHED.COMPONENTS] as Record<string, any> | undefined) ?? {};
      const methodComponents: Record<string, Record<string, any>> =
        (meta[SCHED.METHOD_COMPONENTS] as Record<string, Record<string, any>> | undefined) ?? {};

      for (const job of jobs) {
        const { cronExpression, handlerName, options: jobOptions } = job;
        const label = jobOptions?.name ?? handlerName;

        const mergedComponents = resolveComponents({
          ...globalComponents,
          ...classComponents,
          ...(methodComponents[handlerName] ?? {}),
        });

        const handler = async () => {
          await (instance[handlerName] as Function).call(
            instance,
            mergedComponents
          );
        };

        console.log(
          `[scheduler] ${label} started (${cronExpression})`
        );

        const cronTaskOptions: ScheduleOptions = {};
        if (jobOptions?.timezone) {
          cronTaskOptions.timezone = jobOptions.timezone;
        }

        const task = cron.schedule(cronExpression, handler, cronTaskOptions);
        this.tasks.push(task);

        if (jobOptions?.runOnInit) {
          // Fire immediately — deliberately not awaited so startup is non-blocking,
          // but in tests it will resolve before assertions run via microtask queue.
          void handler();
        }
      }
    }

    return this;
  }

  /** Stops all running tasks. */
  stop(): void {
    for (const task of this.tasks) {
      task.stop();
    }
    this.tasks = [];
  }
}

export const scheduler = new TsScheduler();
