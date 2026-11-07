import { CookieOptions } from 'express';
import { config } from './config';

export function getSessionCookieName(isProduction = config.isProduction): string {
  return isProduction ? '__Host-teamos_session' : 'teamos_session';
}

export function getOAuthCookieName(isProduction = config.isProduction): string {
  return isProduction ? '__Host-teamos_oauth_tx' : 'teamos_oauth_tx';
}

/**
 * Returns RFC 6265bis compliant cookie options.
 * When isProduction is true, Secure is enforced, and no Domain is specified for __Host- cookies.
 */
export function getCookieOptions(
  maxAgeSeconds: number,
  isProduction = config.isProduction,
): CookieOptions {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: maxAgeSeconds * 1000,
  };
}

