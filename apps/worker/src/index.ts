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
  // eslint-disable-next-line no-console
  console.log(`[Worker ${WORKER_ID}] Processing event ${event.id} (type=${event.type}, org=${event.org_id})`);

  switch (event.type) {
    case 'audit.recorded': {
      // Dispatches or pushes audit notifications if configured
      break;
    }
    case 'github.webhook.received':
    case 'github.webhook.processed': {
      // Asynchronous background follow-up on GitHub PR sync
      break;
    }
    case 'proposal.created':
    case 'proposal.approved':
    case 'proposal.rejected': {
      // Notification or background sync hooks
      break;
    }
    default: {
      // eslint-disable-next-line no-console
      console.log(`[Worker ${WORKER_ID}] Handled generic outbox event type: ${event.type}`);
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
