import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { DependenciesController } from './dependencies.controller';
import { DependenciesService } from './dependencies.service';
import { OrgRole } from '@teamos/contracts';
import { Membership } from '@teamos/database';

describe('DependenciesController & DependenciesService', () => {
  let controller: DependenciesController;
  let service: DependenciesService;

  const mockOrgId = '11111111-1111-1111-1111-111111111111';
  const mockMembership: Membership = {
    orgId: mockOrgId,
    userId: '22222222-2222-2222-2222-222222222222',
    role: OrgRole.MEMBER,
    createdAt: new Date(),
  };

  beforeEach(() => {
    service = new DependenciesService();
    controller = new DependenciesController(service);
  });

  it('rejects self-dependency with BadRequestException', async () => {
    await expect(
      controller.add(
        mockOrgId,
        mockMembership,
        'proj-1',
        { blockerTaskId: 'task-A', blockedTaskId: 'task-A' },
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects missing blockerTaskId or blockedTaskId with BadRequestException', async () => {
    await expect(
      controller.add(
        mockOrgId,
        mockMembership,
        'proj-1',
        { blockerTaskId: '', blockedTaskId: 'task-B' } as any,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('maps ERR_TASK_NOT_FOUND to NotFoundException', async () => {
    vi.spyOn(service, 'add').mockRejectedValueOnce(
      new NotFoundException('One or both tasks were not found in this project.'),
    );

    await expect(
      controller.add(
        mockOrgId,
        mockMembership,
        'proj-1',
        { blockerTaskId: 'task-A', blockedTaskId: 'task-B' },
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('maps ERR_DEPENDENCY_CYCLE to BadRequestException', async () => {
    vi.spyOn(service, 'add').mockRejectedValueOnce(
      new BadRequestException(
        'Cannot add dependency: this edge would introduce a cycle in the task graph.',
      ),
    );

    await expect(
      controller.add(
        mockOrgId,
        mockMembership,
        'proj-1',
        { blockerTaskId: 'task-B', blockedTaskId: 'task-A' },
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('maps ERR_DEPENDENCY_EXISTS to ConflictException', async () => {
    vi.spyOn(service, 'add').mockRejectedValueOnce(
      new ConflictException('Dependency already exists.'),
    );

    await expect(
      controller.add(
        mockOrgId,
        mockMembership,
        'proj-1',
        { blockerTaskId: 'task-A', blockedTaskId: 'task-B' },
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('successfully returns created dependency', async () => {
    const mockCreated = {
      orgId: mockOrgId,
      projectId: 'proj-1',
      blockerTaskId: 'task-A',
      blockedTaskId: 'task-B',
      createdBy: mockMembership.userId,
      createdAt: new Date().toISOString(),
    };

    vi.spyOn(service, 'add').mockResolvedValueOnce(mockCreated);

    const result = await controller.add(
      mockOrgId,
      mockMembership,
      'proj-1',
      { blockerTaskId: 'task-A', blockedTaskId: 'task-B' },
    );

    expect(result).toEqual(mockCreated);
  });

  it('removes dependency successfully', async () => {
    vi.spyOn(service, 'remove').mockResolvedValueOnce({ success: true });

    const result = await controller.remove(
      mockOrgId,
      mockMembership,
      'proj-1',
      { blockerTaskId: 'task-A', blockedTaskId: 'task-B' },
    );

    expect(result).toEqual({ success: true });
  });

  it('lists dependencies for a project', async () => {
    const mockList = [
      {
        orgId: mockOrgId,
        projectId: 'proj-1',
        blockerTaskId: 'task-A',
        blockedTaskId: 'task-B',
        createdBy: mockMembership.userId,
        createdAt: new Date().toISOString(),
      },
    ];

    vi.spyOn(service, 'list').mockResolvedValueOnce(mockList);

    const result = await controller.list(mockOrgId, mockMembership, 'proj-1');
    expect(result).toEqual(mockList);
    expect(result.length).toBe(1);
  });
});
