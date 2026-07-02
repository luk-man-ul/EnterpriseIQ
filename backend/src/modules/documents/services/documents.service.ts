import {
  Injectable,
  Inject,
  ConflictException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { Document, DocumentStatus } from '@prisma/client';
import * as crypto from 'crypto';
import * as path from 'path';
import type { IDocumentRepository } from '../domain/interfaces/document-repository.interface';
import { DOCUMENT_REPOSITORY_TOKEN } from '../domain/interfaces/document-repository.interface';
import type { IStorageProvider } from '../domain/interfaces/storage-provider.interface';
import { STORAGE_PROVIDER_TOKEN } from '../domain/interfaces/storage-provider.interface';
import { DocumentValidationService } from './document-validation.service';
import { ListDocumentsDto } from '../dto/list-documents.dto';

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    @Inject(DOCUMENT_REPOSITORY_TOKEN)
    private readonly documentRepository: IDocumentRepository,
    @Inject(STORAGE_PROVIDER_TOKEN)
    private readonly storageProvider: IStorageProvider,
    private readonly validationService: DocumentValidationService,
  ) {}

  async upload(
    file: Express.Multer.File,
    uploadedById: string,
    departmentId?: string,
    tags?: string,
  ): Promise<Document> {
    // 1. Validate file size
    this.validationService.validateSize(file.size);

    // 2. Sanitize original filename
    const sanitizedFilename = this.validationService.sanitizeFilename(
      file.originalname,
    );

    // 3. Binary signature validation (Authoritative type check)
    const fileType = this.validationService.validateMagicBytes(
      file.buffer,
      sanitizedFilename,
    );

    // 4. Calculate SHA-256 hash
    const hash = this.validationService.calculateHash(file.buffer);

    // 5. Duplicate detection BEFORE saving to disk
    const existingDocument = await this.documentRepository.findByHash(hash);
    if (existingDocument) {
      throw new ConflictException(
        'A document with this content hash already exists.',
      );
    }

    // 6. Generate secure key for storage
    const fileKey = `${crypto.randomUUID()}${path.extname(sanitizedFilename)}`;

    // 7. Save file to storage provider
    const filePath = await this.storageProvider.saveFile(
      fileKey,
      file.buffer,
      file.mimetype,
    );

    // 8. Atomic Database writes inside repository
    const tagsArray = tags
      ? tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
      : [];

    try {
      const document = await this.documentRepository.createWithPermission(
        {
          filename: sanitizedFilename,
          uploadedById,
          tags: tagsArray,
          documentType: fileType,
          status: DocumentStatus.Pending,
          contentHash: hash,
          fileSize: file.size,
          filePath,
        },
        {
          departmentId,
        },
      );

      this.logger.log(
        `Successfully uploaded and registered document: ${document.id}`,
      );
      return document;
    } catch (err) {
      this.logger.error(
        `Failed to persist document to database. Rolling back stored file.`,
        err,
      );
      // Rollback saved file from storage
      try {
        await this.storageProvider.deleteFile(filePath);
      } catch (rollbackErr) {
        this.logger.error(
          `Storage rollback failed for path: ${filePath}`,
          rollbackErr,
        );
      }
      throw err;
    }
  }

  async findMany(dto: ListDocumentsDto) {
    const skip = (dto.page - 1) * dto.limit;
    const take = dto.limit;

    const orderBy = { [dto.sort]: dto.order };
    const where = dto.departmentId
      ? { departmentId: dto.departmentId }
      : undefined;

    const { documents, totalCount } = await this.documentRepository.findMany({
      skip,
      take,
      orderBy,
      where,
    });

    return {
      documents,
      pagination: {
        page: dto.page,
        limit: dto.limit,
        totalCount,
      },
    };
  }

  async findOne(id: string): Promise<Document> {
    const document = await this.documentRepository.findById(id);
    if (!document) {
      throw new NotFoundException(`Document with ID ${id} not found.`);
    }
    return document;
  }

  async remove(id: string): Promise<void> {
    const document = await this.documentRepository.findById(id);
    if (!document) {
      throw new NotFoundException(`Document with ID ${id} not found.`);
    }

    // 1. Delete database record (associated permissions will cascade delete)
    await this.documentRepository.delete(id);

    // 2. Delete file from physical storage medium
    try {
      await this.storageProvider.deleteFile(document.filePath);
    } catch (err) {
      this.logger.error(
        `Failed to delete physical file at ${document.filePath} on document delete.`,
        err,
      );
    }
    this.logger.log(`Successfully deleted document and files: ${id}`);
  }
}
