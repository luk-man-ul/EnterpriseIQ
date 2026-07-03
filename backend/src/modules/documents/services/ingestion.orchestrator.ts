import { Injectable, Inject, Logger } from '@nestjs/common';
import { DocumentStatus, Document, DocumentPermission } from '@prisma/client';
import * as path from 'path';
import type { IDocumentRepository } from '../domain/interfaces/document-repository.interface';
import { DOCUMENT_REPOSITORY_TOKEN } from '../domain/interfaces/document-repository.interface';
import type { IDocumentChunkRepository } from '../../search/domain/interfaces/document-chunk-repository.interface';
import { DOCUMENT_CHUNK_REPOSITORY_TOKEN } from '../../search/domain/interfaces/document-chunk-repository.interface';
import type { IStorageProvider } from '../domain/interfaces/storage-provider.interface';
import { STORAGE_PROVIDER_TOKEN } from '../domain/interfaces/storage-provider.interface';
import type { IEmbeddingProvider } from '../../ai/domain/interfaces/embedding-provider.interface';
import { EMBEDDING_PROVIDER_TOKEN } from '../../ai/constants/ai.constants';
import { PdfParserService } from './parsers/pdf-parser.service';
import { DocxParserService } from './parsers/docx-parser.service';
import { TxtParserService } from './parsers/txt-parser.service';
import { ChunkingService } from './chunking.service';

interface DocumentWithPermissions extends Document {
  permissions?: DocumentPermission[];
}

interface ChunkPayload {
  documentId: string;
  content: string;
  chunkIndex: number;
  tokenCount: number;
  characterCount: number;
  metadata: {
    documentId: string;
    filename: string;
    pageNumber: number;
    startOffset: number;
    endOffset: number;
    departmentId: string | null;
    roleId: string | null;
    tags: string[];
  };
}

interface ChunkWithVector extends ChunkPayload {
  embedding: number[];
}

@Injectable()
export class IngestionOrchestrator {
  private readonly logger = new Logger(IngestionOrchestrator.name);

  constructor(
    @Inject(DOCUMENT_REPOSITORY_TOKEN)
    private readonly documentRepository: IDocumentRepository,
    @Inject(DOCUMENT_CHUNK_REPOSITORY_TOKEN)
    private readonly chunkRepository: IDocumentChunkRepository,
    @Inject(STORAGE_PROVIDER_TOKEN)
    private readonly storageProvider: IStorageProvider,
    @Inject(EMBEDDING_PROVIDER_TOKEN)
    private readonly embeddingProvider: IEmbeddingProvider,
    private readonly chunkingService: ChunkingService,
    private readonly pdfParser: PdfParserService,
    private readonly docxParser: DocxParserService,
    private readonly txtParser: TxtParserService,
  ) {}

  async ingest(documentId: string): Promise<void> {
    this.logger.log(`Beginning document ingestion process for: ${documentId}`);

    const document = await this.documentRepository.findById(documentId);
    if (!document) {
      this.logger.error(`Document metadata not found in DB: ${documentId}`);
      return;
    }

    try {
      await this.documentRepository.updateStatus(
        documentId,
        DocumentStatus.Processing,
      );

      await this.chunkRepository.deleteByDocumentId(documentId);

      const buffer = await this.storageProvider.getFileBuffer(
        document.filePath,
      );

      const ext = path.extname(document.filename).toLowerCase();
      let parser;
      if (ext === '.pdf') {
        parser = this.pdfParser;
      } else if (ext === '.docx') {
        parser = this.docxParser;
      } else if (ext === '.txt') {
        parser = this.txtParser;
      } else {
        throw new Error(`Unsupported document extension format: ${ext}`);
      }

      this.logger.log(
        `Extracting text from document using parser: ${parser.constructor.name}`,
      );
      const pages = await parser.parse(buffer);

      if (pages.length === 0) {
        throw new Error('Extracted document text content is completely empty.');
      }

      const chunkPayloads: ChunkPayload[] = [];
      let totalIndex = 0;

      const docWithPerms = document as DocumentWithPermissions;
      const departmentId = docWithPerms.permissions?.[0]?.departmentId || null;
      const roleId = docWithPerms.permissions?.[0]?.roleId || null;

      for (const page of pages) {
        const textChunks = this.chunkingService.splitText(page.content);

        for (const textChunk of textChunks) {
          chunkPayloads.push({
            documentId: document.id,
            content: textChunk.content,
            chunkIndex: totalIndex++,
            tokenCount: textChunk.tokenCount,
            characterCount: textChunk.characterCount,
            metadata: {
              documentId: document.id,
              filename: document.filename,
              pageNumber: page.pageNumber,
              startOffset: textChunk.startOffset,
              endOffset: textChunk.endOffset,
              departmentId,
              roleId,
              tags: document.tags,
            },
          });
        }
      }

      if (chunkPayloads.length === 0) {
        throw new Error('No chunks generated during text boundary parsing.');
      }

      this.logger.log(
        `Calculating vector embeddings for ${chunkPayloads.length} chunks...`,
      );
      const batchSize = 50;
      const chunksWithVectors: ChunkWithVector[] = [];

      for (let i = 0; i < chunkPayloads.length; i += batchSize) {
        const batch = chunkPayloads.slice(i, i + batchSize);
        const texts = batch.map((c) => c.content);

        const vectors = await this.embeddingProvider.generateEmbeddings(texts);

        if (vectors.length !== batch.length) {
          throw new Error('Embedding calculations batch length mismatch.');
        }

        for (let j = 0; j < batch.length; j++) {
          chunksWithVectors.push({
            ...batch[j],
            embedding: vectors[j],
          });
        }
      }

      this.logger.log(`Writing vectors into database storage chunks table...`);
      await this.chunkRepository.saveChunks(chunksWithVectors);

      await this.documentRepository.updateStatus(
        documentId,
        DocumentStatus.Completed,
      );
      this.logger.log(
        `Ingestion pipeline completed successfully for document: ${documentId}`,
      );
    } catch (err: unknown) {
      this.logger.error(
        `Document ingestion failed for document: ${documentId}`,
        err,
      );
      try {
        await this.documentRepository.updateStatus(
          documentId,
          DocumentStatus.Failed,
        );
      } catch (statusErr) {
        this.logger.error(
          `Failed to mark document status as Failed: ${documentId}`,
          statusErr,
        );
      }
      throw err;
    }
  }
}
