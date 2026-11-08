import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { TenancyModule } from '../tenancy/tenancy.module';
import { GithubController, GithubOrgController } from './github.controller';
import { GithubWebhookService } from './github-webhook.service';
import { GithubAppAuthService } from './github-app-auth.service';

@Module({
  imports: [IdentityModule, TenancyModule],
  controllers: [GithubController, GithubOrgController],
  providers: [GithubWebhookService, GithubAppAuthService],
  exports: [GithubWebhookService, GithubAppAuthService],
})
export class GithubModule {}
