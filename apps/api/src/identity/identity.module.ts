import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { GitHubOAuthService } from './github-oauth.service';
import { SessionService } from './session.service';
import { AuthGuard } from './guards/auth.guard';

@Module({
  controllers: [AuthController],
  providers: [GitHubOAuthService, SessionService, AuthGuard],
  exports: [SessionService, GitHubOAuthService, AuthGuard],
})
export class IdentityModule {}

