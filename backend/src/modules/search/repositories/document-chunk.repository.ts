import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { EMBEDDING_DIMENSION } from '../../ai/constants/ai.constants';
import {
  IDocumentChunkRepository,
  DocumentChunkSaveInput,
  SearchChunksInput,
  SearchResultItem,
} from '../domain/interfaces/document-chunk-repository.interface';

@Injectable()
export class DocumentChunkRepository implements IDocumentChunkRepository {
  constructor(private readonly prisma: PrismaService) {}

  private serializeVector(embedding: number[], name = 'Embedding'): string {
    if (embedding.length !== EMBEDDING_DIMENSION) {
      throw new Error(
        `${name} must contain exactly ${EMBEDDING_DIMENSION} dimensions (got ${embedding.length}).`,
      );
    }
    for (let i = 0; i < embedding.length; i++) {
      const val = embedding[i];
      if (typeof val !== 'number' || !Number.isFinite(val)) {
        throw new Error(
          `${name} elements must be finite numbers (encountered invalid value: ${val} at index ${i}).`,
        );
      }
    }
    return `[${embedding.join(',')}]`;
  }

  async saveChunks(chunks: DocumentChunkSaveInput[]): Promise<void> {
    if (chunks.length === 0) return;

    await this.prisma.$transaction(async (tx) => {
      for (const chunk of chunks) {
        const id = crypto.randomUUID();
        const vectorStr = this.serializeVector(
          chunk.embedding,
          'Chunk embedding',
        );

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
            ${vectorStr}::vector,
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

  async searchChunks(input: SearchChunksInput): Promise<SearchResultItem[]> {
    const {
      queryEmbedding,
      limit,
      userRoleId,
      userDepartmentId,
      roleName,
      threshold = -1.0,
    } = input;

    const isAdmin = roleName === UserRole.Administrator;
    const vectorStr = this.serializeVector(queryEmbedding, 'Query embedding');

    return this.prisma.$queryRaw<SearchResultItem[]>`
      SELECT 
        dc."id",
        dc."documentId",
        d."filename" AS "documentName",
        (dc."metadata"->>'pageNumber')::int AS "pageNumber",
        dc."chunkIndex",
        dc."content",
        dc."metadata",
        (1.0 - (dc."embedding" <=> ${vectorStr}::vector))::float AS "similarity"
      FROM "document_chunks" dc
      JOIN "documents" d ON dc."documentId" = d."id"
      WHERE d."status" = 'Completed'
        AND (
          ${isAdmin} = true
          OR EXISTS (
            SELECT 1 FROM "document_permissions" dp
            WHERE dp."documentId" = d."id"
              AND (dp."departmentId" IS NULL OR dp."departmentId" = ${userDepartmentId}::uuid)
              AND (dp."roleId" IS NULL OR dp."roleId" = ${userRoleId}::uuid)
          )
        )
        AND (1.0 - (dc."embedding" <=> ${vectorStr}::vector)) >= ${threshold}::float
      ORDER BY dc."embedding" <=> ${vectorStr}::vector ASC
      LIMIT ${limit}
    `;
  }
}
