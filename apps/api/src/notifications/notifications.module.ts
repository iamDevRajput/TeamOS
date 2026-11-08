import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { IdentityModule } from '../identity/identity.module';
import { CollaborationModule } from '../collaboration/collaboration.module';

@Module({
  imports: [IdentityModule, CollaborationModule],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
