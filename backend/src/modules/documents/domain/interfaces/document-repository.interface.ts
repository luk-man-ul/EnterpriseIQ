import { Document, DocumentStatus } from '@prisma/client';
import { DocumentAccessContext } from './document-access-context.interface';

export const DOCUMENT_REPOSITORY_TOKEN = 'IDocumentRepository';

export interface IDocumentRepository {
  findByIdUnscoped(id: string): Promise<Document | null>;
  findAuthorizedById(
    id: string,
    accessContext: DocumentAccessContext,
  ): Promise<Document | null>;
  findByHash(contentHash: string): Promise<Document | null>;
  createWithPermission(
    documentData: Omit<
      Document,
      'id' | 'createdAt' | 'updatedAt' | 'uploadDate'
    >,
    permissionData: { departmentId?: string; roleId?: string },
  ): Promise<Document>;
  findAuthorizedMany(
    params: {
      skip: number;
      take: number;
      orderBy: { [key: string]: 'asc' | 'desc' };
      departmentId?: string;
    },
    accessContext: DocumentAccessContext,
  ): Promise<{ documents: Document[]; totalCount: number }>;
  delete(id: string): Promise<void>;
  updateStatus(id: string, status: DocumentStatus): Promise<Document>;
}
