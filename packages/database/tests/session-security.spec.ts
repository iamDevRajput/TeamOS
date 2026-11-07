import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { Pool } from "pg";
import crypto from "crypto";
import {
  createIdentityPrismaClient,
  createWorkerPrismaClient,
  createSession,
  resolveSessionByHash,
  touchSession,
  revokeSession,
  cleanupExpiredSessions,
  upsertUserFromOAuth,
} from "../src/index";

const IDENTITY_DB_URL =
  process.env.DATABASE_URL_IDENTITY ||
  "postgresql://teamos_identity_runtime:teamos_identity_password@localhost:5432/teamos?schema=public";

const API_DB_URL =
  process.env.DATABASE_URL ||
  "postgresql://teamos_api_role:teamos_api_password@localhost:5432/teamos?schema=public";

const WORKER_DB_URL =
  process.env.DATABASE_URL_WORKER ||
  "postgresql://teamos_worker_role:teamos_worker_password@localhost:5432/teamos?schema=public";

const OWNER_DB_URL =
  process.env.DATABASE_URL_MIGRATION ||
  "postgresql://teamos_owner:teamos_owner_password@localhost:5432/teamos?schema=public";

describe("Identity & Session Database Architecture and RBAC Specification", () => {
  let identityPrisma: ReturnType<typeof createIdentityPrismaClient>;
  let workerPrisma: ReturnType<typeof createWorkerPrismaClient>;
  let apiPool: Pool;
  let identityPool: Pool;
  let workerPool: Pool;
  let ownerPool: Pool;

  beforeAll(async () => {
    identityPrisma = createIdentityPrismaClient(IDENTITY_DB_URL);
    workerPrisma = createWorkerPrismaClient(WORKER_DB_URL);
    apiPool = new Pool({ connectionString: API_DB_URL });
    identityPool = new Pool({ connectionString: IDENTITY_DB_URL });
    workerPool = new Pool({ connectionString: WORKER_DB_URL });
    ownerPool = new Pool({ connectionString: OWNER_DB_URL });

    // Ensure database connection
    await identityPrisma.$connect();
    await workerPrisma.$connect();
  });

  afterAll(async () => {
    await identityPrisma.$disconnect();
    await workerPrisma.$disconnect();
    await apiPool.end();
    await identityPool.end();
    await workerPool.end();
    await ownerPool.end();
  });

  describe("Session Lifecycle and Hashing Verification", () => {
    const testGithubUserId = BigInt(555444333);
    let userId: string;
    const rawToken = crypto.randomBytes(32).toString("base64url");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    let sessionId: string;

    it("upserts user from GitHub OAuth profile using teamos_identity_runtime", async () => {
      const user = await upsertUserFromOAuth(
        identityPrisma,
        testGithubUserId,
        "mona-lisa-tester",
        "Mona Lisa",
        "https://avatars.githubusercontent.com/u/555444333",
      );

      expect(user).toBeDefined();
      expect(user.login).toBe("mona-lisa-tester");
      expect(user.displayName).toBe("Mona Lisa");
      userId = user.id;
    });

    it("creates a session storing only SHA-256 token hash", async () => {
      sessionId = await createSession(
        identityPrisma,
        userId,
        tokenHash,
        86400, // 1 day
        "Vitest Security Agent",
      );

      expect(sessionId).toBeDefined();
      expect(typeof sessionId).toBe("string");
      expect(sessionId.length).toBeGreaterThan(10);
    });

    it("resolves active session and user by token hash", async () => {
      const sessionUser = await resolveSessionByHash(identityPrisma, tokenHash);

      expect(sessionUser).not.toBeNull();
      expect(sessionUser?.sessionId).toBe(sessionId);
      expect(sessionUser?.userId).toBe(userId);
      expect(sessionUser?.login).toBe("mona-lisa-tester");
      expect(sessionUser?.displayName).toBe("Mona Lisa");
    });

    it("returns null when querying by raw token instead of hash", async () => {
      const result = await resolveSessionByHash(identityPrisma, rawToken);
      expect(result).toBeNull();
    });

    it("enforces 15-minute touch throttling", async () => {
      // Calling touchSession immediately after creation must be skipped by throttling
      const touched = await touchSession(identityPrisma, sessionId);
      expect(touched).toBe(false);
    });

    it("revokes active session so it is no longer resolvable", async () => {
      const revoked = await revokeSession(identityPrisma, tokenHash);
      expect(revoked).toBe(true);

      const resolved = await resolveSessionByHash(identityPrisma, tokenHash);
      expect(resolved).toBeNull();
    });
  });

  describe("Mandatory RBAC Privilege Denials — teamos_api_role", () => {
    it("denies direct SELECT on public.sessions to teamos_api_role", async () => {
      await expect(
        apiPool.query("SELECT * FROM public.sessions LIMIT 1"),
      ).rejects.toThrow(/permission denied for table sessions/i);
    });

    it("denies direct INSERT on public.sessions to teamos_api_role", async () => {
      await expect(
        apiPool.query(
          "INSERT INTO public.sessions (id, user_id, session_token_hash, expires_at) VALUES (gen_random_uuid(), gen_random_uuid(), 'hack', NOW())",
        ),
      ).rejects.toThrow(/permission denied for table sessions/i);
    });

    it("denies execution of create_session to teamos_api_role", async () => {
      await expect(
        apiPool.query(
          "SELECT public.create_session(gen_random_uuid(), 'hash', 3600, 'ua')",
        ),
      ).rejects.toThrow(/permission denied for function create_session/i);
    });

    it("denies execution of resolve_session_by_hash to teamos_api_role", async () => {
      await expect(
        apiPool.query("SELECT * FROM public.resolve_session_by_hash('hash')"),
      ).rejects.toThrow(/permission denied for function resolve_session_by_hash/i);
    });

    it("denies execution of touch_session to teamos_api_role", async () => {
      await expect(
        apiPool.query("SELECT public.touch_session(gen_random_uuid())"),
      ).rejects.toThrow(/permission denied for function touch_session/i);
    });

    it("denies execution of revoke_session to teamos_api_role", async () => {
      await expect(
        apiPool.query("SELECT public.revoke_session('hash')"),
      ).rejects.toThrow(/permission denied for function revoke_session/i);
    });

    it("denies execution of cleanup_expired_sessions to teamos_api_role", async () => {
      await expect(
        apiPool.query("SELECT public.cleanup_expired_sessions()"),
      ).rejects.toThrow(/permission denied for function cleanup_expired_sessions/i);
    });
  });

  describe("Mandatory RBAC Privilege Boundaries — teamos_identity_runtime", () => {
    it("denies direct table access to public.sessions for teamos_identity_runtime", async () => {
      await expect(
        identityPool.query("SELECT * FROM public.sessions LIMIT 1"),
      ).rejects.toThrow(/permission denied for table sessions/i);
    });

    it("denies execution of cleanup_expired_sessions to teamos_identity_runtime", async () => {
      await expect(
        identityPool.query("SELECT public.cleanup_expired_sessions()"),
      ).rejects.toThrow(/permission denied for function cleanup_expired_sessions/i);
    });
  });

  describe("Mandatory RBAC Privilege Boundaries — teamos_worker_role", () => {
    it("allows execution of cleanup_expired_sessions for teamos_worker_role", async () => {
      const cleaned = await cleanupExpiredSessions(workerPrisma);
      expect(typeof cleaned).toBe("number");
      expect(cleaned).toBeGreaterThanOrEqual(0);
    });

    it("denies execution of create_session to teamos_worker_role", async () => {
      await expect(
        workerPool.query(
          "SELECT public.create_session(gen_random_uuid(), 'hash', 3600, 'ua')",
        ),
      ).rejects.toThrow(/permission denied for function create_session/i);
    });

    it("denies execution of resolve_session_by_hash to teamos_worker_role", async () => {
      await expect(
        workerPool.query("SELECT * FROM public.resolve_session_by_hash('hash')"),
      ).rejects.toThrow(/permission denied for function resolve_session_by_hash/i);
    });

    it("denies execution of touch_session to teamos_worker_role", async () => {
      await expect(
        workerPool.query("SELECT public.touch_session(gen_random_uuid())"),
      ).rejects.toThrow(/permission denied for function touch_session/i);
    });

    it("denies execution of revoke_session to teamos_worker_role", async () => {
      await expect(
        workerPool.query("SELECT public.revoke_session('hash')"),
      ).rejects.toThrow(/permission denied for function revoke_session/i);
    });
  });
});
