import { Prisma, AuditEvent, ActorType } from '@prisma/client';
import { withTenant, TenantContext } from './with-tenant';

export interface RecordAuditParams {
  orgId: string;
  actorType: ActorType;
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  beforeData?: Record<string, any> | null;
  afterData?: Record<string, any> | null;
  requestId?: string | null;
}

export interface ListAuditOptions {
  entityType?: string;
  entityId?: string;
  limit?: number;
}

const REDACTED_KEYS = new Set([
  'token',
  'rawtoken',
  'tokenhash',
  'token_hash',
  'password',
  'secret',
  'cookie',
  'codeverifier',
  'code_verifier',
  'authorization',
  'privatekey',
  'private_key',
]);

/**
 * Strips sensitive keys (tokens, secrets, credentials) before persisting into audit log.
 */
function sanitizeAuditPayload(data?: Record<string, any> | null): Record<string, any> | null {
  if (!data || typeof data !== 'object') return null;

  const sanitized: Record<string, any> = {};
  for (const [key, val] of Object.entries(data)) {
    if (REDACTED_KEYS.has(key.toLowerCase())) {
      sanitized[key] = '[REDACTED]';
    } else if (val && typeof val === 'object' && !Array.isArray(val)) {
      sanitized[key] = sanitizeAuditPayload(val);
    } else {
      sanitized[key] = val;
    }
  }
  return sanitized;
}

/**
 * Records an audit event inside an ongoing interactive transaction client.
 * Guarantees that business state changes and audit events commit or rollback together.
 */
export async function recordAuditEvent(
  tx: Prisma.TransactionClient,
  params: RecordAuditParams,
): Promise<AuditEvent> {
  return tx.auditEvent.create({
    data: {
      orgId: params.orgId,
      actorType: params.actorType,
      actorId: params.actorId,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      beforeData: sanitizeAuditPayload(params.beforeData) ?? Prisma.DbNull,
      afterData: sanitizeAuditPayload(params.afterData) ?? Prisma.DbNull,
      requestId: params.requestId ?? null,
    },
  });
}

/**
 * Lists audit events for an organization enforcing PostgreSQL RLS isolation.
 */
export async function listAuditEvents(
  context: TenantContext,
  options?: ListAuditOptions,
): Promise<AuditEvent[]> {
  return withTenant(context, async (tx) => {
    const where: Prisma.AuditEventWhereInput = {
      orgId: context.orgId,
    };

    if (options?.entityType) {
      where.entityType = options.entityType;
    }
    if (options?.entityId) {
      where.entityId = options.entityId;
    }

    const limit = Math.min(Math.max(options?.limit || 50, 1), 100);

    return tx.auditEvent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  });
}
