/* eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { DocumentStatus, Document } from '@prisma/client';
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

describe('DocumentsService', () => {
  let service: DocumentsService;
  let repositoryMock: jest.Mocked<IDocumentRepository>;
  let storageMock: jest.Mocked<IStorageProvider>;
  let eventEmitterMock: any;

  beforeEach(async () => {
    repositoryMock = {
      findById: jest.fn(),
      findByHash: jest.fn(),
      createWithPermission: jest.fn(),
      findMany: jest.fn(),
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

  describe('findOne', () => {
    it('should return document if found', async () => {
      const doc = { id: 'doc-id', filename: 'test.pdf' } as Document;
      const findByIdMock = repositoryMock.findById as jest.Mock;
      findByIdMock.mockResolvedValue(doc);

      const result = await service.findOne('doc-id');
      expect(result).toBe(doc);
    });

    it('should throw NotFoundException if not found', async () => {
      const findByIdMock = repositoryMock.findById as jest.Mock;
      findByIdMock.mockResolvedValue(null);

      await expect(service.findOne('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('should delete database record first then storage file', async () => {
      const doc = {
        id: 'doc-id',
        filePath: 'storage/uploads/file.pdf',
      } as Document;
      const findByIdMock = repositoryMock.findById as jest.Mock;
      findByIdMock.mockResolvedValue(doc);

      await service.remove('doc-id');

      expect(repositoryMock.delete).toHaveBeenCalledWith('doc-id');
      expect(storageMock.deleteFile).toHaveBeenCalledWith(
        'storage/uploads/file.pdf',
      );
    });

    it('should throw NotFoundException if document not found', async () => {
      const findByIdMock = repositoryMock.findById as jest.Mock;
      findByIdMock.mockResolvedValue(null);

      await expect(service.remove('non-existent')).rejects.toThrow(
        NotFoundException,
      );
      expect(repositoryMock.delete).not.toHaveBeenCalled();
      expect(storageMock.deleteFile).not.toHaveBeenCalled();
    });
  });
});
