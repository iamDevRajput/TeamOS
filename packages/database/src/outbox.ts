import { PrismaClient, Prisma } from '@prisma/client';

export interface OutboxClaimedEvent {
  id: string;
  org_id: string;
  type: string;
  payload: Record<string, unknown>;
  attempts: number;
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
          'postgresql://teamos_worker_role:teamos_worker_password@localhost:5432/teamos?schema=public',
      },
    },
    log: ['error'],
  });
}

/**
 * Claims the next pending outbox event or expired lease.
 * Calls the hardened SECURITY DEFINER function owned by teamos_outbox_admin.
 */
export async function claimNextOutboxEvent(
  client: PrismaClient,
  workerId: string,
  leaseSeconds = 30
): Promise<OutboxClaimedEvent | null> {
  const events = await client.$queryRaw<OutboxClaimedEvent[]>(
    Prisma.sql`SELECT * FROM public.claim_next_outbox_event(${workerId}::text, ${leaseSeconds}::int)`
  );

  return events.length > 0 ? events[0] : null;
}

/**
 * Completes a claimed outbox event.
 * Enforces worker ownership and valid lease check.
 */
export async function completeOutboxEvent(
  client: PrismaClient,
  eventId: string,
  workerId: string
): Promise<boolean> {
  const result = await client.$queryRaw<{ complete_outbox_event: boolean }[]>(
    Prisma.sql`SELECT public.complete_outbox_event(${eventId}::uuid, ${workerId})`
  );

  return result.length > 0 ? result[0].complete_outbox_event : false;
}

/**
 * Fails a claimed outbox event with exponential backoff or dead-letter transition.
 */
export async function failOutboxEvent(
  client: PrismaClient,
  eventId: string,
  workerId: string,
  errorMessage: string
): Promise<string> {
  const result = await client.$queryRaw<{ fail_outbox_event: string }[]>(
    Prisma.sql`SELECT public.fail_outbox_event(${eventId}::uuid, ${workerId}, ${errorMessage})`
  );

  return result.length > 0 ? result[0].fail_outbox_event : 'UNKNOWN_ERROR';
}
