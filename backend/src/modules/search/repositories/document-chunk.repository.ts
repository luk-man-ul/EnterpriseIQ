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

  async searchChunks(input: SearchChunksInput): Promise<SearchResultItem[]> {
    const {
      queryEmbedding,
      limit,
      userRoleId,
      userDepartmentId,
      roleName,
      threshold = -1.0,
    } = input;

    if (queryEmbedding.length !== EMBEDDING_DIMENSION) {
      throw new Error(
        `Query embedding must contain exactly ${EMBEDDING_DIMENSION} dimensions (got ${queryEmbedding.length}).`,
      );
    }

    const isAdmin = roleName === UserRole.Administrator;
    const vectorStr = `[${queryEmbedding.join(',')}]`;

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
