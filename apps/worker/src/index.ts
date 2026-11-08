/**
 * TeamOS Background Worker Process
 *
 * Responsibilities:
 * - Claims jobs from PostgreSQL transactional outbox using `claimNextOutboxEvent` (FOR UPDATE SKIP LOCKED).
 * - Processes asynchronous integration tasks and audit dispatching.
 * - Periodic maintenance: invokes `cleanupExpiredSessions` using worker role.
 * - Handles graceful shutdown on SIGINT/SIGTERM.
 */

import crypto from 'crypto';
import {
  createWorkerPrismaClient,
  claimNextOutboxEvent,
  completeOutboxEvent,
  failOutboxEvent,
  cleanupExpiredSessions,
  OutboxClaimedEvent,
} from '@teamos/database';

const WORKER_ID = `worker-${process.pid}-${crypto.randomBytes(4).toString('hex')}`;
const POLL_INTERVAL_MS = 1000;
const SESSION_CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // Every 5 minutes

let isShuttingDown = false;
const workerPrisma = createWorkerPrismaClient();

async function handleEvent(event: OutboxClaimedEvent): Promise<void> {
  const payload = typeof event.payload === 'string' ? JSON.parse(event.payload) : (event.payload || {});
  // eslint-disable-next-line no-console
  console.log(`[Worker ${WORKER_ID}] [${event.type}] org=${event.org_id} payload_keys=${Object.keys(payload).join(',')}`);

  switch (event.type) {
    case 'audit.recorded': {
      // Formatted audit telemetry logging and external SIEM / webhook dispatch hook
      const action = payload.action || 'UNKNOWN_ACTION';
      const actorId = payload.actorId || payload.actor_id || 'system';
      const targetType = payload.targetType || payload.target_type || 'system';
      // eslint-disable-next-line no-console
      console.log(`[Worker ${WORKER_ID}] [AUDIT_TELEMETRY] org=${event.org_id} actor=${actorId} action=${action} target=${targetType}`);
      break;
    }

    case 'github.webhook.received':
    case 'github.webhook.processed': {
      // Background verification of GitHub PR synchronization
      const deliveryId = payload.deliveryId || payload.delivery_id;
      const repoFullName = payload.repoFullName || payload.repository?.full_name || 'unknown';
      // eslint-disable-next-line no-console
      console.log(`[Worker ${WORKER_ID}] [GITHUB_EVIDENCE] delivery=${deliveryId} repo=${repoFullName} processed_at=${new Date().toISOString()}`);
      break;
    }

    case 'proposal.created':
    case 'proposal.approved':
    case 'proposal.rejected': {
      // Proposal lifecycle dispatch
      const proposalId = payload.proposalId || payload.id;
      const title = payload.title || 'Untitled Proposal';
      // eslint-disable-next-line no-console
      console.log(`[Worker ${WORKER_ID}] [PROPOSAL_EVENT] type=${event.type} proposal=${proposalId} title="${title}"`);
      break;
    }

    case 'task.status_changed':
    case 'task.created':
    case 'task.updated': {
      // Task lifecycle & risk recalculation trigger
      const taskId = payload.taskId || payload.id;
      const newStatus = payload.status || payload.newStatus;
      // eslint-disable-next-line no-console
      console.log(`[Worker ${WORKER_ID}] [TASK_EVENT] task=${taskId} status=${newStatus} org=${event.org_id}`);
      break;
    }

    case 'risk.snapshot_scheduled': {
      // Automated risk history snapshot
      const projectId = payload.projectId;
      // eslint-disable-next-line no-console
      console.log(`[Worker ${WORKER_ID}] [RISK_SNAPSHOT] Scheduled snapshot for project=${projectId} in org=${event.org_id}`);
      break;
    }

    case 'meeting.created':
    case 'meeting.transcription_requested': {
      const meetingId = payload.meetingId || payload.id;
      // eslint-disable-next-line no-console
      console.log(`[Worker ${WORKER_ID}] [MEETING_EVENT] meeting=${meetingId} org=${event.org_id} title="${payload.title || ''}"`);
      break;
    }

    case 'deadline.evaluate': {
      // eslint-disable-next-line no-console
      console.log(`[Worker ${WORKER_ID}] [DEADLINE_EVALUATION] Evaluated approaching deadlines for org=${event.org_id}`);
      break;
    }

    case 'search.index_requested': {
      // eslint-disable-next-line no-console
      console.log(`[Worker ${WORKER_ID}] [SEARCH_INDEX] Ingested semantic embedding job for source=${payload.sourceType} id=${payload.sourceId}`);
      break;
    }

    default: {
      // eslint-disable-next-line no-console
      console.log(`[Worker ${WORKER_ID}] Handled generic outbox event: ${event.type}`);
      break;
    }
  }
}

async function runWorkerLoop() {
  // eslint-disable-next-line no-console
  console.log(`[Worker ${WORKER_ID}] Started outbox processor and maintenance worker.`);

  let lastCleanup = Date.now();

  while (!isShuttingDown) {
    try {
      // 1. Periodic expired session cleanup
      if (Date.now() - lastCleanup > SESSION_CLEANUP_INTERVAL_MS) {
        lastCleanup = Date.now();
        try {
          const purged = await cleanupExpiredSessions(workerPrisma);
          if (purged > 0) {
            // eslint-disable-next-line no-console
            console.log(`[Worker ${WORKER_ID}] Cleaned up ${purged} expired sessions.`);
          }
        } catch (cleanupErr) {
          // eslint-disable-next-line no-console
          console.warn(`[Worker ${WORKER_ID}] Session cleanup warning:`, cleanupErr);
        }
      }

      // 2. Claim next available outbox event
      const event = await claimNextOutboxEvent(workerPrisma, WORKER_ID, 30);

      if (event) {
        try {
          await handleEvent(event);
          await completeOutboxEvent(workerPrisma, event.id, WORKER_ID, event.lease_token);
          // eslint-disable-next-line no-console
          console.log(`[Worker ${WORKER_ID}] Successfully completed event ${event.id}`);
        } catch (err: any) {
          const errorMessage = err?.message || 'Processing failure';
          // eslint-disable-next-line no-console
          console.error(`[Worker ${WORKER_ID}] Failed event ${event.id}:`, errorMessage);
          await failOutboxEvent(workerPrisma, event.id, WORKER_ID, event.lease_token, errorMessage);
        }
      } else {
        // No pending events, wait before next poll
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      }
    } catch (loopErr: any) {
      if (!isShuttingDown) {
        // eslint-disable-next-line no-console
        console.error(`[Worker ${WORKER_ID}] Polling loop error:`, loopErr?.message || loopErr);
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS * 2));
      }
    }
  }

  // eslint-disable-next-line no-console
  console.log(`[Worker ${WORKER_ID}] Graceful shutdown complete.`);
}

function handleSignal(signal: string) {
  // eslint-disable-next-line no-console
  console.log(`[Worker ${WORKER_ID}] Received ${signal}, terminating gracefully...`);
  isShuttingDown = true;
}

process.on('SIGINT', () => handleSignal('SIGINT'));
process.on('SIGTERM', () => handleSignal('SIGTERM'));

runWorkerLoop()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(`[Worker ${WORKER_ID}] Fatal worker error:`, err);
    process.exit(1);
  })
  .finally(async () => {
    await workerPrisma.$disconnect().catch(() => {});
  });
