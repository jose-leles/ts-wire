import { M } from './metadata.keys';
import { Middleware } from '../types';

/**
 * Attach any Express middleware to a controller or a specific route.
 *
 * @example
 * @Controller('/api')
 * @Use(rateLimitMiddleware)
 * class ApiController {
 *   @Post('/')
 *   @Use(myCustomMiddleware)
 *   async create(req, res, components) {}
 * }
 */
export function Use(middleware: Middleware) {
  return (
    _: unknown,
    context: ClassDecoratorContext | ClassMethodDecoratorContext
  ) => {
    if (context.kind === 'class') {
      const existing = (context.metadata[M.CONTROLLER_MIDDLEWARES] as Middleware[]) ?? [];
      existing.push(middleware);
      context.metadata[M.CONTROLLER_MIDDLEWARES] = existing;
    } else {
      const name = String(context.name);
      const existing = (context.metadata[M.ROUTE_MIDDLEWARES] as Record<string, Middleware[]>) ?? {};
      existing[name] = [...(existing[name] ?? []), middleware];
      context.metadata[M.ROUTE_MIDDLEWARES] = existing;
    }
  };
}
