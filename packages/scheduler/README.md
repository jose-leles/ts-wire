# @ts-wire/scheduler

Cron job scheduling for ts-wire via node-cron.

```bash
npm install @ts-wire/scheduler
```

---

## Setup

```typescript
import { TsScheduler } from '@ts-wire/scheduler';
import { CleanupScheduler } from './schedulers/cleanup.scheduler';
import { components } from './components';

const scheduler = new TsScheduler();
scheduler.start({
  schedulers: [CleanupScheduler],
  components,
});
```

Stop all jobs cleanly:

```typescript
scheduler.stop();
```

---

## `@Scheduler()`

Declares a scheduler class. Methods decorated with `@Cron` are registered as cron jobs.

```typescript
import { Scheduler, Cron } from '@ts-wire/scheduler';

@Scheduler()
export class CleanupScheduler {
  @Cron('0 2 * * *', { name: 'cleanup-inactive-users' })
  async cleanupUsers({ userService }: Components) {
    await userService.removeInactive({ olderThanDays: 90 });
  }

  @Cron('*/15 * * * *', { name: 'sync-inventory' })
  async syncInventory({ inventoryService }: Components) {
    await inventoryService.sync();
  }
}
```

---

## `@Cron(expression, options?)`

Registers a method as a cron job.

```typescript
@Cron('0 9 * * 1-5', { name: 'morning-report', timezone: 'America/Sao_Paulo' })
async morningReport({ reportService }: Components) {
  await reportService.sendDailyDigest();
}
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `name` | `string` | method name | Job name for logging |
| `timezone` | `string` | system timezone | IANA timezone string |

### Common expressions

| Expression | Meaning |
|-----------|---------|
| `* * * * *` | Every minute |
| `*/15 * * * *` | Every 15 minutes |
| `0 * * * *` | Every hour |
| `0 2 * * *` | Every day at 02:00 |
| `0 9 * * 1-5` | Weekdays at 09:00 |
| `0 0 1 * *` | First day of month |

---

## Handler signature

```typescript
(components: Components) => void | Promise<void>
```

Components are injected as the first and only argument.

---

## `@ScheduleWith(components)`

Inject additional components into a specific scheduler method (merges with global components):

```typescript
@Cron('0 * * * *')
@ScheduleWith({ auditService: components.auditService })
async hourlyAudit({ auditService }: any) {
  await auditService.run();
}
```
