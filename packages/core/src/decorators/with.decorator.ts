import { M } from './metadata.keys';
import { ComponentMap } from '../types';

/**
 * Declara components para controller (todas as rotas) ou uma rota específica.
 * Route-level @With faz merge com controller-level @With.
 *
 * @example
 * @Controller('/files')
 * @With({ s3: S3Service, socket: SocketService })
 * class FileController {
 *   @Post('/')
 *   @With({ queue: QueueService })
 *   async upload(req, res, { s3, socket, queue }: Components) {}
 * }
 */
export function With(components: ComponentMap) {
  return (
    _: unknown,
    context: ClassDecoratorContext | ClassMethodDecoratorContext
  ) => {
    if (context.kind === 'class') {
      const existing = (context.metadata[M.CONTROLLER_COMPONENTS] as ComponentMap) ?? {};
      context.metadata[M.CONTROLLER_COMPONENTS] = { ...existing, ...components };
    } else {
      const name = String(context.name);
      const existing = (context.metadata[M.ROUTE_COMPONENTS] as Record<string, ComponentMap>) ?? {};
      existing[name] = { ...(existing[name] ?? {}), ...components };
      context.metadata[M.ROUTE_COMPONENTS] = existing;
    }
  };
}
