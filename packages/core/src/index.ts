import './polyfill'; // Symbol.metadata

export { Controller }                            from './decorators/controller.decorator';
export { Get, Post, Put, Delete, Patch }         from './decorators/methods.decorator';
export { With }                                  from './decorators/with.decorator';
export { Use }                                   from './decorators/use.decorator';
export { M as MetadataKeys }                     from './decorators/metadata.keys';
export { TsBoot }                                from './application';
export type { BootstrapOptions, ComponentMap, IRouter, Middleware } from './types';

export { default as app }                        from './application';
