import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/database/prisma.module';
import { AiModule } from '../ai/ai.module';
import { DOCUMENT_CHUNK_REPOSITORY_TOKEN } from './domain/interfaces/document-chunk-repository.interface';
import { DocumentChunkRepository } from './repositories/document-chunk.repository';
import { SearchService } from './services/search.service';
import { SearchController } from './controllers/search.controller';

@Module({
  imports: [PrismaModule, AiModule],
  controllers: [SearchController],
  providers: [
    {
      provide: DOCUMENT_CHUNK_REPOSITORY_TOKEN,
      useClass: DocumentChunkRepository,
    },
    SearchService,
  ],
  exports: [DOCUMENT_CHUNK_REPOSITORY_TOKEN, SearchService],
})
export class SearchModule {}
export { DOCUMENT_CHUNK_REPOSITORY_TOKEN };
