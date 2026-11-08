import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { TenancyModule } from '../tenancy/tenancy.module';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { GeminiLlmProvider } from './providers/gemini-llm.provider';

@Module({
  imports: [IdentityModule, TenancyModule],
  controllers: [AiController],
  providers: [GeminiLlmProvider, AiService],
  exports: [AiService],
})
export class AiModule {}

