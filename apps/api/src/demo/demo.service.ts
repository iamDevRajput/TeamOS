import { Injectable, Logger } from '@nestjs/common';
import {
  createApiPrismaClient,
  withTenant,
  TenantContext,
  createProject,
  createTask,
  addDependency,
  updateTask,
  listTasks,
  getProjectById,
} from '@teamos/database';
import { TaskStatus, TaskPriority } from '@teamos/contracts';
import { RiskService } from '../risk/risk.service';
import { MeetingsService } from '../meetings/meetings.service';
import { SearchService } from '../search/search.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CollaborationService } from '../collaboration/collaboration.service';

@Injectable()
export class DemoService {
  private readonly logger = new Logger(DemoService.name);
  private readonly prisma = createApiPrismaClient();

  constructor(
    private readonly riskService: RiskService,
    private readonly meetingsService: MeetingsService,
    private readonly searchService: SearchService,
    private readonly notificationsService: NotificationsService,
    private readonly collaborationService: CollaborationService
  ) {}

  async setupEnterpriseDemo(context: TenantContext) {
    const today = new Date();
    const targetDate = new Date();
    targetDate.setDate(today.getDate() + 18);

    const todayIso = today.toISOString().slice(0, 10);
    const targetIso = targetDate.toISOString().slice(0, 10);

    // 1. Create or find Enterprise Demo Project
    const existingProjects = await withTenant(context, async (tx) => {
      return tx.project.findMany({
        where: { orgId: context.orgId, key: 'ENT' },
      });
    });

    let project = existingProjects[0];
    if (!project) {
      project = await createProject(context, {
        name: 'TeamOS Enterprise Demo',
        key: 'ENT',
        startDate: todayIso,
        dueDate: targetIso,
        timezone: 'UTC',
      });
    }

    // Check if tasks already exist
    const existingTasks = await listTasks(context, project.id);

    if (existingTasks.length === 0) {
      // Task 1
      const t1 = await createTask(context, project.id, {
        title: 'Core Authentication & Forced RLS Isolation',
        description: 'Establish multi-tenant schema with forced Row-Level Security and session cookies.',
        status: TaskStatus.DONE,
        priority: TaskPriority.HIGH,
        remainingEstimateWorkdays: 0,
      });

      // Task 2 (The one that will be delayed)
      const t2 = await createTask(context, project.id, {
        title: 'Backend API & External Integrations Pipeline',
        description: 'Implement GitHub OAuth, webhook HMAC signature verification, and transactional outbox.',
        status: TaskStatus.IN_PROGRESS,
        priority: TaskPriority.URGENT,
        remainingEstimateWorkdays: 4,
      });

      // Task 3
      const t3 = await createTask(context, project.id, {
        title: 'Real-time WebSockets & Presence Coordination',
        description: 'Deploy native WebSocket room subscriptions and live project presence heartbeat.',
        status: TaskStatus.TODO,
        priority: TaskPriority.MEDIUM,
        remainingEstimateWorkdays: 3,
      });

      // Task 4
      const t4 = await createTask(context, project.id, {
        title: 'E2E Delivery Verification & Production Staging',
        description: 'Execute Playwright release verification and security boundary audit.',
        status: TaskStatus.TODO,
        priority: TaskPriority.HIGH,
        remainingEstimateWorkdays: 2,
      });

      // Dependencies: 1 -> 2 -> 3 -> 4
      await addDependency(context, {
        projectId: project.id,
        blockerTaskId: t1.id,
        blockedTaskId: t2.id,
      });

      await addDependency(context, {
        projectId: project.id,
        blockerTaskId: t2.id,
        blockedTaskId: t3.id,
      });

      await addDependency(context, {
        projectId: project.id,
        blockerTaskId: t3.id,
        blockedTaskId: t4.id,
      });

      // Meeting
      await this.meetingsService.create(context, project.id, {
        title: 'Sprint 14 Architecture & Delivery Alignment',
        transcript: `Dev: We completed Task 1 (Core Authentication).
Sarah: Backend API integration in Task 2 is progressing, but third-party provider webhooks require extra retry handlers.
Alex: Action item: Implement GitHub webhook HMAC idempotency buffer before connecting frontend.
Dev: Agreed, let's keep Task 3 dependent on the completed webhook pipeline.`,
      });

      // Search indexing
      await this.searchService.indexAll(context, project.id);
    }

    return {
      projectId: project.id,
      projectKey: project.key,
      projectName: project.name,
      status: 'ready',
    };
  }

  async triggerStepDelay(context: TenantContext, projectId: string) {
    const project = await getProjectById(context, projectId);
    if (!project) throw new Error('Demo project not found');

    const tasks = await listTasks(context, projectId);

    const targetTask = tasks.find((t) => t.number === 2) || tasks[1];
    if (!targetTask) throw new Error('Target task #2 not found in demo project');

    const originalEstimate = targetTask.remainingEstimateWorkdays || 4;
    const newEstimate = originalEstimate + 4; // Introduce 4-day backend delay

    // Update task
    await updateTask(context, projectId, targetTask.id, {
      remainingEstimateWorkdays: newEstimate,
      expectedVersion: targetTask.version,
    });

    // Run risk engine
    const updatedRisk = await this.riskService.getProjectRisk(context, projectId);

    // Create Notification
    await this.notificationsService.createAndPushNotification(context, {
      userId: context.userId,
      type: 'RISK_SPIKE',
      title: `⚠️ Delivery Risk Alert: #${targetTask.number} Delayed`,
      body: `Task "${targetTask.title}" delayed by +4 workdays. Delivery forecast slipped to ${updatedRisk.forecastDeliveryDate} (+${updatedRisk.deliveryVarianceWorkdays || 2} days variance).`,
      entityType: 'project',
      entityId: projectId,
    });

    // Broadcast live WebSocket event
    this.collaborationService.broadcastToProject(context.orgId, projectId, 'risk:alert', {
      task: targetTask,
      delayDays: 4,
      risk: updatedRisk,
    });

    return {
      message: `Injected 4-day backend delay on #${targetTask.number} (${targetTask.title}).`,
      originalEstimate,
      newEstimate,
      newForecastDate: updatedRisk.forecastDeliveryDate,
      scheduleVarianceDays: updatedRisk.deliveryVarianceWorkdays,
      isDelayed: updatedRisk.isDelayed,
    };
  }
}
