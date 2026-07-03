import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../../infrastructure/database/prisma.module';
import { SearchModule } from '../search/search.module';
import { AiModule } from '../ai/ai.module';
import { DocumentsController } from './controllers/documents.controller';
import { DocumentsService } from './services/documents.service';
import { DocumentValidationService } from './services/document-validation.service';
import { DocumentRepository } from './repositories/document.repository';
import { LocalStorageProvider } from './infrastructure/storage/local-storage.provider';
import { DOCUMENT_REPOSITORY_TOKEN } from './domain/interfaces/document-repository.interface';
import { STORAGE_PROVIDER_TOKEN } from './domain/interfaces/storage-provider.interface';
import { PdfParserService } from './services/parsers/pdf-parser.service';
import { DocxParserService } from './services/parsers/docx-parser.service';
import { TxtParserService } from './services/parsers/txt-parser.service';
import { ChunkingService } from './services/chunking.service';
import { IngestionOrchestrator } from './services/ingestion.orchestrator';
import { DocumentUploadedListener } from './listeners/document-uploaded.listener';

@Module({
  imports: [PrismaModule, ConfigModule, SearchModule, AiModule],
  controllers: [DocumentsController],
  providers: [
    DocumentValidationService,
    PdfParserService,
    DocxParserService,
    TxtParserService,
    ChunkingService,
    IngestionOrchestrator,
    DocumentUploadedListener,
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
    IngestionOrchestrator,
  ],
})
export class DocumentsModule {}
export { DOCUMENT_REPOSITORY_TOKEN, STORAGE_PROVIDER_TOKEN };
