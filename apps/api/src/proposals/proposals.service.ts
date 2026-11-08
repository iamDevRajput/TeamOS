import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import {
  TenantContext,
  ProposalDto,
  CreateProposalDto,
  ProposalState,
  ApproveProposalResponseDto,
  RejectProposalDto,
} from '@teamos/contracts';
import {
  createProposal,
  listProjectProposals,
  getProposalById,
  rejectProposal,
  approveProposal,
} from '@teamos/database';

@Injectable()
export class ProposalsService {
  async create(
    context: TenantContext,
    projectId: string,
    dto: CreateProposalDto,
  ): Promise<ProposalDto> {
    if (!dto.title?.trim()) {
      throw new BadRequestException('Proposal title is required.');
    }
    if (!dto.payload) {
      throw new BadRequestException('Proposal payload is required.');
    }

    try {
      return await createProposal(context, projectId, dto);
    } catch (err: any) {
      if (err.message === 'Project not found in this organization.') {
        throw new NotFoundException(err.message);
      }
      throw err;
    }
  }

  async list(
    context: TenantContext,
    projectId: string,
    state?: ProposalState,
  ): Promise<ProposalDto[]> {
    return listProjectProposals(context, projectId, state);
  }

  async getById(
    context: TenantContext,
    proposalId: string,
  ): Promise<ProposalDto> {
    const proposal = await getProposalById(context, proposalId);
    if (!proposal) {
      throw new NotFoundException('Proposal not found.');
    }
    return proposal;
  }

  async approve(
    context: TenantContext,
    proposalId: string,
  ): Promise<ApproveProposalResponseDto> {
    try {
      return await approveProposal(context, proposalId);
    } catch (err: any) {
      if (err.message === 'ERR_UNAUTHORIZED_PROPOSAL_REVIEW') {
        throw new ForbiddenException(
          'Only Organization Owners or Admins can approve proposals.',
        );
      }
      if (err.message === 'ERR_PROPOSAL_NOT_FOUND') {
        throw new NotFoundException('Proposal not found.');
      }
      if (err.message === 'ERR_PROPOSAL_NOT_PENDING') {
        throw new BadRequestException(
          'Only proposals in PENDING state can be approved.',
        );
      }
      if (err.message === 'ERR_CONCURRENT_UPDATE') {
        throw new ConflictException(
          'Concurrency Conflict: One or more tasks were modified after this proposal was created. Please refresh the proposal before approving.',
        );
      }
      if (err.message === 'ERR_DEPENDENCY_CYCLE') {
        throw new BadRequestException(
          'Cannot approve proposal: the proposed dependencies introduce a cycle into the project graph.',
        );
      }
      throw err;
    }
  }

  async reject(
    context: TenantContext,
    proposalId: string,
    dto: RejectProposalDto,
  ): Promise<ProposalDto> {
    try {
      return await rejectProposal(context, proposalId, dto.reason);
    } catch (err: any) {
      if (err.message === 'ERR_UNAUTHORIZED_PROPOSAL_REVIEW') {
        throw new ForbiddenException(
          'Only Organization Owners or Admins can reject proposals.',
        );
      }
      if (err.message === 'ERR_PROPOSAL_NOT_FOUND') {
        throw new NotFoundException('Proposal not found.');
      }
      if (err.message === 'ERR_PROPOSAL_NOT_PENDING') {
        throw new BadRequestException(
          'Only proposals in PENDING state can be rejected.',
        );
      }
      throw err;
    }
  }
}

