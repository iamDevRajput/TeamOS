import {
  Controller,
  Post,
  Get,
  Headers,
  Req,
  Body,
  Param,
  UnauthorizedException,
  BadRequestException,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  GithubInstallationDto,
  GithubRepositoryDto,
  LinkGithubRepoToProjectDto,
  TenantContext,
  OrgRole,
} from '@teamos/contracts';
import {
  saveGithubInstallation,
  listGithubInstallations,
  listGithubRepositories,
  linkGithubRepositoryToProject,
  Membership,
  SessionUser,
} from '@teamos/database';
import { AuthGuard } from '../identity/guards/auth.guard';
import { CurrentUser } from '../identity/decorators/current-user.decorator';
import { OrgMembershipGuard } from '../tenancy/guards/org-membership.guard';
import { RequireRole } from '../tenancy/decorators/require-role.decorator';
import { CurrentOrgId, CurrentMembership } from '../tenancy/decorators/current-org.decorator';
import { GithubWebhookService } from './github-webhook.service';
import { GithubAppAuthService } from './github-app-auth.service';

@Controller('integrations/github')
export class GithubController {
  constructor(private readonly webhookService: GithubWebhookService) {}

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Headers('x-hub-signature-256') signature: string,
    @Headers('x-github-delivery') deliveryId: string,
    @Headers('x-github-event') eventType: string,
    @Req() req: any,
    @Body() payload: any,
  ) {
    if (!signature) {
      throw new UnauthorizedException('Missing x-hub-signature-256 header.');
    }
    if (!deliveryId) {
      throw new BadRequestException('Missing x-github-delivery header.');
    }

    const rawBody = req.rawBody || JSON.stringify(payload);
    const isValid = this.webhookService.verifySignature(rawBody, signature);

    if (!isValid) {
      throw new UnauthorizedException('Invalid GitHub webhook signature.');
    }

    const result = await this.webhookService.processWebhookEvent(
      deliveryId,
      eventType || 'unknown',
      payload,
    );

    return {
      deliveryId,
      eventType,
      ...result,
    };
  }
}

@Controller('orgs/:orgId/github')
@UseGuards(AuthGuard, OrgMembershipGuard)
export class GithubOrgController {
  constructor(private readonly appAuthService: GithubAppAuthService) {}

  @Get('installations')
  @RequireRole('MEMBER')
  async listInstallations(
    @CurrentOrgId() orgId: string,
    @CurrentUser() user: SessionUser,
    @CurrentMembership() membership: Membership,
  ): Promise<GithubInstallationDto[]> {
    const context: TenantContext = {
      orgId,
      userId: user.userId,
      role: membership.role as OrgRole,
    };
    return listGithubInstallations(context);
  }

  @Post('installations')
  @RequireRole('ADMIN')
  async saveInstallation(
    @CurrentOrgId() orgId: string,
    @CurrentUser() user: SessionUser,
    @CurrentMembership() membership: Membership,
    @Body()
    body: {
      installationId: number;
      accountLogin: string;
      accountId: number;
      accountType?: string;
      repositorySelection?: string;
      repositories?: {
        repoId: number;
        repoName: string;
        repoFullName: string;
        isPrivate?: boolean;
      }[];
    },
  ): Promise<GithubInstallationDto> {
    const context: TenantContext = {
      orgId,
      userId: user.userId,
      role: membership.role as OrgRole,
    };
    return saveGithubInstallation(context, body);
  }

  @Get('repositories')
  @RequireRole('MEMBER')
  async listRepositories(
    @CurrentOrgId() orgId: string,
    @CurrentUser() user: SessionUser,
    @CurrentMembership() membership: Membership,
  ): Promise<GithubRepositoryDto[]> {
    const context: TenantContext = {
      orgId,
      userId: user.userId,
      role: membership.role as OrgRole,
    };
    return listGithubRepositories(context);
  }

  @Post('repositories/:repoId/link-project')
  @RequireRole('ADMIN')
  async linkRepository(
    @CurrentOrgId() orgId: string,
    @CurrentUser() user: SessionUser,
    @CurrentMembership() membership: Membership,
    @Param('repoId') repoId: string,
    @Body() body: LinkGithubRepoToProjectDto,
  ): Promise<GithubRepositoryDto> {
    const context: TenantContext = {
      orgId,
      userId: user.userId,
      role: membership.role as OrgRole,
    };
    return linkGithubRepositoryToProject(context, Number(repoId), body.projectId);
  }
}
