import { Injectable, Logger } from '@nestjs/common';
import crypto from 'crypto';

export interface InstallationTokenResponse {
  token: string;
  expiresAt: string;
  permissions: Record<string, string>;
  repositorySelection: string;
}

@Injectable()
export class GithubAppAuthService {
  private readonly logger = new Logger(GithubAppAuthService.name);

  /**
   * Normalizes the private key from environment variables.
   * Converts escaped newlines (\n) to actual newlines for single-line environment configs.
   */
  getNormalizedPrivateKey(): string | null {
    const rawKey = process.env.GITHUB_APP_PRIVATE_KEY;
    if (!rawKey || rawKey.includes('placeholder')) {
      return null;
    }
    const formatted = rawKey.replace(/\\n/g, '\n').trim();
    if (formatted.includes('BEGIN RSA PRIVATE KEY') || formatted.includes('BEGIN PRIVATE KEY')) {
      return formatted;
    }
    return null;
  }

  /**
   * Generates a GitHub App RS256 JWT for authenticating as the GitHub App.
   * Valid for 10 minutes (with 60-second clock drift allowance).
   * In production, throws if valid private key or APP_ID is absent.
   */
  generateAppJwt(): string {
    const isProduction = process.env.NODE_ENV === 'production';
    const appId = process.env.GITHUB_APP_ID;
    if (isProduction && (!appId || appId.includes('placeholder'))) {
      throw new Error('GITHUB_APP_ID must be configured in production.');
    }
    const resolvedAppId = appId || '123456';
    const privateKey = this.getNormalizedPrivateKey();

    if (isProduction && !privateKey) {
      throw new Error('GITHUB_APP_PRIVATE_KEY must be configured with a valid RSA PEM in production.');
    }

    const now = Math.floor(Date.now() / 1000);
    const header = { alg: 'RS256', typ: 'JWT' };
    const payload = {
      iat: now - 60,
      exp: now + 600,
      iss: resolvedAppId,
    };

    const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const unsignedToken = `${encodedHeader}.${encodedPayload}`;

    if (privateKey) {
      try {
        const signer = crypto.createSign('RSA-SHA256');
        signer.update(unsignedToken);
        const signature = signer.sign(privateKey, 'base64url');
        return `${unsignedToken}.${signature}`;
      } catch (err: any) {
        if (isProduction) {
          throw new Error(`Failed to sign GitHub App JWT with private key: ${err.message}`);
        }
        this.logger.warn(`Failed to sign with configured private key: ${err.message}. Using mock JWT signature.`);
      }
    }

    if (isProduction) {
      throw new Error('Development key fallback is forbidden in production.');
    }

    // Fallback deterministic signature for local mock/dev mode
    const mockSig = crypto.createHmac('sha256', 'teamos-dev-app-mock').update(unsignedToken).digest('base64url');
    return `${unsignedToken}.${mockSig}`;
  }

  /**
   * Generates a short-lived repository installation token.
   * Calls GitHub API or returns mock token in local dev.
   */
  async createInstallationToken(
    installationId: number | bigint,
  ): Promise<InstallationTokenResponse> {
    const isProduction = process.env.NODE_ENV === 'production';
    const privateKey = this.getNormalizedPrivateKey();

    if (isProduction && !privateKey) {
      throw new Error('GITHUB_APP_PRIVATE_KEY is required to generate installation tokens in production.');
    }

    if (privateKey) {
      try {
        const jwt = this.generateAppJwt();
        const res = await fetch(
          `https://api.github.com/app/installations/${installationId}/access_tokens`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${jwt}`,
              Accept: 'application/vnd.github+json',
              'X-GitHub-Api-Version': '2022-11-28',
            },
          },
        );

        if (res.ok) {
          const data = await res.json();
          return {
            token: data.token,
            expiresAt: data.expires_at,
            permissions: data.permissions || { pull_requests: 'read', metadata: 'read' },
            repositorySelection: data.repository_selection || 'selected',
          };
        }
        const errorBody = await res.text().catch(() => '');
        this.logger.warn(`GitHub installation token endpoint returned status ${res.status}: ${errorBody}`);
        if (isProduction) {
          throw new Error(`GitHub installation token request failed with status ${res.status}`);
        }
      } catch (err: any) {
        if (isProduction) {
          throw err;
        }
        this.logger.error(`Error requesting GitHub installation token: ${err.message}`);
      }
    }

    if (isProduction) {
      throw new Error('Development mock token fallback is forbidden in production.');
    }

    // Deterministic mock token for local testing / offline verification
    const mockToken = `ghs_mock_${crypto.createHash('sha256').update(`inst-${installationId}`).digest('hex').slice(0, 32)}`;
    const expiresAt = new Date(Date.now() + 3600 * 1000).toISOString();

    return {
      token: mockToken,
      expiresAt,
      permissions: {
        pull_requests: 'read',
        metadata: 'read',
      },
      repositorySelection: 'selected',
    };
  }
}
