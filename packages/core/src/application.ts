import 'express-async-errors';
import express, { Application as ExpressApp, Handler, Request, Response, NextFunction } from 'express';
import { M } from './decorators/metadata.keys';
import { IRouter, ComponentMap, BootstrapOptions, Middleware } from './types';

export class TsBoot {
  private readonly _app: ExpressApp;

  constructor() {
    this._app = express();
  }

  get instance(): ExpressApp {
    return this._app;
  }

  bootstrap(options: BootstrapOptions): ExpressApp {
    const { controllers, components: globalComponents = {} } = options;

    this._app.use(express.json());
    this._app.use(express.urlencoded({ extended: true }));

    this.registerControllers(controllers, globalComponents);
    this.registerErrorHandler();

    return this._app;
  }

  private registerControllers(
    controllers: (new (...args: any[]) => any)[],
    globalComponents: ComponentMap
  ) {
    const info: Array<{ route: string; handler: string; components: string[] }> = [];

    controllers.forEach((ControllerClass) => {
      const instance: Record<string, Handler> = new ControllerClass() as any;
      const meta = (ControllerClass[Symbol.metadata] ?? {}) as Record<string, any>;

      const basePath: string              = meta[M.BASE_PATH] ?? '';
      const routers: IRouter[]            = meta[M.ROUTES] ?? [];
      const ctrlComponents: ComponentMap  = meta[M.CONTROLLER_COMPONENTS] ?? {};
      const routeComponents: Record<string, ComponentMap> = meta[M.ROUTE_COMPONENTS] ?? {};
      const ctrlMiddlewares: Middleware[]  = meta[M.CONTROLLER_MIDDLEWARES] ?? [];
      const routeMiddlewares: Record<string, Middleware[]> = meta[M.ROUTE_MIDDLEWARES] ?? {};

      const exRouter = express.Router();

      routers.forEach(({ method, path, handlerName }) => {
        const name = String(handlerName);

        const mergedComponents = this.resolveComponents({
          ...globalComponents,
          ...ctrlComponents,
          ...(routeComponents[name] ?? {}),
        });

        const middlewares: Middleware[] = [
          ...ctrlMiddlewares,
          ...(routeMiddlewares[name] ?? []),
        ];

        const handler: Handler = (req, res, next) => {
          return (instance[name] as Function).call(instance, req, res, mergedComponents, next);
        };

        exRouter[method](path, ...middlewares, handler);

        info.push({
          route: `${method.toUpperCase()} ${basePath}${path}`,
          handler: `${ControllerClass.name}.${name}`,
          components: Object.keys(mergedComponents),
        });
      });

      this._app.use(basePath, exRouter);
    });

    console.table(info);
  }

  private resolveComponents(componentMap: ComponentMap): Record<string, any> {
    return Object.entries(componentMap).reduce((acc, [key, value]) => {
      const isClass = typeof value === 'function' && /^\s*class[\s{]/.test(value.toString());
      acc[key] = isClass ? new value() : value;
      return acc;
    }, {} as Record<string, any>);
  }

  private registerErrorHandler() {
    this._app.use((err: Error & { statusCode?: number; details?: unknown }, req: Request, res: Response, _next: NextFunction): void => {
      const status = err.statusCode ?? 500;
      if (status >= 500) console.error(err.stack);
      res.status(status).json({
        message: err.message,
        ...(err.details !== undefined ? { details: err.details } : {}),
        ...(process.env.NODE_ENV !== 'production' && status >= 500 ? { stack: err.stack } : {}),
      });
    });
  }
}

export default new TsBoot();
