import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import {
  TenantContext,
  DependencyDto,
  CreateDependencyDto,
} from '@teamos/contracts';
import {
  addDependency,
  removeDependency,
  listProjectDependencies,
} from '@teamos/database';

@Injectable()
export class DependenciesService {
  async add(
    context: TenantContext,
    projectId: string,
    dto: CreateDependencyDto,
  ): Promise<DependencyDto> {
    if (!dto.blockerTaskId || !dto.blockedTaskId) {
      throw new BadRequestException('blockerTaskId and blockedTaskId are required.');
    }

    try {
      return await addDependency(context, {
        projectId,
        blockerTaskId: dto.blockerTaskId,
        blockedTaskId: dto.blockedTaskId,
      });
    } catch (err: any) {
      if (err.message === 'ERR_SELF_DEPENDENCY') {
        throw new BadRequestException('A task cannot depend on itself.');
      }
      if (err.message === 'ERR_TASK_NOT_FOUND') {
        throw new NotFoundException('One or both tasks were not found in this project.');
      }
      if (err.message === 'ERR_DEPENDENCY_EXISTS') {
        throw new ConflictException('Dependency already exists.');
      }
      if (err.message === 'ERR_DEPENDENCY_CYCLE') {
        throw new BadRequestException(
          'Cannot add dependency: this edge would introduce a cycle in the task graph.',
        );
      }
      throw err;
    }
  }

  async remove(
    context: TenantContext,
    projectId: string,
    dto: CreateDependencyDto,
  ): Promise<{ success: boolean }> {
    if (!dto.blockerTaskId || !dto.blockedTaskId) {
      throw new BadRequestException('blockerTaskId and blockedTaskId are required.');
    }

    try {
      await removeDependency(context, {
        projectId,
        blockerTaskId: dto.blockerTaskId,
        blockedTaskId: dto.blockedTaskId,
      });
      return { success: true };
    } catch (err: any) {
      if (err.message === 'ERR_DEPENDENCY_NOT_FOUND') {
        throw new NotFoundException('Dependency does not exist.');
      }
      throw err;
    }
  }

  async list(
    context: TenantContext,
    projectId: string,
  ): Promise<DependencyDto[]> {
    return listProjectDependencies(context, projectId);
  }
}

