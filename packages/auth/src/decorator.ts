import { Use } from '@ts-wire/core';
import { jwtMiddleware } from './middleware';

export function RequireAuth() {
  return Use(jwtMiddleware);
}
