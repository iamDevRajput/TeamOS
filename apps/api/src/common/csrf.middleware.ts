import { Injectable, NestMiddleware, ForbiddenException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { config } from './config';

@Injectable()
export class CsrfValidationMiddleware implements NestMiddleware {
  private readonly allowedOrigins: Set<string>;

  constructor() {
    this.allowedOrigins = new Set([
      config.appOrigin,
      'http://localhost:3000',
      'http://127.0.0.1:3000',
    ]);
  }

  use(req: Request, res: Response, next: NextFunction): void {
    const method = req.method.toUpperCase();
    const isMutating = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);

    if (!isMutating) {
      return next();
    }

    // 1. Check Sec-Fetch-Site if provided
    const secFetchSite = req.headers['sec-fetch-site'];
    if (secFetchSite && secFetchSite === 'cross-site') {
      throw new ForbiddenException('CSRF validation failed: cross-site request rejected.');
    }

    // 2. Validate Origin header
    const originHeader = req.headers['origin'];
    const refererHeader = req.headers['referer'];

    let requestOrigin: string | null = null;
    if (typeof originHeader === 'string') {
      requestOrigin = originHeader;
    } else if (typeof refererHeader === 'string') {
      try {
        const parsed = new URL(refererHeader);
        requestOrigin = parsed.origin;
      } catch {
        // Invalid referer URL format
      }
    }

    if (!requestOrigin || !this.allowedOrigins.has(requestOrigin)) {
      throw new ForbiddenException(
        `CSRF validation failed: origin "${requestOrigin || 'none'}" is not authorized.`,
      );
    }

    next();
  }
}

