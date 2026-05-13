import { Request, Response, NextFunction, Handler } from 'express';

export type Middleware = (req: Request, res: Response, next: NextFunction) => void | Promise<void>;

export type ComponentMap = Record<string, any>;

export type ComponentsOf<T extends ComponentMap> = {
  [K in keyof T]: InstanceType<T[K] extends new (...args: any[]) => any ? T[K] : never>;
};

export interface IRouter {
  method: 'get' | 'post' | 'put' | 'delete' | 'patch';
  path: string;
  handlerName: string | symbol;
}

export interface IWithComponents {
  handlerName: string | symbol | null; // null = controller-level
  components: ComponentMap;
}

export interface BootstrapOptions {
  controllers: (new (...args: any[]) => any)[];
  components?: ComponentMap;
  port?: number;
}
