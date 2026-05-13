import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getAuthConfig } from './config';

declare global {
  namespace Express {
    interface Request {
      user?: Record<string, any>;
    }
  }
}

function httpError(status: number, message: string): Error & { statusCode: number } {
  const err = new Error(message) as Error & { statusCode: number };
  err.statusCode = status;
  return err;
}

export function jwtMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const config = getAuthConfig();

  const raw = config.extractToken
    ? config.extractToken(req)
    : req.headers.authorization?.replace(/^Bearer\s+/i, '');

  if (!raw) return next(httpError(401, 'Missing token'));

  try {
    req.user = jwt.verify(raw, config.secret) as Record<string, any>;
    next();
  } catch {
    next(httpError(401, 'Invalid or expired token'));
  }
}
