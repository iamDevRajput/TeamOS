import { Module } from '@nestjs/common';
import { DemoService } from './demo.service';
import { DemoController } from './demo.controller';
import { IdentityModule } from '../identity/identity.module';
import { RiskModule } from '../risk/risk.module';
import { MeetingsModule } from '../meetings/meetings.module';
import { SearchModule } from '../search/search.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { CollaborationModule } from '../collaboration/collaboration.module';

@Module({
  imports: [
    IdentityModule,
    RiskModule,
    MeetingsModule,
    SearchModule,
    NotificationsModule,
    CollaborationModule,
  ],
  controllers: [DemoController],
  providers: [DemoService],
  exports: [DemoService],
})
export class DemoModule {}
