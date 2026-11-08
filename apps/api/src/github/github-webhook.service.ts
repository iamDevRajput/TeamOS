import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import crypto from 'crypto';
import {
  createApiPrismaClient,
  saveWebhookDelivery,
  createProposal,
  saveGithubInstallation,
  linkPrToTask,
  TenantContext,
  OrgRole,
} from '@teamos/database';

export interface TaskKeyMatch {
  projectKey: string;
  taskNumber: number;
}

@Injectable()
export class GithubWebhookService {
  private readonly logger = new Logger(GithubWebhookService.name);
  private readonly prisma = createApiPrismaClient();

  /**
   * Verifies GitHub webhook HMAC-SHA256 signature using constant-time comparison
   * to prevent timing attacks over the raw request body.
   */
  verifySignature(rawBody: Buffer | string, signatureHeader?: string): boolean {
    if (!signatureHeader || !signatureHeader.startsWith('sha256=')) {
      return false;
    }

    const secret = process.env.GITHUB_WEBHOOK_SECRET || 'teamos-dev-webhook-secret';
    const signature = signatureHeader.slice(7);

    const hmac = crypto.createHmac('sha256', secret);
    const bodyBuffer = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody || '', 'utf8');
    const computedHex = hmac.update(bodyBuffer).digest('hex');

    const computedBuffer = Buffer.from(computedHex, 'utf8');
    const providedBuffer = Buffer.from(signature, 'utf8');

    if (computedBuffer.length !== providedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(computedBuffer, providedBuffer);
  }

  /**
   * Extracts project task identifiers (e.g. "DEL-12", "PROJ-4") from PR titles or branches.
   */
  extractTaskKeys(text: string): TaskKeyMatch[] {
    if (!text) return [];
    const regex = /\b([A-Z]{2,10})-(\d+)\b/g;
    const matches: TaskKeyMatch[] = [];
    const seen = new Set<string>();

    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      const key = `${match[1]}-${match[2]}`;
      if (!seen.has(key)) {
        seen.add(key);
        matches.push({
          projectKey: match[1],
          taskNumber: parseInt(match[2], 10),
        });
      }
    }

    return matches;
  }

  /**
   * Processes an incoming GitHub webhook event.
   * Handles idempotency via deliveryId deduplication and matches PRs with project tasks.
   */
  async processWebhookEvent(
    deliveryId: string,
    eventType: string,
    payload: any,
  ): Promise<{ received: boolean; deduplicated?: boolean; matches?: number; proposalCreated?: boolean }> {
    if (!deliveryId) {
      throw new BadRequestException('Missing x-github-delivery header.');
    }

    // 1. Durable delivery deduplication
    const saveResult = await saveWebhookDelivery(
      this.prisma,
      deliveryId,
      eventType,
      payload.action || null,
      payload,
    ).catch(() => ({ deduplicated: false }));

    if (saveResult.deduplicated) {
      this.logger.log(`Webhook delivery ${deliveryId} already processed (deduplicated).`);
      return { received: true, deduplicated: true };
    }

    // 2. Handle GitHub App Installation events
    if (eventType === 'installation' || eventType === 'installation_repositories') {
      const installation = payload.installation;
      if (installation) {
        const installationId = installation.id;
        const account = installation.account || {};
        const repos = (payload.repositories || payload.repositories_added || []).map((r: any) => ({
          repoId: r.id,
          repoName: r.name,
          repoFullName: r.full_name,
          isPrivate: r.private ?? true,
        }));

        this.logger.log(
          `GitHub App installation #${installationId} (${payload.action}) for account ${account.login}. Repos: ${repos.length}`,
        );
      }
      return { received: true };
    }

    // 3. Process pull_request events
    if (eventType === 'pull_request') {
      const pr = payload.pull_request;
      if (!pr) return { received: true, matches: 0 };

      const action = payload.action;
      const isMerged = pr.merged === true;
      const title = pr.title || '';
      const branch = pr.head?.ref || '';
      const body = pr.body || '';

      const matchedKeys = this.extractTaskKeys(`${title} ${branch} ${body}`);
      this.logger.log(
        `GitHub PR #${pr.number} (${action}, merged=${isMerged}): detected ${matchedKeys.length} task keys.`,
      );

      let proposalCreated = false;
      const repoId = payload.repository?.id;

      if (repoId && matchedKeys.length > 0) {
        try {
          const repo = await this.prisma.githubRepository.findFirst({
            where: { repoId: BigInt(repoId) },
            include: { project: true },
          });

          if (repo && repo.projectId) {
            for (const matchedKey of matchedKeys) {
              if (matchedKey.projectKey === repo.project?.key) {
                const task = await this.prisma.task.findFirst({
                  where: {
                    orgId: repo.orgId,
                    projectId: repo.projectId,
                    number: matchedKey.taskNumber,
                  },
                });

                if (task) {
                  // Determine stalled status (>3 days without activity)
                  const updatedAt = pr.updated_at ? new Date(pr.updated_at).getTime() : Date.now();
                  const isStalled = action !== 'closed' && (Date.now() - updatedAt > 3 * 86400 * 1000);
                  const prState = isMerged ? 'merged' : (action === 'closed' ? 'closed' : 'open');

                  const systemContext: TenantContext = {
                    orgId: repo.orgId,
                    userId: task.createdBy,
                    role: OrgRole.ADMIN,
                    requestId: `webhook-pr-${pr.number}`,
                  };

                  // 1. Persist GitHub PR Evidence in task_github_links
                  await linkPrToTask(systemContext, task.id, {
                    prNumber: pr.number,
                    prTitle: pr.title || `PR #${pr.number}`,
                    prUrl: pr.html_url || `https://github.com/pull/${pr.number}`,
                    prBranch: pr.head?.ref || 'main',
                    prState,
                    isStalled,
                  });
                  this.logger.log(`Linked PR #${pr.number} (state=${prState}, stalled=${isStalled}) to task ${task.id}`);

                  // 2. If PR is merged and references project tasks, suggest status change via human-reviewable Proposal
                  if (action === 'closed' && isMerged && task.status !== 'DONE') {
                    await createProposal(systemContext, repo.projectId, {
                      title: `Mark ${task.title} as DONE (PR #${pr.number} Merged)`,
                      description: `Automated proposal from merged GitHub PR #${pr.number}: "${title}" by @${pr.user?.login}.`,
                      kind: 'STATUS_CHANGE',
                      payload: {
                        tasksToUpdate: [
                          {
                            taskId: task.id,
                            status: 'DONE',
                            expectedVersion: task.version,
                          },
                        ],
                      },
                    });
                    proposalCreated = true;
                    this.logger.log(`Created STATUS_CHANGE proposal for task ${task.id} from merged PR #${pr.number}`);
                  }
                }
              }
            }
          }
        } catch (prErr) {
          this.logger.warn(`Failed to process PR evidence or proposal: ${prErr}`);
        }
      }

      return {
        received: true,
        matches: matchedKeys.length,
        proposalCreated,
      };
    }

    return { received: true };
  }
}
