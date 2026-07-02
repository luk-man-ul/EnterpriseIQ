import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../../infrastructure/database/prisma.module';
import { DocumentsController } from './controllers/documents.controller';
import { DocumentsService } from './services/documents.service';
import { DocumentValidationService } from './services/document-validation.service';
import { DocumentRepository } from './repositories/document.repository';
import { LocalStorageProvider } from './infrastructure/storage/local-storage.provider';
import { DOCUMENT_REPOSITORY_TOKEN } from './domain/interfaces/document-repository.interface';
import { STORAGE_PROVIDER_TOKEN } from './domain/interfaces/storage-provider.interface';

@Module({
  imports: [PrismaModule, ConfigModule],
  controllers: [DocumentsController],
  providers: [
    DocumentValidationService,
    {
      provide: DOCUMENT_REPOSITORY_TOKEN,
      useClass: DocumentRepository,
    },
    {
      provide: STORAGE_PROVIDER_TOKEN,
      useClass: LocalStorageProvider,
    },
    DocumentsService,
  ],
  exports: [
    DocumentsService,
    DOCUMENT_REPOSITORY_TOKEN,
    STORAGE_PROVIDER_TOKEN,
  ],
})
export class DocumentsModule {}
export { DOCUMENT_REPOSITORY_TOKEN, STORAGE_PROVIDER_TOKEN };
