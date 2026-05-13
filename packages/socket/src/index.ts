import { Server, Socket } from 'socket.io';
import http from 'http';

// ---------------------------------------------------------------------------
// Metadata key constants stored in Symbol.metadata
// ---------------------------------------------------------------------------
export const SM = {
  NAMESPACE:    'socket:namespace',
  EVENTS:       'socket:events',       // Array<{ event: string; handlerName: string }>
  ON_CONNECT:   'socket:connect',      // string — handlerName
  ON_DISCONNECT:'socket:disconnect',   // string — handlerName
  COMPONENTS:   'socket:components',   // Record<string, any> — class-level
  METHOD_COMPONENTS: 'socket:methodComponents', // Record<handlerName, Record<string, any>>
} as const;

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface EventEntry {
  event: string;
  handlerName: string;
}

// ---------------------------------------------------------------------------
// Decorators
// ---------------------------------------------------------------------------

/**
 * Marks a class as a Socket.IO controller.
 * @param namespace  Optional Socket.IO namespace (default '/').
 *
 * @example
 * @SocketController('/chat')
 * class ChatController { ... }
 */
export function SocketController(namespace?: string) {
  return (_: unknown, context: ClassDecoratorContext) => {
    context.metadata[SM.NAMESPACE] = namespace ?? '/';
  };
}

/**
 * Registers a method as a handler for a named socket event.
 *
 * @example
 * @OnEvent('message')
 * handleMessage(socket, data, components) {}
 */
export function OnEvent(event: string) {
  return (_: unknown, context: ClassMethodDecoratorContext) => {
    const existing = (context.metadata[SM.EVENTS] as EventEntry[]) ?? [];
    existing.push({ event, handlerName: String(context.name) });
    context.metadata[SM.EVENTS] = existing;
  };
}

/**
 * Registers a method to run when a client connects.
 *
 * @example
 * @OnConnect()
 * onConnect(socket, components) {}
 */
export function OnConnect() {
  return (_: unknown, context: ClassMethodDecoratorContext) => {
    context.metadata[SM.ON_CONNECT] = String(context.name);
  };
}

/**
 * Registers a method to run when a client disconnects.
 *
 * @example
 * @OnDisconnect()
 * onDisconnect(socket, components) {}
 */
export function OnDisconnect() {
  return (_: unknown, context: ClassMethodDecoratorContext) => {
    context.metadata[SM.ON_DISCONNECT] = String(context.name);
  };
}

/**
 * Declares components for a socket controller (class-level) or a specific handler (method-level).
 * Method-level components are merged with class-level components at runtime.
 *
 * @example
 * @SocketController('/chat')
 * @SocketWith({ chatService: ChatService })
 * class ChatController {
 *   @OnEvent('message')
 *   @SocketWith({ extra: someValue })
 *   message(socket, data, { chatService, extra }) {}
 * }
 */
export function SocketWith(components: Record<string, any>) {
  return (
    _: unknown,
    context: ClassDecoratorContext | ClassMethodDecoratorContext
  ) => {
    if (context.kind === 'class') {
      const existing = (context.metadata[SM.COMPONENTS] as Record<string, any>) ?? {};
      context.metadata[SM.COMPONENTS] = { ...existing, ...components };
    } else {
      const name = String(context.name);
      const existing = (context.metadata[SM.METHOD_COMPONENTS] as Record<string, Record<string, any>>) ?? {};
      existing[name] = { ...(existing[name] ?? {}), ...components };
      context.metadata[SM.METHOD_COMPONENTS] = existing;
    }
  };
}

// ---------------------------------------------------------------------------
// SocketService — injectable wrapper around Server
// ---------------------------------------------------------------------------

/**
 * Thin injectable wrapper around the Socket.IO `Server`.
 * Create one instance after `setupSocket` and pass it as a component to
 * HTTP controllers that need to emit real-time events.
 *
 * @example
 * const io = setupSocket(httpServer, { controllers: [ChatController] });
 * const socketService = new SocketService(io);
 * app.bootstrap({ controllers: [UserController], components: { socketService } });
 */
export class SocketService {
  constructor(private readonly io: Server) {}

  emit(event: string, data?: unknown) {
    this.io.emit(event, data);
  }

  to(room: string) {
    return this.io.to(room);
  }

  get server(): Server {
    return this.io;
  }
}

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

export interface SocketBootstrapOptions {
  controllers: (new (...args: any[]) => any)[];
  components?: Record<string, any>;
  cors?: { origin: string | string[] };
  auth?: (socket: Socket, next: (err?: Error) => void) => void;
}

/**
 * Creates a Socket.IO `Server`, registers all decorated controllers, and
 * returns the `io` instance.
 *
 * @example
 * const httpServer = http.createServer(expressApp);
 * const io = setupSocket(httpServer, {
 *   controllers: [ChatController],
 *   components: { db },
 *   cors: { origin: '*' },
 *   auth: (socket, next) => { ... },
 * });
 */
export function setupSocket(
  server: http.Server,
  options: SocketBootstrapOptions
): Server {
  const { controllers, components: globalComponents = {}, cors, auth } = options;

  const io = new Server(server, { cors });

  if (auth) {
    io.use(auth);
  }

  for (const ControllerClass of controllers) {
    const meta = ((ControllerClass as any)[Symbol.metadata] ?? {}) as Record<string, any>;

    const namespace: string         = (meta[SM.NAMESPACE] as string) ?? '/';
    const events: EventEntry[]      = (meta[SM.EVENTS] as EventEntry[]) ?? [];
    const connectHandler: string | undefined   = meta[SM.ON_CONNECT] as string | undefined;
    const disconnectHandler: string | undefined = meta[SM.ON_DISCONNECT] as string | undefined;
    const ctrlComponents: Record<string, any>  = (meta[SM.COMPONENTS] as Record<string, any>) ?? {};
    const methodComponents: Record<string, Record<string, any>> =
      (meta[SM.METHOD_COMPONENTS] as Record<string, Record<string, any>>) ?? {};

    const nsp = io.of(namespace);

    nsp.on('connection', (socket: Socket) => {
      const instance = new ControllerClass() as Record<string, Function>;

      // Fire @OnConnect handler
      if (connectHandler && typeof instance[connectHandler] === 'function') {
        const comps = resolveComponents({
          ...globalComponents,
          ...ctrlComponents,
          ...(methodComponents[connectHandler] ?? {}),
        });
        Promise.resolve(instance[connectHandler].call(instance, socket, comps)).catch(
          (err: unknown) => console.error('[ts-wire/socket] onConnect error', err)
        );
      }

      // Register @OnEvent handlers
      for (const { event, handlerName } of events) {
        if (typeof instance[handlerName] !== 'function') continue;

        const comps = resolveComponents({
          ...globalComponents,
          ...ctrlComponents,
          ...(methodComponents[handlerName] ?? {}),
        });

        socket.on(event, (data: unknown) => {
          Promise.resolve(
            instance[handlerName].call(instance, socket, data, comps)
          ).catch((err: unknown) =>
            console.error(`[ts-wire/socket] event "${event}" error`, err)
          );
        });
      }

      // Fire @OnDisconnect handler on disconnect
      if (disconnectHandler && typeof instance[disconnectHandler] === 'function') {
        const comps = resolveComponents({
          ...globalComponents,
          ...ctrlComponents,
          ...(methodComponents[disconnectHandler] ?? {}),
        });

        socket.on('disconnect', () => {
          Promise.resolve(
            instance[disconnectHandler!].call(instance, socket, comps)
          ).catch((err: unknown) =>
            console.error('[ts-wire/socket] onDisconnect error', err)
          );
        });
      }

    });
  }

  return io;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function resolveComponents(componentMap: Record<string, any>): Record<string, any> {
  return Object.entries(componentMap).reduce((acc, [key, value]) => {
    const isClass =
      typeof value === 'function' && /^\s*class[\s{]/.test(value.toString());
    acc[key] = isClass ? new (value as new () => unknown)() : value;
    return acc;
  }, {} as Record<string, any>);
}
