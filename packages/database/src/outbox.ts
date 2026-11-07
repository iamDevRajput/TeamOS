import { PrismaClient, Prisma } from "@prisma/client";

export interface OutboxClaimedEvent {
  id: string;
  org_id: string;
  type: string;
  payload: Record<string, unknown>;
  attempts: number;
  lease_token: string;
}

/**
 * Sanitizes sensitive credentials, JWTs, authorization headers, and API keys
 * from error strings prior to persistence (defense-in-depth alongside database-level redaction).
 */
export function sanitizeErrorMessage(message: string): string {
  if (!message) return "Unknown error";

  let sanitized = message;
  // 1. Connection strings containing passwords
  sanitized = sanitized.replace(
    /([a-zA-Z]+:\/\/[^:]+:)[^@]+(@)/g,
    "$1[REDACTED]$2",
  );
  // 2. Bearer tokens
  sanitized = sanitized.replace(
    /Bearer\s+[A-Za-z0-9_\-.~+/]+=*/gi,
    "Bearer [REDACTED]",
  );
  // 3. JWTs
  sanitized = sanitized.replace(
    /ey[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+/g,
    "[REDACTED_JWT]",
  );
  // 4. Known token prefixes (GitHub tokens, OpenAI/Anthropic keys)
  sanitized = sanitized.replace(
    /(gh[pousr]_[A-Za-z0-9_]{10,}|github_pat_[A-Za-z0-9_]{10,}|sk-[A-Za-z0-9_]{10,})/g,
    "[REDACTED_TOKEN]",
  );
  // 5. JSON fields with sensitive keys
  sanitized = sanitized.replace(
    /("?(?:[a-zA-Z0-9_]*(?:password|secret|token|api_key|apikey|auth)[a-zA-Z0-9_]*)"?\s*:\s*)"[^"]+"/gi,
    '$1"[REDACTED]"',
  );
  // 6. Plain key=value or key: value pairs
  sanitized = sanitized.replace(
    /([a-zA-Z0-9_-]*(?:password|secret|token|api_key|apikey|auth)[a-zA-Z0-9_-]*)(\s*[:=]\s*)([^\s,;"]+)/gi,
    "$1$2[REDACTED]",
  );

  return sanitized.slice(0, 1000);
}

/**
 * Worker-scoped database client (uses DATABASE_URL_WORKER).
 */
export function createWorkerPrismaClient(databaseUrl?: string): PrismaClient {
  return new PrismaClient({
    datasources: {
      db: {
        url:
          databaseUrl ||
          process.env.DATABASE_URL_WORKER ||
          "postgresql://teamos_worker_role:teamos_worker_password@localhost:5432/teamos?schema=public",
      },
    },
    log: ["error"],
  });
}

/**
 * Claims the next pending outbox event or reclaimable expired lease below max_attempts.
 * Returns an unforgeable unique lease_token for the claim session.
 * Calls the hardened SECURITY DEFINER function owned by teamos_outbox_admin.
 */
export async function claimNextOutboxEvent(
  client: PrismaClient,
  workerId: string,
  leaseSeconds = 30,
): Promise<OutboxClaimedEvent | null> {
  const events = await client.$queryRaw<OutboxClaimedEvent[]>(
    Prisma.sql`SELECT * FROM public.claim_next_outbox_event(${workerId}::text, ${leaseSeconds}::int)`,
  );

  return events.length > 0 ? events[0] : null;
}

/**
 * Completes a claimed outbox event.
 * Enforces worker ownership, matching lease token, and valid unexpired lease.
 */
export async function completeOutboxEvent(
  client: PrismaClient,
  eventId: string,
  workerId: string,
  leaseToken: string,
): Promise<boolean> {
  const result = await client.$queryRaw<{ complete_outbox_event: boolean }[]>(
    Prisma.sql`SELECT public.complete_outbox_event(${eventId}::uuid, ${workerId}::text, ${leaseToken}::uuid)`,
  );

  return result.length > 0 ? result[0].complete_outbox_event : false;
}

/**
 * Fails a claimed outbox event with atomic ownership check, exponential backoff,
 * or transition to DEAD at max_attempts. Rejects stale or expired leases without modifying the event.
 */
export async function failOutboxEvent(
  client: PrismaClient,
  eventId: string,
  workerId: string,
  leaseToken: string,
  errorMessage: string,
): Promise<string> {
  const sanitized = sanitizeErrorMessage(errorMessage);
  const result = await client.$queryRaw<{ fail_outbox_event: string }[]>(
    Prisma.sql`SELECT public.fail_outbox_event(${eventId}::uuid, ${workerId}::text, ${leaseToken}::uuid, ${sanitized}::text)`,
  );

  return result.length > 0 ? result[0].fail_outbox_event : "UNKNOWN_ERROR";
}
