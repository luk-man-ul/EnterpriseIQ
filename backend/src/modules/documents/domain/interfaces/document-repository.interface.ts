import { Document, DocumentStatus } from '@prisma/client';

export const DOCUMENT_REPOSITORY_TOKEN = 'IDocumentRepository';

export interface IDocumentRepository {
  findById(id: string): Promise<Document | null>;
  findByHash(contentHash: string): Promise<Document | null>;
  createWithPermission(
    documentData: Omit<
      Document,
      'id' | 'createdAt' | 'updatedAt' | 'uploadDate'
    >,
    permissionData: { departmentId?: string; roleId?: string },
  ): Promise<Document>;
  findMany(params: {
    skip: number;
    take: number;
    orderBy: { [key: string]: 'asc' | 'desc' };
    where?: { departmentId?: string };
  }): Promise<{ documents: Document[]; totalCount: number }>;
  delete(id: string): Promise<void>;
  updateStatus(id: string, status: DocumentStatus): Promise<Document>;
}
