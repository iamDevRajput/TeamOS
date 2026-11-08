import { Module, Global } from '@nestjs/common';
import { CollaborationService } from './collaboration.service';
import { CollaborationGateway, PresenceController } from './collaboration.gateway';
import { IdentityModule } from '../identity/identity.module';

@Global()
@Module({
  imports: [IdentityModule],
  controllers: [PresenceController],
  providers: [CollaborationService, CollaborationGateway],
  exports: [CollaborationService],
})
export class CollaborationModule {}
