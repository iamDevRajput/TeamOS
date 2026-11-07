import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthController } from './auth.controller';
import { GitHubOAuthService } from './github-oauth.service';
import { SessionService } from './session.service';
import { BadRequestException } from '@nestjs/common';
import { getOAuthCookieName, getSessionCookieName } from '../common/cookies';

describe('AuthController Specification', () => {
  let controller: AuthController;
  let mockOAuthService: Partial<GitHubOAuthService>;
  let mockSessionService: Partial<SessionService>;

  beforeEach(() => {
    mockOAuthService = {
      createAuthorizationUrl: vi.fn().mockReturnValue({
        authorizeUrl: 'https://github.com/login/oauth/authorize?test=1',
        signedCookieValue: 'signed_tx_cookie_value',
      }),
      verifyAndConsumeOAuthCookie: vi.fn().mockReturnValue({
        state: 'valid_state',
        codeVerifier: 'valid_code_verifier',
        createdAt: Date.now(),
        redirectPath: '/dashboard',
      }),
      exchangeCodeForToken: vi.fn().mockResolvedValue('gho_mock_access_token'),
      fetchGitHubUserProfile: vi.fn().mockResolvedValue({
        githubUserId: BigInt(12345),
        login: 'octocat',
        displayName: 'Mona Lisa Octocat',
        avatarUrl: 'https://avatars.githubusercontent.com/u/12345',
      }),
    };

    mockSessionService = {
      upsertOAuthUser: vi.fn().mockResolvedValue({
        id: 'user-uuid-123',
        githubUserId: BigInt(12345),
        login: 'octocat',
        displayName: 'Mona Lisa Octocat',
        avatarUrl: 'https://avatars.githubusercontent.com/u/12345',
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      createSession: vi.fn().mockResolvedValue({
        rawToken: 'mock_raw_session_token_32_bytes',
        sessionId: 'session-uuid-456',
      }),
      revokeSession: vi.fn().mockResolvedValue(true),
    };

    controller = new AuthController(
      mockOAuthService as GitHubOAuthService,
      mockSessionService as SessionService,
    );
  });

  describe('GET /auth/github/login', () => {
    it('sets the signed transaction cookie and redirects to GitHub authorization URL', () => {
      const cookiesSet: Record<string, any> = {};
      let redirectUrl = '';

      const res: any = {
        cookie: (name: string, val: any, opts: any) => {
          cookiesSet[name] = { val, opts };
        },
        redirect: (url: string) => {
          redirectUrl = url;
        },
      };

      controller.login('/dashboard', res);

      const cookieName = getOAuthCookieName();
      expect(cookiesSet[cookieName]).toBeDefined();
      expect(cookiesSet[cookieName].val).toBe('signed_tx_cookie_value');
      expect(cookiesSet[cookieName].opts.httpOnly).toBe(true);
      expect(redirectUrl).toBe('https://github.com/login/oauth/authorize?test=1');
      expect(mockOAuthService.createAuthorizationUrl).toHaveBeenCalledWith('/dashboard');
    });
  });

  describe('GET /auth/github/callback', () => {
    it('clears transaction cookie, exchanges code with PKCE, bootstraps user, issues session cookie, and redirects', async () => {
      const cookiesCleared: string[] = [];
      const cookiesSet: Record<string, any> = {};
      let redirectUrl = '';

      const req: any = {
        cookies: {
          [getOAuthCookieName()]: 'signed_tx_cookie_value',
        },
        headers: {
          'user-agent': 'TestBrowser/1.0',
        },
      };

      const res: any = {
        clearCookie: (name: string) => {
          cookiesCleared.push(name);
        },
        cookie: (name: string, val: any, opts: any) => {
          cookiesSet[name] = { val, opts };
        },
        redirect: (url: string) => {
          redirectUrl = url;
        },
      };

      await controller.callback('gh_code_123', 'valid_state', req, res);

      expect(cookiesCleared).toContain(getOAuthCookieName());
      expect(mockOAuthService.verifyAndConsumeOAuthCookie).toHaveBeenCalledWith(
        'signed_tx_cookie_value',
        'valid_state',
      );
      expect(mockOAuthService.exchangeCodeForToken).toHaveBeenCalledWith(
        'gh_code_123',
        'valid_code_verifier',
      );
      expect(mockOAuthService.fetchGitHubUserProfile).toHaveBeenCalledWith(
        'gho_mock_access_token',
      );
      expect(mockSessionService.upsertOAuthUser).toHaveBeenCalled();
      expect(mockSessionService.createSession).toHaveBeenCalledWith(
        'user-uuid-123',
        'TestBrowser/1.0',
      );

      const sessionCookieName = getSessionCookieName();
      expect(cookiesSet[sessionCookieName]).toBeDefined();
      expect(cookiesSet[sessionCookieName].val).toBe('mock_raw_session_token_32_bytes');
      expect(cookiesSet[sessionCookieName].opts.httpOnly).toBe(true);
      expect(redirectUrl).toContain('/dashboard');
    });

    it('throws BadRequestException if authorization code is missing', async () => {
      const req: any = { cookies: {} };
      const res: any = { clearCookie: vi.fn() };

      await expect(
        controller.callback(undefined, 'valid_state', req, res),
      ).rejects.toThrowError(BadRequestException);
    });
  });

  describe('GET /auth/me', () => {
    it('returns formatted user and session metadata for authenticated user', () => {
      const mockUser = {
        sessionId: 'session-uuid-456',
        userId: 'user-uuid-123',
        expiresAt: new Date('2026-11-20T00:00:00.000Z'),
        lastActiveAt: new Date('2026-11-07T12:00:00.000Z'),
        login: 'octocat',
        displayName: 'Mona Lisa Octocat',
        avatarUrl: 'https://avatars.githubusercontent.com/u/12345',
      };

      const result = controller.getProfile(mockUser);

      expect(result).toEqual({
        user: {
          id: 'user-uuid-123',
          login: 'octocat',
          displayName: 'Mona Lisa Octocat',
          avatarUrl: 'https://avatars.githubusercontent.com/u/12345',
        },
        sessionId: 'session-uuid-456',
        expiresAt: '2026-11-20T00:00:00.000Z',
        lastActiveAt: '2026-11-07T12:00:00.000Z',
      });
    });
  });

  describe('POST /auth/logout', () => {
    it('revokes session in database and clears session cookie', async () => {
      const cookiesCleared: string[] = [];
      const sessionCookieName = getSessionCookieName();

      const req: any = {
        cookies: {
          [sessionCookieName]: 'mock_raw_session_token_32_bytes',
        },
      };

      const res: any = {
        clearCookie: (name: string) => {
          cookiesCleared.push(name);
        },
      };

      const result = await controller.logout(req, res);

      expect(result).toEqual({ success: true });
      expect(mockSessionService.revokeSession).toHaveBeenCalledWith(
        'mock_raw_session_token_32_bytes',
      );
      expect(cookiesCleared).toContain(sessionCookieName);
    });
  });
});
