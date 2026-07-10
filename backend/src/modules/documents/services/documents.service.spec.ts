/* eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { DocumentStatus, Document, UserRole } from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DocumentsService } from './documents.service';
import { DocumentValidationService } from './document-validation.service';
import {
  IDocumentRepository,
  DOCUMENT_REPOSITORY_TOKEN,
} from '../domain/interfaces/document-repository.interface';
import {
  IStorageProvider,
  STORAGE_PROVIDER_TOKEN,
} from '../domain/interfaces/storage-provider.interface';
import { DocumentAccessContext } from '../domain/interfaces/document-access-context.interface';
import { ListDocumentsDto } from '../dto/list-documents.dto';

describe('DocumentsService', () => {
  let service: DocumentsService;
  let repositoryMock: jest.Mocked<IDocumentRepository>;
  let storageMock: jest.Mocked<IStorageProvider>;
  let eventEmitterMock: any;

  const mockAccessContext: DocumentAccessContext = {
    userId: 'user-uuid',
    roleId: 'role-uuid',
    departmentId: 'dept-uuid',
    roleName: UserRole.Manager,
  };

  const adminAccessContext: DocumentAccessContext = {
    userId: 'admin-uuid',
    roleId: 'admin-role-uuid',
    departmentId: 'admin-dept-uuid',
    roleName: UserRole.Administrator,
  };

  beforeEach(async () => {
    repositoryMock = {
      findByIdUnscoped: jest.fn(),
      findAuthorizedById: jest.fn(),
      findByHash: jest.fn(),
      createWithPermission: jest.fn(),
      findAuthorizedMany: jest.fn(),
      delete: jest.fn(),
      updateStatus: jest.fn(),
    };

    storageMock = {
      saveFile: jest.fn(),
      deleteFile: jest.fn(),
      exists: jest.fn(),
      getFileBuffer: jest.fn(),
    };

    eventEmitterMock = {
      emit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentsService,
        DocumentValidationService,
        {
          provide: DOCUMENT_REPOSITORY_TOKEN,
          useValue: repositoryMock,
        },
        {
          provide: STORAGE_PROVIDER_TOKEN,
          useValue: storageMock,
        },
        {
          provide: EventEmitter2,
          useValue: eventEmitterMock,
        },
      ],
    }).compile();

    service = module.get<DocumentsService>(DocumentsService);
  });

  describe('upload', () => {
    let mockFile: Express.Multer.File;

    beforeEach(() => {
      mockFile = {
        fieldname: 'file',
        originalname: 'test.pdf',
        encoding: '7bit',
        mimetype: 'application/pdf',
        buffer: Buffer.from('%PDF-1.4\ncontent'),
        size: 1024,
      } as unknown as Express.Multer.File;
    });

    it('should throw ConflictException if file content hash is duplicate BEFORE saving file', async () => {
      const findByHashMock = repositoryMock.findByHash as jest.Mock;
      findByHashMock.mockResolvedValue({ id: 'existing-id' });

      await expect(
        service.upload(mockFile, 'user-id', 'dept-id'),
      ).rejects.toThrow(ConflictException);

      expect(repositoryMock.findByHash).toHaveBeenCalled();
      expect(storageMock.saveFile).not.toHaveBeenCalled();
    });

    it('should successfully save file to storage and save metadata in DB in transaction', async () => {
      const findByHashMock = repositoryMock.findByHash as jest.Mock;
      const saveFileMock = storageMock.saveFile as jest.Mock;
      const createMock = repositoryMock.createWithPermission as jest.Mock;

      findByHashMock.mockResolvedValue(null);
      saveFileMock.mockResolvedValue('storage/uploads/secure-uuid.pdf');
      const mockDoc = {
        id: 'doc-uuid',
        filename: 'test.pdf',
        uploadedById: 'user-id',
        tags: ['tag1'],
        documentType: 'PDF',
        status: DocumentStatus.Pending,
        contentHash: 'hash',
        fileSize: 1024,
        filePath: 'storage/uploads/secure-uuid.pdf',
      } as Document;
      createMock.mockResolvedValue(mockDoc);

      const result = await service.upload(
        mockFile,
        'user-id',
        'dept-id',
        'tag1',
      );

      expect(result).toBe(mockDoc);
      expect(storageMock.saveFile).toHaveBeenCalledWith(
        expect.any(String),
        mockFile.buffer,
        mockFile.mimetype,
      );
      expect(repositoryMock.createWithPermission).toHaveBeenCalledWith(
        expect.objectContaining({
          filename: 'test.pdf',
          filePath: 'storage/uploads/secure-uuid.pdf',
        }),
        { departmentId: 'dept-id' },
      );
      expect(eventEmitterMock.emit).toHaveBeenCalledWith('document.uploaded', {
        documentId: 'doc-uuid',
      });
    });

    it('should rollback file upload on storage if database write throws an error', async () => {
      const findByHashMock = repositoryMock.findByHash as jest.Mock;
      const saveFileMock = storageMock.saveFile as jest.Mock;
      const createMock = repositoryMock.createWithPermission as jest.Mock;

      findByHashMock.mockResolvedValue(null);
      saveFileMock.mockResolvedValue('storage/uploads/secure-uuid.pdf');
      createMock.mockRejectedValue(new Error('DB transaction write failed'));

      await expect(
        service.upload(mockFile, 'user-id', 'dept-id'),
      ).rejects.toThrow('DB transaction write failed');

      expect(storageMock.deleteFile).toHaveBeenCalledWith(
        'storage/uploads/secure-uuid.pdf',
      );
    });
  });

  describe('findMany', () => {
    it('should allow same department query for non-admin', async () => {
      const dto = new ListDocumentsDto();
      dto.departmentId = 'dept-uuid';
      repositoryMock.findAuthorizedMany.mockResolvedValue({
        documents: [],
        totalCount: 0,
      });

      await service.findMany(dto, mockAccessContext);

      expect(repositoryMock.findAuthorizedMany).toHaveBeenCalledWith(
        expect.objectContaining({ departmentId: 'dept-uuid' }),
        mockAccessContext,
      );
    });

    it('should throw BadRequestException if non-admin queries another departmentId', async () => {
      const dto = new ListDocumentsDto();
      dto.departmentId = 'other-dept-uuid';

      await expect(service.findMany(dto, mockAccessContext)).rejects.toThrow(
        BadRequestException,
      );
      expect(repositoryMock.findAuthorizedMany).not.toHaveBeenCalled();
    });

    it('should allow admin to filter by any departmentId', async () => {
      const dto = new ListDocumentsDto();
      dto.departmentId = 'other-dept-uuid';
      repositoryMock.findAuthorizedMany.mockResolvedValue({
        documents: [],
        totalCount: 0,
      });

      await service.findMany(dto, adminAccessContext);

      expect(repositoryMock.findAuthorizedMany).toHaveBeenCalledWith(
        expect.objectContaining({ departmentId: 'other-dept-uuid' }),
        adminAccessContext,
      );
    });
  });

  describe('findOne', () => {
    it('should return document if authorized', async () => {
      const doc = { id: 'doc-id', filename: 'test.pdf' } as Document;
      repositoryMock.findAuthorizedById.mockResolvedValue(doc);

      const result = await service.findOne('doc-id', mockAccessContext);
      expect(result).toBe(doc);
      expect(repositoryMock.findAuthorizedById).toHaveBeenCalledWith(
        'doc-id',
        mockAccessContext,
      );
    });

    it('should throw NotFoundException if not authorized or not found', async () => {
      repositoryMock.findAuthorizedById.mockResolvedValue(null);

      await expect(
        service.findOne('non-existent', mockAccessContext),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should allow Admin to delete any document', async () => {
      const doc = {
        id: 'doc-id',
        uploadedById: 'another-user',
        filePath: 'storage/uploads/file.pdf',
      } as Document;
      repositoryMock.findAuthorizedById.mockResolvedValue(doc);

      await service.remove('doc-id', adminAccessContext);

      expect(repositoryMock.delete).toHaveBeenCalledWith('doc-id');
      expect(storageMock.deleteFile).toHaveBeenCalledWith(
        'storage/uploads/file.pdf',
      );
    });

    it('should allow Manager to delete their own uploaded document', async () => {
      const doc = {
        id: 'doc-id',
        uploadedById: 'user-uuid',
        filePath: 'storage/uploads/file.pdf',
      } as Document;
      repositoryMock.findAuthorizedById.mockResolvedValue(doc);

      await service.remove('doc-id', mockAccessContext);

      expect(repositoryMock.delete).toHaveBeenCalledWith('doc-id');
      expect(storageMock.deleteFile).toHaveBeenCalledWith(
        'storage/uploads/file.pdf',
      );
    });

    it("should deny Manager to delete another user's document", async () => {
      const doc = {
        id: 'doc-id',
        uploadedById: 'another-user',
        filePath: 'storage/uploads/file.pdf',
      } as Document;
      repositoryMock.findAuthorizedById.mockResolvedValue(doc);

      await expect(service.remove('doc-id', mockAccessContext)).rejects.toThrow(
        NotFoundException,
      );
      expect(repositoryMock.delete).not.toHaveBeenCalled();
      expect(storageMock.deleteFile).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if document not found for read', async () => {
      repositoryMock.findAuthorizedById.mockResolvedValue(null);

      await expect(
        service.remove('non-existent', mockAccessContext),
      ).rejects.toThrow(NotFoundException);
      expect(repositoryMock.delete).not.toHaveBeenCalled();
      expect(storageMock.deleteFile).not.toHaveBeenCalled();
    });
  });
});
