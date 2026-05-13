import { M } from './metadata.keys';

export function Controller(basePath: string) {
  return (_: Function, context: ClassDecoratorContext) => {
    context.metadata[M.BASE_PATH] = basePath;
  };
}
