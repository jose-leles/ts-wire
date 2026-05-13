import swaggerUi from 'swagger-ui-express';
import { MetadataKeys as M } from '@ts-wire/core';
import type { IRouter } from '@ts-wire/core';

// ── Swagger-specific metadata keys ──────────────────────────────────────────

const SW = {
  ROUTE_DOCS: 'sw:routeDocs',
  CONTROLLER_TAGS: 'sw:tags',
} as const;

// ── Types ────────────────────────────────────────────────────────────────────

export interface RouteDoc {
  summary?: string;
  description?: string;
  tags?: string[];
  deprecated?: boolean;
  responses?: Record<number, { description: string }>;
}

export interface SwaggerOptions {
  title?: string;
  version?: string;
  description?: string;
  servers?: Array<{ url: string; description?: string }>;
}

// ── Decorators ───────────────────────────────────────────────────────────────

/**
 * @ApiDoc — method decorator. Adds OpenAPI documentation to a route.
 *
 * @example
 * @Get('/users')
 * @ApiDoc({ summary: 'List users', tags: ['users'], responses: { 200: { description: 'OK' } } })
 * list(req, res) { ... }
 */
export function ApiDoc(doc: RouteDoc) {
  return (_target: unknown, context: ClassMethodDecoratorContext) => {
    const handlerName = String(context.name);
    const existing = (context.metadata[SW.ROUTE_DOCS] as Record<string, RouteDoc>) ?? {};
    context.metadata[SW.ROUTE_DOCS] = { ...existing, [handlerName]: doc };
  };
}

/**
 * @ApiTag — class decorator. Adds a tag to all routes in the controller.
 *
 * @example
 * @Controller('/users')
 * @ApiTag('users')
 * class UserController { ... }
 */
export function ApiTag(tag: string) {
  return (_target: unknown, context: ClassDecoratorContext) => {
    const existing = (context.metadata[SW.CONTROLLER_TAGS] as string[]) ?? [];
    context.metadata[SW.CONTROLLER_TAGS] = [...existing, tag];
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Convert Express path params (`:id`) to OpenAPI path params (`{id}`).
 * E.g. `/users/:id/posts/:postId` → `/users/{id}/posts/{postId}`
 */
function toOpenApiPath(expressPath: string): string {
  return expressPath.replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, '{$1}');
}

/**
 * Extract param names from an Express path string.
 * E.g. `/users/:id/posts/:postId` → ['id', 'postId']
 */
function extractPathParams(expressPath: string): string[] {
  const matches = expressPath.match(/:([a-zA-Z_][a-zA-Z0-9_]*)/g) ?? [];
  return matches.map((m) => m.slice(1));
}

/**
 * Build an OpenAPI `parameters` array for path params.
 */
function buildPathParameters(expressPath: string): object[] {
  return extractPathParams(expressPath).map((name) => ({
    name,
    in: 'path',
    required: true,
    schema: { type: 'string' },
  }));
}

// ── Core function ─────────────────────────────────────────────────────────────

/**
 * Generate an OpenAPI 3.0 spec from a list of ts-wire controllers and mount
 * two endpoints on the Express app:
 *   GET /api-docs     → returns the raw JSON spec
 *   GET /api-docs/ui  → serves swagger-ui-express
 */
export function setupSwagger(
  app: import('express').Application,
  controllers: (new (...args: any[]) => any)[],
  options: SwaggerOptions = {}
): void {
  const {
    title = 'API',
    version = '0.1.0',
    description,
    servers = [],
  } = options;

  // Build OpenAPI paths object
  const paths: Record<string, Record<string, object>> = {};

  for (const ControllerClass of controllers) {
    const meta = ((ControllerClass as any)[Symbol.metadata] ?? {}) as Record<string, any>;

    const basePath: string = meta[M.BASE_PATH] ?? '';
    const routes: IRouter[] = meta[M.ROUTES] ?? [];
    const routeDocs: Record<string, RouteDoc> = meta[SW.ROUTE_DOCS] ?? {};
    const controllerTags: string[] = meta[SW.CONTROLLER_TAGS] ?? [];

    for (const route of routes) {
      const handlerName = String(route.handlerName);
      const doc: RouteDoc = routeDocs[handlerName] ?? {};

      // Merge tags: route-level doc tags + controller-level tags
      const tags = [...(doc.tags ?? []), ...controllerTags];

      // Build OpenAPI path string
      const fullExpressPath = basePath + route.path;
      const openApiPath = toOpenApiPath(fullExpressPath);

      // Build parameters
      const parameters = buildPathParameters(fullExpressPath);

      // Build responses (default to 200 OK if none provided)
      const rawResponses: Record<number, { description: string }> = doc.responses ?? { 200: { description: 'OK' } };
      const responses: Record<string, { description: string }> = {};
      for (const [code, resp] of Object.entries(rawResponses)) {
        responses[String(code)] = resp;
      }

      // Build operation object
      const operation: Record<string, unknown> = { responses };

      if (doc.summary) operation.summary = doc.summary;
      if (doc.description) operation.description = doc.description;
      if (tags.length > 0) operation.tags = tags;
      if (doc.deprecated) operation.deprecated = doc.deprecated;
      if (parameters.length > 0) operation.parameters = parameters;

      // Add to paths
      if (!paths[openApiPath]) {
        paths[openApiPath] = {};
      }
      paths[openApiPath][route.method] = operation;
    }
  }

  // Assemble the OpenAPI document
  const spec: Record<string, unknown> = {
    openapi: '3.0.0',
    info: {
      title,
      version,
      ...(description ? { description } : {}),
    },
    ...(servers.length > 0 ? { servers } : {}),
    paths,
  };

  // Mount GET /api-docs → raw JSON spec
  app.get('/api-docs', (_req, res) => {
    res.json(spec);
  });

  // Mount GET /api-docs/ui → swagger-ui-express HTML
  app.use('/api-docs/ui', swaggerUi.serve, swaggerUi.setup(spec));
}
