import { Module, Global } from '@nestjs/common';
import { SearchService } from './search.service';
import { SearchController } from './search.controller';
import { EmbeddingService } from './embedding.service';
import { IdentityModule } from '../identity/identity.module';

@Global()
@Module({
  imports: [IdentityModule],
  controllers: [SearchController],
  providers: [SearchService, EmbeddingService],
  exports: [SearchService, EmbeddingService],
})
export class SearchModule {}
