import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { AuthGuard } from '../identity/guards/auth.guard';
import { OrgMembershipGuard } from '../tenancy/guards/org-membership.guard';
import { CurrentUser } from '../identity/decorators/current-user.decorator';
import { CurrentOrgId, CurrentMembership } from '../tenancy/decorators/current-org.decorator';
import {
  TenantContext,
  CopilotMessageDto,
  OrgRole,
} from '@teamos/contracts';
import { SessionUser, Membership } from '@teamos/database';
import { CopilotService } from './copilot.service';

@Controller('orgs/:orgId/projects/:projectId/copilot')
@UseGuards(AuthGuard, OrgMembershipGuard)
export class CopilotController {
  constructor(private readonly copilotService: CopilotService) {}

  @Get('messages')
  async listMessages(
    @CurrentOrgId() orgId: string,
    @CurrentUser() user: SessionUser,
    @CurrentMembership() membership: Membership,
    @Param('projectId') projectId: string
  ): Promise<CopilotMessageDto[]> {
    const context: TenantContext = {
      orgId,
      userId: user.userId,
      role: membership.role as OrgRole,
    };
    return this.copilotService.listMessages(context, projectId);
  }

  @Post('chat')
  async chat(
    @CurrentOrgId() orgId: string,
    @CurrentUser() user: SessionUser,
    @CurrentMembership() membership: Membership,
    @Param('projectId') projectId: string,
    @Body() body: { message: string }
  ): Promise<CopilotMessageDto> {
    if (!body.message || body.message.trim().length === 0) {
      throw new BadRequestException('Message is required.');
    }
    const context: TenantContext = {
      orgId,
      userId: user.userId,
      role: membership.role as OrgRole,
    };
    return this.copilotService.chat(context, projectId, body.message);
  }
}
