import { Request } from 'express';
import rateLimit from 'express-rate-limit';
import { Use } from '@ts-wire/core';

export interface RateLimitOptions {
  /** Maximum number of requests allowed within `windowMs`. Default: 100 */
  max?: number;
  /** Time window in milliseconds. Default: 15 minutes */
  windowMs?: number;
  /** Response message when rate limit is exceeded. Default: 'Too many requests' */
  message?: string;
  /** Custom function to generate a rate-limit key from the request. */
  keyGenerator?: (req: Request) => string;
  /** If true, successful requests are not counted. Default: false */
  skipSuccessfulRequests?: boolean;
}

/**
 * Rate-limiting decorator for ts-wire controllers and route methods.
 *
 * Applied at class level → limits all routes on the controller.
 * Applied at method level → limits only that route.
 *
 * @example
 * @Controller('/api')
 * @RateLimit({ max: 100, windowMs: 60_000 })
 * class ApiController {
 *   @Get('/search')
 *   @RateLimit({ max: 10, windowMs: 60_000 })
 *   search(req: Request, res: Response) { ... }
 * }
 */
export function RateLimit(options: RateLimitOptions = {}) {
  const {
    max = 100,
    windowMs = 15 * 60 * 1000,
    message = 'Too many requests',
    keyGenerator,
    skipSuccessfulRequests = false,
  } = options;

  const middleware = rateLimit({
    max,
    windowMs,
    message: { message },
    standardHeaders: true,
    legacyHeaders: false,
    ...(keyGenerator ? { keyGenerator } : {}),
    skipSuccessfulRequests,
  });

  return Use(middleware);
}
