import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { HealthModule } from './health/health.module';
import { IdentityModule } from './identity/identity.module';
import { CsrfValidationMiddleware } from './common/csrf.middleware';

@Module({
  imports: [HealthModule, IdentityModule],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CsrfValidationMiddleware).forRoutes('*');
  }
}


