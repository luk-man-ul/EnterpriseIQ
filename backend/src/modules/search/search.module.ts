import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/database/prisma.module';
import { DOCUMENT_CHUNK_REPOSITORY_TOKEN } from './domain/interfaces/document-chunk-repository.interface';
import { DocumentChunkRepository } from './repositories/document-chunk.repository';

@Module({
  imports: [PrismaModule],
  providers: [
    {
      provide: DOCUMENT_CHUNK_REPOSITORY_TOKEN,
      useClass: DocumentChunkRepository,
    },
  ],
  exports: [DOCUMENT_CHUNK_REPOSITORY_TOKEN],
})
export class SearchModule {}
export { DOCUMENT_CHUNK_REPOSITORY_TOKEN };
