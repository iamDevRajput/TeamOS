import { Injectable, BadRequestException } from '@nestjs/common';
import crypto from 'crypto';
import { config } from '../common/config';

export interface OAuthTransactionPayload {
  state: string;
  codeVerifier: string;
  createdAt: number;
  redirectPath: string;
}

export interface GitHubUserProfile {
  githubUserId: bigint;
  login: string;
  displayName: string | null;
  avatarUrl: string | null;
}

const ALLOWED_REDIRECT_PATHS = new Set(['/', '/dashboard', '/projects']);

@Injectable()
export class GitHubOAuthService {
  private readonly secret: string;

  constructor() {
    this.secret = config.oauthCookieSecret;
  }

  /**
   * Sanitizes redirect targets against an exact internal allowlist, preventing open redirects.
   */
  sanitizeRedirectPath(target?: string | null): string {
    if (!target) return '/';
    return ALLOWED_REDIRECT_PATHS.has(target) ? target : '/';
  }

  /**
   * Generates authorization URL, state, PKCE code verifier and challenge,
   * and returns an HMAC-signed cookie string.
   */
  createAuthorizationUrl(redirectPath?: string | null): {
    authorizeUrl: string;
    signedCookieValue: string;
  } {
    const state = crypto.randomBytes(32).toString('base64url');
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
    const safeRedirect = this.sanitizeRedirectPath(redirectPath);

    const payload: OAuthTransactionPayload = {
      state,
      codeVerifier,
      createdAt: Date.now(),
      redirectPath: safeRedirect,
    };

    const signedCookieValue = this.signPayload(payload);

    const params = new URLSearchParams({
      client_id: config.githubClientId,
      redirect_uri: config.githubCallbackUrl,
      scope: 'read:user', // Minimum required scope: public profile identity
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });

    const authorizeUrl = `https://github.com/login/oauth/authorize?${params.toString()}`;

    return { authorizeUrl, signedCookieValue };
  }

  /**
   * Signs a payload with HMAC-SHA256: payloadBase64.signatureHex
   */
  signPayload(payload: OAuthTransactionPayload): string {
    const raw = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sig = crypto.createHmac('sha256', this.secret).update(raw).digest('hex');
    return `${raw}.${sig}`;
  }

  /**
   * Verifies the cryptographic integrity of the transaction cookie and confirms state match.
   * Performs timing-safe comparison with length validation.
   */
  verifyAndConsumeOAuthCookie(
    signedCookieValue: string | undefined,
    queryState: string | undefined,
  ): OAuthTransactionPayload {
    if (!signedCookieValue || !queryState) {
      throw new BadRequestException('OAuth validation error: missing transaction cookie or state parameter.');
    }

    const parts = signedCookieValue.split('.');
    if (parts.length !== 2) {
      throw new BadRequestException('OAuth validation error: malformed transaction cookie.');
    }

    const [raw, providedSig] = parts;

    // Verify HMAC signature with timing-safe comparison
    const expectedSig = crypto.createHmac('sha256', this.secret).update(raw).digest('hex');
    const expectedBuf = Buffer.from(expectedSig, 'utf8');
    const providedBuf = Buffer.from(providedSig, 'utf8');

    if (
      expectedBuf.length !== providedBuf.length ||
      !crypto.timingSafeEqual(expectedBuf, providedBuf)
    ) {
      throw new BadRequestException('OAuth validation error: invalid cookie signature (tampering detected).');
    }

    let payload: OAuthTransactionPayload;
    try {
      payload = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
    } catch {
      throw new BadRequestException('OAuth validation error: unparseable cookie payload.');
    }

    // Check expiration (10 minutes TTL)
    const MAX_AGE_MS = 600_000;
    if (Date.now() - payload.createdAt > MAX_AGE_MS) {
      throw new BadRequestException('OAuth validation error: transaction expired.');
    }

    // Verify state match with timing-safe comparison
    const queryStateBuf = Buffer.from(queryState, 'utf8');
    const cookieStateBuf = Buffer.from(payload.state, 'utf8');

    if (
      queryStateBuf.length !== cookieStateBuf.length ||
      !crypto.timingSafeEqual(queryStateBuf, cookieStateBuf)
    ) {
      throw new BadRequestException('OAuth validation error: state mismatch.');
    }

    return payload;
  }

  /**
   * Exchanges authorization code and PKCE verifier for a GitHub access token.
   * Never logs credentials or access tokens.
   */
  async exchangeCodeForToken(code: string, codeVerifier: string): Promise<string> {
    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: config.githubClientId,
        client_secret: config.githubClientSecret,
        code,
        redirect_uri: config.githubCallbackUrl,
        code_verifier: codeVerifier,
      }),
    });

    if (!response.ok) {
      throw new BadRequestException('Failed to exchange authorization code with GitHub.');
    }

    const data = (await response.json()) as { access_token?: string; error?: string };
    if (!data.access_token) {
      throw new BadRequestException(`GitHub OAuth exchange error: ${data.error || 'token missing'}`);
    }

    return data.access_token;
  }

  /**
   * Fetches the user's public profile from GitHub using the short-lived access token.
   */
  async fetchGitHubUserProfile(accessToken: string): Promise<GitHubUserProfile> {
    const response = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'TeamOS-Identity-Service',
      },
    });

    if (!response.ok) {
      throw new BadRequestException('Failed to fetch user profile from GitHub.');
    }

    const ghUser = (await response.json()) as {
      id: number;
      login: string;
      name?: string | null;
      avatar_url?: string | null;
    };

    return {
      githubUserId: BigInt(ghUser.id),
      login: ghUser.login,
      displayName: ghUser.name || ghUser.login,
      avatarUrl: ghUser.avatar_url || null,
    };
  }
}

