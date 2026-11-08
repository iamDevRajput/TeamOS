import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { OrgRole, TaskStatus } from '@teamos/contracts';
import { SessionUser, Membership } from '@teamos/database';

describe('ProjectsController Specification', () => {
  let controller: ProjectsController;
  let mockProjectsService: Partial<ProjectsService>;

  const mockUser: SessionUser = {
    sessionId: 'session-uuid-1',
    userId: '10000000-0000-0000-0000-000000000001',
    login: 'testuser',
    displayName: 'Test User',
    avatarUrl: null,
    expiresAt: new Date(Date.now() + 86400000),
    lastActiveAt: new Date(),
  };

  const mockMembership: Membership = {
    orgId: 'a0000000-0000-0000-0000-000000000001',
    userId: mockUser.userId,
    role: OrgRole.ADMIN,
    createdAt: new Date(),
  };

  const mockProject = {
    id: 'b1111111-1111-1111-1111-111111111111',
    orgId: mockMembership.orgId,
    key: 'CORE',
    name: 'Core Platform',
    startDate: '2026-11-01',
    dueDate: '2026-12-15',
    timezone: 'UTC',
    nextTaskNumber: 2,
    taskCount: 1,
    createdAt: new Date().toISOString(),
  };

  const mockTask = {
    id: 'c1111111-1111-1111-1111-111111111111',
    orgId: mockMembership.orgId,
    projectId: mockProject.id,
    number: 1,
    title: 'Initialize database schema',
    description: 'PostgreSQL 16 with RLS',
    status: TaskStatus.TODO,
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    mockProjectsService = {
      createProject: vi.fn().mockResolvedValue(mockProject),
      listProjects: vi.fn().mockResolvedValue([mockProject]),
      getProject: vi.fn().mockResolvedValue(mockProject),
      updateProject: vi.fn().mockResolvedValue({ ...mockProject, name: 'Core Platform Renamed' }),
      createTask: vi.fn().mockResolvedValue(mockTask),
      listTasks: vi.fn().mockResolvedValue([mockTask]),
      getTask: vi.fn().mockResolvedValue(mockTask),
      updateTask: vi.fn().mockResolvedValue({ ...mockTask, status: TaskStatus.IN_PROGRESS, version: 2 }),
      deleteTask: vi.fn().mockResolvedValue({ success: true }),
    };

    controller = new ProjectsController(mockProjectsService as ProjectsService);
  });

  describe('Project Endpoints', () => {
    it('creates a project with uppercase key and dates', async () => {
      const res = await controller.createProject(
        mockMembership.orgId,
        mockUser,
        mockMembership,
        { key: 'CORE', name: 'Core Platform' },
      );
      expect(res.key).toBe('CORE');
      expect(mockProjectsService.createProject).toHaveBeenCalledWith(
        mockMembership.orgId,
        mockUser.userId,
        OrgRole.ADMIN,
        { key: 'CORE', name: 'Core Platform' },
      );
    });

    it('lists projects for active tenant', async () => {
      const res = await controller.listProjects(mockMembership.orgId, mockUser, mockMembership);
      expect(res.length).toBe(1);
      expect(res[0].id).toBe(mockProject.id);
    });

    it('retrieves single project', async () => {
      const res = await controller.getProject(
        mockMembership.orgId,
        mockUser,
        mockMembership,
        mockProject.id,
      );
      expect(res.id).toBe(mockProject.id);
    });

    it('updates project', async () => {
      const res = await controller.updateProject(
        mockMembership.orgId,
        mockUser,
        mockMembership,
        mockProject.id,
        { name: 'Core Platform Renamed' },
      );
      expect(res.name).toBe('Core Platform Renamed');
    });
  });

  describe('Task Endpoints', () => {
    it('creates a task within project', async () => {
      const res = await controller.createTask(
        mockMembership.orgId,
        mockUser,
        mockMembership,
        mockProject.id,
        { title: 'Initialize database schema' },
      );
      expect(res.number).toBe(1);
      expect(mockProjectsService.createTask).toHaveBeenCalledWith(
        mockMembership.orgId,
        mockUser.userId,
        OrgRole.ADMIN,
        mockProject.id,
        { title: 'Initialize database schema' },
      );
    });

    it('lists tasks in project with status filter', async () => {
      const res = await controller.listTasks(
        mockMembership.orgId,
        mockUser,
        mockMembership,
        mockProject.id,
        TaskStatus.TODO,
      );
      expect(res.length).toBe(1);
      expect(mockProjectsService.listTasks).toHaveBeenCalledWith(
        mockMembership.orgId,
        mockUser.userId,
        OrgRole.ADMIN,
        mockProject.id,
        { status: TaskStatus.TODO, assigneeId: undefined },
      );
    });

    it('updates task passing expectedVersion for optimistic locking', async () => {
      const res = await controller.updateTask(
        mockMembership.orgId,
        mockUser,
        mockMembership,
        mockProject.id,
        mockTask.id,
        { status: TaskStatus.IN_PROGRESS, expectedVersion: 1 },
      );
      expect(res.status).toBe(TaskStatus.IN_PROGRESS);
      expect(res.version).toBe(2);
      expect(mockProjectsService.updateTask).toHaveBeenCalledWith(
        mockMembership.orgId,
        mockUser.userId,
        OrgRole.ADMIN,
        mockProject.id,
        mockTask.id,
        { status: TaskStatus.IN_PROGRESS, expectedVersion: 1 },
      );
    });

    it('deletes task', async () => {
      const res = await controller.deleteTask(
        mockMembership.orgId,
        mockUser,
        mockMembership,
        mockProject.id,
        mockTask.id,
      );
      expect(res.success).toBe(true);
    });
  });
});

