import crypto from 'crypto';

export interface AppConfig {
  nodeEnv: string;
  isProduction: boolean;
  port: number;
  appOrigin: string;
  githubClientId: string;
  githubClientSecret: string;
  githubCallbackUrl: string;
  oauthCookieSecret: string;
}

export function loadConfig(): AppConfig {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const isProduction = nodeEnv === 'production';
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;
  const appOrigin = process.env.APP_ORIGIN || process.env.CORS_ORIGIN || 'http://localhost:3000';

  const oauthCookieSecret =
    process.env.OAUTH_COOKIE_SECRET ||
    (isProduction
      ? ''
      : 'development_fallback_secret_must_be_at_least_32_characters_long_for_security');

  if (isProduction && (!oauthCookieSecret || oauthCookieSecret.length < 32)) {
    throw new Error(
      'Startup validation failed: OAUTH_COOKIE_SECRET must be at least 32 characters in production.',
    );
  }

  return {
    nodeEnv,
    isProduction,
    port,
    appOrigin,
    githubClientId: process.env.GITHUB_CLIENT_ID || 'dummy_client_id',
    githubClientSecret: process.env.GITHUB_CLIENT_SECRET || 'dummy_client_secret',
    githubCallbackUrl:
      process.env.GITHUB_CALLBACK_URL || 'http://localhost:3001/api/v1/auth/github/callback',
    oauthCookieSecret,
  };
}

export const config = loadConfig();

