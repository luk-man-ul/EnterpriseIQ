import { Injectable } from '@nestjs/common';
import { Document, DocumentStatus, Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { IDocumentRepository } from '../domain/interfaces/document-repository.interface';
import { DocumentAccessContext } from '../domain/interfaces/document-access-context.interface';

@Injectable()
export class DocumentRepository implements IDocumentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByIdUnscoped(id: string): Promise<Document | null> {
    return this.prisma.document.findUnique({
      where: { id },
      include: {
        permissions: true,
      },
    });
  }

  async findAuthorizedById(
    id: string,
    accessContext: DocumentAccessContext,
  ): Promise<Document | null> {
    const permissionWhere = this.buildPermissionWhere(accessContext);
    return this.prisma.document.findFirst({
      where: {
        id,
        ...permissionWhere,
      },
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

  async findAuthorizedMany(
    params: {
      skip: number;
      take: number;
      orderBy: { [key: string]: 'asc' | 'desc' };
      departmentId?: string;
    },
    accessContext: DocumentAccessContext,
  ): Promise<{ documents: Document[]; totalCount: number }> {
    const { skip, take, orderBy, departmentId } = params;
    const permissionWhere = this.buildPermissionWhere(accessContext);

    const isAdmin = accessContext.roleName === UserRole.Administrator;
    let whereClause: Prisma.DocumentWhereInput;

    if (isAdmin) {
      whereClause = departmentId
        ? {
            permissions: {
              some: {
                departmentId,
              },
            },
          }
        : {};
    } else {
      whereClause = permissionWhere;
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

  async updateStatus(id: string, status: DocumentStatus): Promise<Document> {
    return this.prisma.document.update({
      where: { id },
      data: { status },
    });
  }

  private buildPermissionWhere(
    accessContext: DocumentAccessContext,
  ): Prisma.DocumentWhereInput {
    const isAdmin = accessContext.roleName === UserRole.Administrator;
    if (isAdmin) return {};

    return {
      permissions: {
        some: {
          AND: [
            {
              OR: [
                { departmentId: null },
                { departmentId: accessContext.departmentId },
              ],
            },
            {
              OR: [{ roleId: null }, { roleId: accessContext.roleId }],
            },
          ],
        },
      },
    };
  }
}
