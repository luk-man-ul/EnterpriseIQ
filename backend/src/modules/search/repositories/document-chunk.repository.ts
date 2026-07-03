import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import {
  IDocumentChunkRepository,
  DocumentChunkSaveInput,
} from '../domain/interfaces/document-chunk-repository.interface';

@Injectable()
export class DocumentChunkRepository implements IDocumentChunkRepository {
  constructor(private readonly prisma: PrismaService) {}

  async saveChunks(chunks: DocumentChunkSaveInput[]): Promise<void> {
    if (chunks.length === 0) return;

    await this.prisma.$transaction(async (tx) => {
      for (const chunk of chunks) {
        const id = crypto.randomUUID();

        await tx.$executeRaw`
          INSERT INTO "document_chunks" (
            "id", 
            "documentId", 
            "content", 
            "embedding", 
            "chunkIndex", 
            "tokenCount", 
            "characterCount", 
            "metadata", 
            "createdAt"
          ) VALUES (
            ${id}::uuid,
            ${chunk.documentId}::uuid,
            ${chunk.content},
            ${chunk.embedding}::vector,
            ${chunk.chunkIndex},
            ${chunk.tokenCount},
            ${chunk.characterCount},
            ${chunk.metadata}::jsonb,
            NOW()
          )
        `;
      }
    });
  }

  async deleteByDocumentId(documentId: string): Promise<void> {
    await this.prisma.$executeRaw`
      DELETE FROM "document_chunks"
      WHERE "documentId" = ${documentId}::uuid
    `;
  }
}
