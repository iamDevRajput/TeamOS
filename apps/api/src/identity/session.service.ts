import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import crypto from 'crypto';
import {
  User,
  createIdentityPrismaClient,
  createSession as dbCreateSession,
  resolveSessionByHash as dbResolveSessionByHash,
  touchSession as dbTouchSession,
  revokeSession as dbRevokeSession,
  upsertUserFromOAuth as dbUpsertUserFromOAuth,
  SessionUser,
} from '@teamos/database';
import { GitHubUserProfile } from './github-oauth.service';

export interface CreatedSession {
  rawToken: string;
  sessionId: string;
}

@Injectable()
export class SessionService implements OnModuleDestroy {
  private readonly logger = new Logger(SessionService.name);
  private readonly prisma: ReturnType<typeof createIdentityPrismaClient>;

  constructor() {
    this.prisma = createIdentityPrismaClient();
  }

  async onModuleDestroy(): Promise<void> {
    await this.prisma.$disconnect();
  }

  /**
   * Hashes a raw session token using SHA-256 before database storage or lookup.
   */
  hashToken(rawToken: string): string {
    return crypto.createHash('sha256').update(rawToken).digest('hex');
  }

  /**
   * Creates a new user session with a cryptographic random token.
   * Only the SHA-256 hash is persisted in PostgreSQL.
   */
  async createSession(userId: string, userAgent?: string): Promise<CreatedSession> {
    const rawToken = crypto.randomBytes(32).toString('base64url');
    const tokenHash = this.hashToken(rawToken);
    const ttlSeconds = 14 * 86400; // 14 days

    const sessionId = await dbCreateSession(
      this.prisma,
      userId,
      tokenHash,
      ttlSeconds,
      userAgent,
    );

    return { rawToken, sessionId };
  }

  /**
   * Resolves an active session and user by raw session token.
   * Asynchronously triggers touch_session (throttled to 15m in SQL).
   */
  async resolveSession(rawToken: string): Promise<SessionUser | null> {
    if (!rawToken || typeof rawToken !== 'string') {
      return null;
    }

    const tokenHash = this.hashToken(rawToken);
    const session = await dbResolveSessionByHash(this.prisma, tokenHash);

    if (!session) {
      return null;
    }

    // Fire-and-forget throttled touch
    dbTouchSession(this.prisma, session.sessionId).catch((err) => {
      this.logger.warn(`Failed to touch session ${session.sessionId}: ${err.message}`);
    });

    return session;
  }

  /**
   * Revokes a session given the raw session token.
   */
  async revokeSession(rawToken: string): Promise<boolean> {
    if (!rawToken || typeof rawToken !== 'string') {
      return false;
    }

    const tokenHash = this.hashToken(rawToken);
    return dbRevokeSession(this.prisma, tokenHash);
  }

  /**
   * Upserts a user identity from verified GitHub OAuth profile data.
   */
  async upsertOAuthUser(profile: GitHubUserProfile): Promise<User> {
    return dbUpsertUserFromOAuth(
      this.prisma,
      profile.githubUserId,
      profile.login,
      profile.displayName,
      profile.avatarUrl,
    );
  }
}
