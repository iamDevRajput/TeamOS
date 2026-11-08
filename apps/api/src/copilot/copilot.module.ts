import { Module } from '@nestjs/common';
import { CopilotService } from './copilot.service';
import { CopilotController } from './copilot.controller';
import { IdentityModule } from '../identity/identity.module';
import { RiskModule } from '../risk/risk.module';
import { CollaborationModule } from '../collaboration/collaboration.module';

@Module({
  imports: [IdentityModule, RiskModule, CollaborationModule],
  controllers: [CopilotController],
  providers: [CopilotService],
  exports: [CopilotService],
})
export class CopilotModule {}
