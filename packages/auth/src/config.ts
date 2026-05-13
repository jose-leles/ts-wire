export interface AuthConfig {
  secret: string;
  extractToken?: (req: import('express').Request) => string | undefined;
}

let _config: AuthConfig | null = null;

export function configureAuth(config: AuthConfig): void {
  _config = config;
}

export function getAuthConfig(): AuthConfig {
  if (!_config) throw new Error('@ts-wire/auth: call configureAuth() before using RequireAuth');
  return _config;
}
