import { M } from './metadata.keys';
import { IRouter } from '../types';

type HttpMethod = IRouter['method'];

function methodDecoratorFactory(method: HttpMethod) {
  return (path: string) => {
    return (_: unknown, context: ClassMethodDecoratorContext) => {
      const routes: IRouter[] = (context.metadata[M.ROUTES] as IRouter[]) ?? [];
      routes.push({ method, path, handlerName: String(context.name) });
      context.metadata[M.ROUTES] = routes;
    };
  };
}

export const Get    = methodDecoratorFactory('get');
export const Post   = methodDecoratorFactory('post');
export const Put    = methodDecoratorFactory('put');
export const Delete = methodDecoratorFactory('delete');
export const Patch  = methodDecoratorFactory('patch');
