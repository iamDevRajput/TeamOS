import { Controller, Get, Post, Param, UseGuards } from '@nestjs/common';
import {
  InvitationDetailsDto,
  AcceptInvitationResponseDto,
} from '@teamos/contracts';
import { SessionUser } from '@teamos/database';
import { AuthGuard } from '../identity/guards/auth.guard';
import { CurrentUser } from '../identity/decorators/current-user.decorator';
import { TenancyService } from './tenancy.service';

@Controller('invitations')
export class InvitationsController {
  constructor(private readonly tenancyService: TenancyService) {}

  @Get(':token')
  inspectInvitation(@Param('token') token: string): Promise<InvitationDetailsDto> {
    return this.tenancyService.inspectInvitation(token);
  }

  @Post(':token/accept')
  @UseGuards(AuthGuard)
  acceptInvitation(
    @Param('token') token: string,
    @CurrentUser() user: SessionUser,
  ): Promise<AcceptInvitationResponseDto> {
    return this.tenancyService.acceptInvitation(token, user.userId);
  }
}
