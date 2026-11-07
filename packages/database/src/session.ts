/**
 * TeamOS Database Package — Identity & Session Operations
 *
 * Rules:
 * - Uses dedicated DATABASE_URL_IDENTITY connection (teamos_identity_runtime role).
 * - Calls hardened SECURITY DEFINER functions owned by teamos_identity_admin.
 * - No direct table access to public.sessions.
 */

import { PrismaClient, Prisma, User } from '@prisma/client';

export interface SessionUser {
  sessionId: string;
  userId: string;
  expiresAt: Date;
  lastActiveAt: Date;
  login: string;
  displayName: string | null;
  avatarUrl: string | null;
}

interface RawSessionUser {
  session_id: string;
  user_id: string;
  expires_at: Date;
  last_active_at: Date;
  login: string;
  display_name: string | null;
  avatar_url: string | null;
}

/**
 * Creates an identity-scoped Prisma Client using DATABASE_URL_IDENTITY.
 */
export function createIdentityPrismaClient(databaseUrl?: string): PrismaClient {
  return new PrismaClient({
    datasources: {
      db: {
        url:
          databaseUrl ||
          process.env.DATABASE_URL_IDENTITY ||
          'postgresql://teamos_identity_runtime:teamos_identity_password@localhost:5432/teamos?schema=public',
      },
    },
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });
}

/**
 * Creates a new session in the database.
 * Calls public.create_session owned by teamos_identity_admin.
 */
export async function createSession(
  client: PrismaClient,
  userId: string,
  tokenHash: string,
  ttlSeconds = 1209600, // 14 days
  userAgent?: string,
): Promise<string> {
  const result = await client.$queryRaw<{ create_session: string }[]>(
    Prisma.sql`SELECT public.create_session(
      ${userId}::uuid,
      ${tokenHash}::text,
      ${ttlSeconds}::int,
      ${userAgent ? userAgent.slice(0, 255) : null}::text
    )`
  );

  return result.length > 0 ? result[0].create_session : '';
}

/**
 * Resolves a valid unexpired session and joins user details.
 * Calls public.resolve_session_by_hash owned by teamos_identity_admin.
 */
export async function resolveSessionByHash(
  client: PrismaClient,
  tokenHash: string,
): Promise<SessionUser | null> {
  const rows = await client.$queryRaw<RawSessionUser[]>(
    Prisma.sql`SELECT * FROM public.resolve_session_by_hash(${tokenHash}::text)`
  );

  if (rows.length === 0) {
    return null;
  }

  const row = rows[0];
  return {
    sessionId: row.session_id,
    userId: row.user_id,
    expiresAt: row.expires_at,
    lastActiveAt: row.last_active_at,
    login: row.login,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
  };
}

/**
 * Throttled session activity update (executes at most once every 900 seconds).
 * Calls public.touch_session owned by teamos_identity_admin.
 */
export async function touchSession(
  client: PrismaClient,
  sessionId: string,
): Promise<boolean> {
  const result = await client.$queryRaw<{ touch_session: boolean }[]>(
    Prisma.sql`SELECT public.touch_session(${sessionId}::uuid)`
  );

  return result.length > 0 ? result[0].touch_session : false;
}

/**
 * Revokes a session by deleting its record.
 * Calls public.revoke_session owned by teamos_identity_admin.
 */
export async function revokeSession(
  client: PrismaClient,
  tokenHash: string,
): Promise<boolean> {
  const result = await client.$queryRaw<{ revoke_session: boolean }[]>(
    Prisma.sql`SELECT public.revoke_session(${tokenHash}::text)`
  );

  return result.length > 0 ? result[0].revoke_session : false;
}

/**
 * Background maintenance cleanup for expired sessions.
 * Calls public.cleanup_expired_sessions owned by teamos_identity_admin.
 * Authorized for teamos_worker_role.
 */
export async function cleanupExpiredSessions(
  client: PrismaClient,
): Promise<number> {
  const result = await client.$queryRaw<{ cleanup_expired_sessions: number }[]>(
    Prisma.sql`SELECT public.cleanup_expired_sessions()`
  );

  return result.length > 0 ? result[0].cleanup_expired_sessions : 0;
}

/**
 * Upserts a user from GitHub OAuth identity.
 * Performed by teamos_identity_runtime.
 */
export async function upsertUserFromOAuth(
  client: PrismaClient,
  githubUserId: bigint | number,
  login: string,
  displayName?: string | null,
  avatarUrl?: string | null,
): Promise<User> {
  const ghId = typeof githubUserId === 'number' ? BigInt(githubUserId) : githubUserId;

  return client.user.upsert({
    where: { githubUserId: ghId },
    create: {
      githubUserId: ghId,
      login,
      displayName: displayName || null,
      avatarUrl: avatarUrl || null,
    },
    update: {
      login,
      displayName: displayName || null,
      avatarUrl: avatarUrl || null,
    },
  });
}

