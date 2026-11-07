import { Prisma } from "@prisma/client";
import { prisma } from "./client";

export type OrgRole = "OWNER" | "ADMIN" | "MEMBER";

export interface TenantContext {
  readonly orgId: string;
  readonly userId: string;
  readonly role?: OrgRole;
  readonly requestId?: string;
}

export interface TransactionOptions {
  timeoutMs?: number;
  maxWaitMs?: number;
}

interface SetConfigResult {
  set_config: string;
}

/**
 * UUID validation regex to fail fast before touching the database.
 */
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Centralized transaction gateway for tenant-scoped operations.
 * Raw PrismaClient is never exported outside packages/database.
 */
export async function withTenant<T>(
  context: TenantContext,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
  options: TransactionOptions = {},
): Promise<T> {
  if (!context || !context.orgId || !context.userId) {
    throw new Error("TenantContext error: orgId and userId are required.");
  }

  if (!UUID_REGEX.test(context.orgId)) {
    throw new Error(
      `TenantContext error: orgId "${context.orgId}" is not a valid UUID.`,
    );
  }

  if (!UUID_REGEX.test(context.userId)) {
    throw new Error(
      `TenantContext error: userId "${context.userId}" is not a valid UUID.`,
    );
  }

  return prisma.$transaction(
    async (tx: Prisma.TransactionClient) => {
      // Set transaction-local session variables using parameterized $queryRaw
      // is_local = true (third argument) ensures variables reset when transaction closes
      await tx.$queryRaw<SetConfigResult[]>(
        Prisma.sql`SELECT set_config('app.org_id', ${context.orgId}, true) AS set_config`,
      );
      await tx.$queryRaw<SetConfigResult[]>(
        Prisma.sql`SELECT set_config('app.user_id', ${context.userId}, true) AS set_config`,
      );

      return await fn(tx);
    },
    {
      timeout: options.timeoutMs ?? 5000,
      maxWait: options.maxWaitMs ?? 2000,
    },
  );
}
