import { describe, it, expect, beforeEach } from 'vitest';
import crypto from 'crypto';
import { GithubWebhookService } from './github-webhook.service';
import { GithubAppAuthService } from './github-app-auth.service';

describe('GitHub Webhook Service & HMAC-SHA256 Signature Security (Phase H & Gap 2)', () => {
  let service: GithubWebhookService;
  let authService: GithubAppAuthService;
  const testSecret = 'test-secret-key-12345';

  beforeEach(() => {
    process.env.GITHUB_WEBHOOK_SECRET = testSecret;
    service = new GithubWebhookService();
    authService = new GithubAppAuthService();
  });

  function signPayload(payload: string, secret = testSecret): string {
    const hmac = crypto.createHmac('sha256', secret);
    return `sha256=${hmac.update(payload).digest('hex')}`;
  }

  it('accepts valid HMAC-SHA256 signature', () => {
    const body = JSON.stringify({ action: 'opened', pull_request: { number: 42 } });
    const signature = signPayload(body);

    const isValid = service.verifySignature(body, signature);
    expect(isValid).toBe(true);
  });

  it('rejects signature created with mismatched secret', () => {
    const body = JSON.stringify({ action: 'opened', pull_request: { number: 42 } });
    const signature = signPayload(body, 'wrong-secret');

    const isValid = service.verifySignature(body, signature);
    expect(isValid).toBe(false);
  });

  it('rejects tampered request payload', () => {
    const originalBody = JSON.stringify({ action: 'opened' });
    const tamperedBody = JSON.stringify({ action: 'closed' });
    const signature = signPayload(originalBody);

    const isValid = service.verifySignature(tamperedBody, signature);
    expect(isValid).toBe(false);
  });

  it('rejects missing or malformed signature header (no sha256= prefix)', () => {
    const body = JSON.stringify({ action: 'opened' });
    expect(service.verifySignature(body, undefined)).toBe(false);
    expect(service.verifySignature(body, '')).toBe(false);
    expect(service.verifySignature(body, 'invalid_signature_without_prefix')).toBe(false);
  });

  it('extracts task keys from pull request titles, bodies, and branch names', () => {
    const text1 = 'feat: implement user registration [DEL-42] and fix [AUTH-10]';
    const matches1 = service.extractTaskKeys(text1);
    expect(matches1).toEqual([
      { projectKey: 'DEL', taskNumber: 42 },
      { projectKey: 'AUTH', taskNumber: 10 },
    ]);

    const text2 = 'feature/PROJ-105-add-stripe-billing';
    const matches2 = service.extractTaskKeys(text2);
    expect(matches2).toEqual([{ projectKey: 'PROJ', taskNumber: 105 }]);

    // Deduplicates task keys
    const text3 = 'Fix PROJ-5 issue in PROJ-5 branch';
    const matches3 = service.extractTaskKeys(text3);
    expect(matches3.length).toBe(1);
    expect(matches3[0]).toEqual({ projectKey: 'PROJ', taskNumber: 5 });
  });

  it('processes pull_request webhook payload and detects matched tasks', async () => {
    const payload = {
      action: 'opened',
      pull_request: {
        number: 88,
        title: 'feat: add database indexes for [DEL-15]',
        body: 'Closes [DEL-16]',
        head: { ref: 'feat/DEL-15-indexes' },
        merged: false,
      },
    };

    const deliveryId = `delivery-guid-${Date.now()}-${Math.random()}`;
    const result = await service.processWebhookEvent(deliveryId, 'pull_request', payload);
    expect(result.received).toBe(true);
    expect(result.matches).toBe(2); // DEL-15 and DEL-16
  });

  it('generates GitHub App JWT with header, payload, and signature', () => {
    const jwt = authService.generateAppJwt();
    const parts = jwt.split('.');
    expect(parts).toHaveLength(3);

    const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));

    expect(header.alg).toBe('RS256');
    expect(payload.iss).toBeDefined();
    expect(payload.exp).toBeGreaterThan(payload.iat);
  });

  it('creates short-lived installation access token', async () => {
    const tokenInfo = await authService.createInstallationToken(12345);
    expect(tokenInfo.token).toBeDefined();
    expect(tokenInfo.token).toMatch(/^ghs_/);
    expect(tokenInfo.permissions.pull_requests).toBe('read');
    expect(new Date(tokenInfo.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it('correctly normalizes escaped newlines in GITHUB_APP_PRIVATE_KEY', () => {
    const originalEnv = process.env.GITHUB_APP_PRIVATE_KEY;
    try {
      process.env.GITHUB_APP_PRIVATE_KEY = '-----BEGIN RSA PRIVATE KEY-----\\nMIIEowIBAAKCAQEA...\\n-----END RSA PRIVATE KEY-----';
      const normalized = authService.getNormalizedPrivateKey();
      expect(normalized).toBe('-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA...\n-----END RSA PRIVATE KEY-----');
      expect(normalized?.includes('\n')).toBe(true);
      expect(normalized?.includes('\\n')).toBe(false);
    } finally {
      process.env.GITHUB_APP_PRIVATE_KEY = originalEnv;
    }
  });

  it('forbids mock development key fallback in production mode', async () => {
    const originalEnv = process.env.NODE_ENV;
    const originalKey = process.env.GITHUB_APP_PRIVATE_KEY;
    const originalAppId = process.env.GITHUB_APP_ID;

    try {
      process.env.NODE_ENV = 'production';
      process.env.GITHUB_APP_PRIVATE_KEY = '';
      process.env.GITHUB_APP_ID = '123456';

      expect(() => authService.generateAppJwt()).toThrow(/GITHUB_APP_PRIVATE_KEY must be configured/);
      await expect(authService.createInstallationToken(99999)).rejects.toThrow(/GITHUB_APP_PRIVATE_KEY is required/);
    } finally {
      process.env.NODE_ENV = originalEnv;
      process.env.GITHUB_APP_PRIVATE_KEY = originalKey;
      process.env.GITHUB_APP_ID = originalAppId;
    }
  });
});
