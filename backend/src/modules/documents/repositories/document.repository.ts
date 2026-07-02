import { Injectable } from '@nestjs/common';
import { Document, Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { IDocumentRepository } from '../domain/interfaces/document-repository.interface';

@Injectable()
export class DocumentRepository implements IDocumentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Document | null> {
    return this.prisma.document.findUnique({
      where: { id },
      include: {
        permissions: true,
      },
    });
  }

  async findByHash(contentHash: string): Promise<Document | null> {
    return this.prisma.document.findUnique({
      where: { contentHash },
    });
  }

  async createWithPermission(
    documentData: Omit<
      Document,
      'id' | 'createdAt' | 'updatedAt' | 'uploadDate'
    >,
    permissionData: { departmentId?: string; roleId?: string },
  ): Promise<Document> {
    return this.prisma.$transaction(async (tx) => {
      const document = await tx.document.create({
        data: documentData,
      });

      await tx.documentPermission.create({
        data: {
          documentId: document.id,
          departmentId: permissionData.departmentId || null,
          roleId: permissionData.roleId || null,
        },
      });

      return document;
    });
  }

  async findMany(params: {
    skip: number;
    take: number;
    orderBy: { [key: string]: 'asc' | 'desc' };
    where?: { departmentId?: string };
  }): Promise<{ documents: Document[]; totalCount: number }> {
    const { skip, take, orderBy, where } = params;

    const whereClause: Prisma.DocumentWhereInput = {};
    if (where?.departmentId) {
      whereClause.permissions = {
        some: {
          departmentId: where.departmentId,
        },
      };
    }

    const [documents, totalCount] = await Promise.all([
      this.prisma.document.findMany({
        skip,
        take,
        orderBy,
        where: whereClause,
        include: {
          permissions: true,
        },
      }),
      this.prisma.document.count({
        where: whereClause,
      }),
    ]);

    return { documents, totalCount };
  }

  async delete(id: string): Promise<void> {
    await this.prisma.document.delete({
      where: { id },
    });
  }
}
