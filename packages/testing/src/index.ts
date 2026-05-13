import supertest from 'supertest';
import { TsBoot, ComponentMap, BootstrapOptions } from '@ts-wire/core';

export interface TestAppOptions extends Omit<BootstrapOptions, 'port'> {
  components?: ComponentMap;
}

export function createTestApp(options: TestAppOptions) {
  const boot = new TsBoot();
  const expressApp = boot.bootstrap(options);
  return supertest(expressApp);
}

export function mockComponents<T extends ComponentMap>(overrides: Partial<{ [K in keyof T]: Partial<T[K]> }>): ComponentMap {
  return overrides as ComponentMap;
}
