import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../identity/guards/auth.guard';
import { OrgMembershipGuard } from '../tenancy/guards/org-membership.guard';
import { CurrentUser } from '../identity/decorators/current-user.decorator';
import { CurrentOrgId, CurrentMembership } from '../tenancy/decorators/current-org.decorator';
import { TenantContext, NotificationDto, OrgRole } from '@teamos/contracts';
import { SessionUser, Membership } from '@teamos/database';
import { NotificationsService } from './notifications.service';

@Controller('orgs/:orgId/notifications')
@UseGuards(AuthGuard, OrgMembershipGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async list(
    @CurrentOrgId() orgId: string,
    @CurrentUser() user: SessionUser,
    @CurrentMembership() membership: Membership,
    @Query('limit') limitStr?: string
  ): Promise<NotificationDto[]> {
    const context: TenantContext = { orgId, userId: user.userId, role: membership.role as OrgRole };
    const limit = limitStr ? parseInt(limitStr, 10) : 30;
    return this.notificationsService.list(context, limit);
  }

  @Get('unread-count')
  async getUnreadCount(
    @CurrentOrgId() orgId: string,
    @CurrentUser() user: SessionUser,
    @CurrentMembership() membership: Membership
  ): Promise<{ count: number }> {
    const context: TenantContext = { orgId, userId: user.userId, role: membership.role as OrgRole };
    const count = await this.notificationsService.getUnreadCount(context);
    return { count };
  }

  @Post(':id/read')
  async markRead(
    @CurrentOrgId() orgId: string,
    @CurrentUser() user: SessionUser,
    @CurrentMembership() membership: Membership,
    @Param('id') notificationId: string
  ) {
    const context: TenantContext = { orgId, userId: user.userId, role: membership.role as OrgRole };
    return this.notificationsService.markAsRead(context, notificationId);
  }

  @Post('read-all')
  async markAllRead(
    @CurrentOrgId() orgId: string,
    @CurrentUser() user: SessionUser,
    @CurrentMembership() membership: Membership
  ) {
    const context: TenantContext = { orgId, userId: user.userId, role: membership.role as OrgRole };
    return this.notificationsService.markAllAsRead(context);
  }

  @Post('check-deadlines')
  async checkDeadlines(
    @CurrentOrgId() orgId: string,
    @CurrentUser() user: SessionUser,
    @CurrentMembership() membership: Membership,
    @Query('projectId') projectId: string
  ) {
    const context: TenantContext = { orgId, userId: user.userId, role: membership.role as OrgRole };
    return this.notificationsService.evaluateDeadlines(context, projectId);
  }
}
