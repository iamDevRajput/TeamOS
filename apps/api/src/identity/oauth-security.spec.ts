import { describe, it, expect, beforeEach } from 'vitest';
import crypto from 'crypto';
import { BadRequestException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { GitHubOAuthService } from './github-oauth.service';
import { CsrfValidationMiddleware } from '../common/csrf.middleware';
import { AuthGuard } from './guards/auth.guard';
import { Reflector } from '@nestjs/core';

describe('OAuth & Identity Security Specification', () => {
  let oauthService: GitHubOAuthService;

  beforeEach(() => {
    oauthService = new GitHubOAuthService();
  });

  describe('PKCE and Authorization Flow', () => {
    it('generates authorization URL with PKCE S256 challenge, state, and HMAC cookie', () => {
      const { authorizeUrl, signedCookieValue } = oauthService.createAuthorizationUrl('/dashboard');

      expect(authorizeUrl).toContain('https://github.com/login/oauth/authorize?');
      expect(authorizeUrl).toContain('scope=read%3Auser');
      expect(authorizeUrl).toContain('code_challenge_method=S256');
      expect(authorizeUrl).toContain('code_challenge=');
      expect(authorizeUrl).toContain('state=');

      // Cookie format: payloadBase64url.signatureHex
      const parts = signedCookieValue.split('.');
      expect(parts).toHaveLength(2);
      expect(parts[1]).toMatch(/^[a-f0-9]{64}$/);

      const payload = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
      expect(payload.state).toBeDefined();
      expect(payload.codeVerifier).toBeDefined();
      expect(payload.redirectPath).toBe('/dashboard');

      // Verify PKCE S256 derivation
      const expectedChallenge = crypto
        .createHash('sha256')
        .update(payload.codeVerifier)
        .digest('base64url');
      expect(authorizeUrl).toContain(`code_challenge=${expectedChallenge}`);
    });

    it('rejects unallowlisted open-redirect targets and defaults to /', () => {
      const { signedCookieValue } = oauthService.createAuthorizationUrl('https://evil-phishing.com');
      const parts = signedCookieValue.split('.');
      const payload = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));

      expect(payload.redirectPath).toBe('/');
    });
  });

  describe('HMAC Integrity and Anti-Tampering', () => {
    it('successfully consumes a valid transaction cookie and matching state', () => {
      const { signedCookieValue } = oauthService.createAuthorizationUrl('/projects');
      const parts = signedCookieValue.split('.');
      const payload = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));

      const verified = oauthService.verifyAndConsumeOAuthCookie(signedCookieValue, payload.state);
      expect(verified.state).toBe(payload.state);
      expect(verified.redirectPath).toBe('/projects');
    });

    it('rejects tampered payload content with invalid cookie signature', () => {
      const { signedCookieValue } = oauthService.createAuthorizationUrl('/dashboard');
      const [raw, sig] = signedCookieValue.split('.');

      const payload = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
      payload.redirectPath = '/tampered';
      const tamperedRaw = Buffer.from(JSON.stringify(payload)).toString('base64url');
      const tamperedCookie = `${tamperedRaw}.${sig}`;

      expect(() => {
        oauthService.verifyAndConsumeOAuthCookie(tamperedCookie, payload.state);
      }).toThrowError(BadRequestException);
    });

    it('rejects altered signature', () => {
      const { signedCookieValue } = oauthService.createAuthorizationUrl('/dashboard');
      const [raw] = signedCookieValue.split('.');
      const fakeSig = 'a'.repeat(64);
      const tamperedCookie = `${raw}.${fakeSig}`;

      expect(() => {
        oauthService.verifyAndConsumeOAuthCookie(tamperedCookie, 'any-state');
      }).toThrowError(BadRequestException);
    });

    it('rejects state mismatch', () => {
      const { signedCookieValue } = oauthService.createAuthorizationUrl('/dashboard');

      expect(() => {
        oauthService.verifyAndConsumeOAuthCookie(signedCookieValue, 'wrong-unmatching-state');
      }).toThrowError(/state mismatch/);
    });

    it('rejects expired transaction cookie (> 10 minutes)', () => {
      const expiredPayload = {
        state: 'valid_state_string_for_testing',
        codeVerifier: 'verifier',
        createdAt: Date.now() - 601_000, // 10 minutes and 1 second ago
        redirectPath: '/',
      };
      const signedExpiredCookie = oauthService.signPayload(expiredPayload);

      expect(() => {
        oauthService.verifyAndConsumeOAuthCookie(signedExpiredCookie, expiredPayload.state);
      }).toThrowError(/transaction expired/);
    });
  });

  describe('CSRF Validation Middleware', () => {
    const middleware = new CsrfValidationMiddleware();

    it('allows safe GET requests without Origin header', () => {
      let called = false;
      const req: any = { method: 'GET', headers: {} };
      const res: any = {};
      const next = () => { called = true; };

      middleware.use(req, res, next);
      expect(called).toBe(true);
    });

    it('rejects mutating requests with cross-site sec-fetch-site header', () => {
      const req: any = {
        method: 'POST',
        headers: {
          'sec-fetch-site': 'cross-site',
          origin: 'http://localhost:3000',
        },
      };
      const res: any = {};
      const next = () => {};

      expect(() => middleware.use(req, res, next)).toThrowError(ForbiddenException);
    });

    it('rejects mutating requests with unauthorized origin', () => {
      const req: any = {
        method: 'POST',
        headers: {
          origin: 'http://malicious-attacker.com',
        },
      };
      const res: any = {};
      const next = () => {};

      expect(() => middleware.use(req, res, next)).toThrowError(ForbiddenException);
    });

    it('allows mutating requests from authorized frontend origin', () => {
      let called = false;
      const req: any = {
        method: 'POST',
        headers: {
          origin: 'http://localhost:3000',
        },
      };
      const res: any = {};
      const next = () => { called = true; };

      middleware.use(req, res, next);
      expect(called).toBe(true);
    });
  });

  describe('AuthGuard Authentication Verification', () => {
    it('bypasses authentication on routes decorated with @Public()', async () => {
      const reflector = {
        getAllAndOverride: () => true,
      } as unknown as Reflector;

      const guard = new AuthGuard(reflector, {} as any);
      const context: any = {
        getHandler: () => {},
        getClass: () => {},
      };

      const result = await guard.canActivate(context);
      expect(result).toBe(true);
    });

    it('throws UnauthorizedException when no session cookie is present', async () => {
      const reflector = {
        getAllAndOverride: () => false,
      } as unknown as Reflector;

      const guard = new AuthGuard(reflector, {} as any);
      const context: any = {
        getHandler: () => {},
        getClass: () => {},
        switchToHttp: () => ({
          getRequest: () => ({ cookies: {} }),
        }),
      };

      await expect(guard.canActivate(context)).rejects.toThrowError(UnauthorizedException);
    });
  });
});
