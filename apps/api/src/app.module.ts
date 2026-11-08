import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { HealthModule } from './health/health.module';
import { IdentityModule } from './identity/identity.module';
import { TenancyModule } from './tenancy/tenancy.module';
import { AuditModule } from './audit/audit.module';
import { ProjectsModule } from './projects/projects.module';
import { DependenciesModule } from './dependencies/dependencies.module';
import { RiskModule } from './risk/risk.module';
import { ProposalsModule } from './proposals/proposals.module';
import { AiModule } from './ai/ai.module';
import { GithubModule } from './github/github.module';
import { ReportsModule } from './reports/reports.module';
import { CsrfValidationMiddleware } from './common/csrf.middleware';

@Module({
  imports: [
    HealthModule,
    IdentityModule,
    TenancyModule,
    AuditModule,
    ProjectsModule,
    DependenciesModule,
    RiskModule,
    ProposalsModule,
    AiModule,
    GithubModule,
    ReportsModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CsrfValidationMiddleware).forRoutes('*');
  }
}


