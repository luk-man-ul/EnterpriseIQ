/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return */
import { Test, TestingModule } from '@nestjs/testing';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { DocumentChunkRepository } from './document-chunk.repository';

describe('DocumentChunkRepository', () => {
  let repository: DocumentChunkRepository;
  let prismaServiceMock: any;

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
    const dummyEmbedding = new Array(768).fill(0.1);

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
      const mockCalls = prismaServiceMock.$queryRaw.mock.calls[0];
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
      const mockCalls = prismaServiceMock.$queryRaw.mock.calls[0];
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

      const mockCalls = prismaServiceMock.$queryRaw.mock.calls[0];
      const sqlText = mockCalls[0].join(' ');

      // Verify that we do not perform a direct JOIN on document_permissions
      expect(sqlText).toContain('EXISTS');
      expect(sqlText).not.toContain('JOIN "document_permissions"');
    });
  });
});
