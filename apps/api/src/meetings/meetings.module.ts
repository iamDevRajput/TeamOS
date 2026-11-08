import { Module } from '@nestjs/common';
import { MeetingsService } from './meetings.service';
import { MeetingsController } from './meetings.controller';
import { IdentityModule } from '../identity/identity.module';
import { SearchModule } from '../search/search.module';
import { CollaborationModule } from '../collaboration/collaboration.module';

@Module({
  imports: [IdentityModule, SearchModule, CollaborationModule],
  controllers: [MeetingsController],
  providers: [MeetingsService],
  exports: [MeetingsService],
})
export class MeetingsModule {}
