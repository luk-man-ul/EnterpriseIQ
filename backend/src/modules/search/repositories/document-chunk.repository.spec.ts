/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return */
import { Test, TestingModule } from '@nestjs/testing';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { DocumentChunkRepository } from './document-chunk.repository';
import { DocumentChunkSaveInput } from '../domain/interfaces/document-chunk-repository.interface';

describe('DocumentChunkRepository', () => {
  let repository: DocumentChunkRepository;
  let prismaServiceMock: {
    $queryRaw: jest.Mock;
    $executeRaw: jest.Mock;
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    prismaServiceMock = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      $executeRaw: jest.fn().mockResolvedValue(0),
      $transaction: jest.fn((cb) => cb(prismaServiceMock)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentChunkRepository,
        {
          provide: PrismaService,
          useValue: prismaServiceMock,
        },
      ],
    }).compile();

    repository = module.get<DocumentChunkRepository>(DocumentChunkRepository);
  });

  describe('searchChunks', () => {
    const dummyEmbedding: number[] = new Array<number>(768).fill(0.1);

    it('should throw an error if query embedding length is not exactly 768 dimensions', async () => {
      const invalidEmbedding = [0.1, 0.2];
      await expect(
        repository.searchChunks({
          queryEmbedding: invalidEmbedding,
          limit: 5,
          userRoleId: 'role-uuid',
          userDepartmentId: 'dept-uuid',
          roleName: UserRole.Employee,
        }),
      ).rejects.toThrow(/Query embedding must contain exactly 768 dimensions/);

      expect(prismaServiceMock.$queryRaw).not.toHaveBeenCalled();
    });

    it('should execute raw SQL query with correct parameter bindings for Administrator', async () => {
      await repository.searchChunks({
        queryEmbedding: dummyEmbedding,
        limit: 5,
        userRoleId: 'role-uuid',
        userDepartmentId: 'dept-uuid',
        roleName: UserRole.Administrator,
      });

      expect(prismaServiceMock.$queryRaw).toHaveBeenCalled();
      const mockCalls = prismaServiceMock.$queryRaw.mock.calls[0] as [
        string[],
        ...unknown[],
      ];
      const sqlText = mockCalls[0].join(' ');
      const sqlValues = mockCalls.slice(1);

      // Verify that SQL composition contains key security elements
      expect(sqlText).toContain('d."status" = \'Completed\'');
      expect(sqlText).toContain('LIMIT');
      expect(sqlText).toContain('EXISTS');

      // Verify bindings are present
      const expectedVectorStr = `[${dummyEmbedding.join(',')}]`;
      expect(sqlValues).toContain(true); // isAdmin = true
      expect(sqlValues).toContain(5); // limit = 5
      expect(sqlValues).toContain(expectedVectorStr); // queryEmbedding as vector string
    });

    it('should execute raw SQL query with correct parameter bindings for Manager/Employee', async () => {
      const deptId = 'dept-uuid-1234';
      const roleId = 'role-uuid-5678';
      const limit = 10;
      const threshold = 0.55;

      await repository.searchChunks({
        queryEmbedding: dummyEmbedding,
        limit,
        userRoleId: roleId,
        userDepartmentId: deptId,
        roleName: UserRole.Employee,
        threshold,
      });

      expect(prismaServiceMock.$queryRaw).toHaveBeenCalled();
      const mockCalls = prismaServiceMock.$queryRaw.mock.calls[0] as [
        string[],
        ...unknown[],
      ];
      const sqlText = mockCalls[0].join(' ');
      const sqlValues = mockCalls.slice(1);

      expect(sqlText).toContain('d."status" = \'Completed\'');
      expect(sqlText).toContain('EXISTS');
      expect(sqlText).toContain('dp."departmentId" =');
      expect(sqlText).toContain('dp."roleId" =');

      // Verify values
      expect(sqlValues).toContain(false); // isAdmin = false
      expect(sqlValues).toContain(deptId);
      expect(sqlValues).toContain(roleId);
      expect(sqlValues).toContain(threshold);
      expect(sqlValues).toContain(limit);
    });

    it('should use EXISTS subquery to prevent duplication of chunk rows', async () => {
      await repository.searchChunks({
        queryEmbedding: dummyEmbedding,
        limit: 5,
        userRoleId: 'role-uuid',
        userDepartmentId: 'dept-uuid',
        roleName: UserRole.Employee,
      });

      const mockCalls = prismaServiceMock.$queryRaw.mock.calls[0] as [
        string[],
        ...unknown[],
      ];
      const sqlText = mockCalls[0].join(' ');

      // Verify that we do not perform a direct JOIN on document_permissions
      expect(sqlText).toContain('EXISTS');
      expect(sqlText).not.toContain('JOIN "document_permissions"');
    });
  });

  describe('saveChunks', () => {
    const validEmbedding: number[] = new Array<number>(768).fill(0.15);

    it('should return early without opening a transaction if input array is empty', async () => {
      await repository.saveChunks([]);
      expect(prismaServiceMock.$transaction).not.toHaveBeenCalled();
    });

    it('should execute raw insert inside transaction with serialized vector string', async () => {
      const mockChunk: DocumentChunkSaveInput = {
        documentId: 'doc-uuid-123',
        content: 'Sample text chunk',
        embedding: validEmbedding,
        chunkIndex: 0,
        tokenCount: 10,
        characterCount: 50,
        metadata: { pageNumber: 1 },
      };

      await repository.saveChunks([mockChunk]);

      expect(prismaServiceMock.$transaction).toHaveBeenCalled();
      expect(prismaServiceMock.$executeRaw).toHaveBeenCalled();

      const executeCalls = prismaServiceMock.$executeRaw.mock.calls[0] as [
        string[],
        ...unknown[],
      ];
      const sqlText = executeCalls[0].join(' ');
      const sqlValues = executeCalls.slice(1);

      expect(sqlText).toContain('INSERT INTO "document_chunks"');
      expect(sqlText).toContain('::vector');
      expect(sqlText).toContain('::jsonb');

      const expectedVectorStr = `[${validEmbedding.join(',')}]`;
      expect(sqlValues).toContain(expectedVectorStr);
      expect(sqlValues).not.toContain(validEmbedding);
    });

    it('should throw an error and fail transaction if embedding contains wrong dimension', async () => {
      const invalidEmbedding = [0.1, 0.2];
      const mockChunk: DocumentChunkSaveInput = {
        documentId: 'doc-uuid-123',
        content: 'Sample text chunk',
        embedding: invalidEmbedding,
        chunkIndex: 0,
        tokenCount: 10,
        characterCount: 50,
        metadata: { pageNumber: 1 },
      };

      await expect(repository.saveChunks([mockChunk])).rejects.toThrow(
        /Chunk embedding must contain exactly 768 dimensions \(got 2\)/,
      );

      expect(prismaServiceMock.$executeRaw).not.toHaveBeenCalled();
    });

    it('should throw an error and fail transaction if embedding contains NaN', async () => {
      const nanEmbedding: number[] = new Array<number>(768).fill(0.1);
      nanEmbedding[5] = NaN;

      const mockChunk: DocumentChunkSaveInput = {
        documentId: 'doc-uuid-123',
        content: 'Sample text chunk',
        embedding: nanEmbedding,
        chunkIndex: 0,
        tokenCount: 10,
        characterCount: 50,
        metadata: { pageNumber: 1 },
      };

      await expect(repository.saveChunks([mockChunk])).rejects.toThrow(
        /Chunk embedding elements must be finite numbers \(encountered invalid value: NaN at index 5\)/,
      );

      expect(prismaServiceMock.$executeRaw).not.toHaveBeenCalled();
    });

    it('should throw an error and fail transaction if embedding contains Infinity', async () => {
      const infEmbedding: number[] = new Array<number>(768).fill(0.15);
      infEmbedding[10] = Infinity;

      const mockChunk: DocumentChunkSaveInput = {
        documentId: 'doc-uuid-123',
        content: 'Sample text chunk',
        embedding: infEmbedding,
        chunkIndex: 0,
        tokenCount: 10,
        characterCount: 50,
        metadata: { pageNumber: 1 },
      };

      await expect(repository.saveChunks([mockChunk])).rejects.toThrow(
        /Chunk embedding elements must be finite numbers \(encountered invalid value: Infinity at index 10\)/,
      );

      expect(prismaServiceMock.$executeRaw).not.toHaveBeenCalled();
    });

    it('should throw an error and fail transaction if embedding contains -Infinity', async () => {
      const negInfEmbedding: number[] = new Array<number>(768).fill(0.2);
      negInfEmbedding[20] = -Infinity;

      const mockChunk: DocumentChunkSaveInput = {
        documentId: 'doc-uuid-123',
        content: 'Sample text chunk',
        embedding: negInfEmbedding,
        chunkIndex: 0,
        tokenCount: 10,
        characterCount: 50,
        metadata: { pageNumber: 1 },
      };

      await expect(repository.saveChunks([mockChunk])).rejects.toThrow(
        /Chunk embedding elements must be finite numbers \(encountered invalid value: -Infinity at index 20\)/,
      );

      expect(prismaServiceMock.$executeRaw).not.toHaveBeenCalled();
    });
  });
});
