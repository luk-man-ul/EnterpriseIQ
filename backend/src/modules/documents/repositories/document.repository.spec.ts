/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
import { Test, TestingModule } from '@nestjs/testing';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { DocumentRepository } from './document.repository';
import { DocumentAccessContext } from '../domain/interfaces/document-access-context.interface';

describe('DocumentRepository', () => {
  let repository: DocumentRepository;
  let prismaServiceMock: any;

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
    prismaServiceMock = {
      document: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentRepository,
        {
          provide: PrismaService,
          useValue: prismaServiceMock,
        },
      ],
    }).compile();

    repository = module.get<DocumentRepository>(DocumentRepository);
  });

  describe('findByIdUnscoped', () => {
    it('should call prisma.document.findUnique unscoped', async () => {
      prismaServiceMock.document.findUnique.mockResolvedValue({
        id: 'doc-uuid',
      });

      const result = await repository.findByIdUnscoped('doc-uuid');
      expect(result).toEqual({ id: 'doc-uuid' });
      expect(prismaServiceMock.document.findUnique).toHaveBeenCalledWith({
        where: { id: 'doc-uuid' },
        include: { permissions: true },
      });
    });
  });

  describe('findAuthorizedById', () => {
    it('should bypass authorization predicate for Administrator', async () => {
      prismaServiceMock.document.findFirst.mockResolvedValue({
        id: 'doc-uuid',
      });

      await repository.findAuthorizedById('doc-uuid', adminAccessContext);

      expect(prismaServiceMock.document.findFirst).toHaveBeenCalledWith({
        where: { id: 'doc-uuid' },
        include: { permissions: true },
      });
    });

    it('should inject permissions checks for Manager/Employee', async () => {
      prismaServiceMock.document.findFirst.mockResolvedValue({
        id: 'doc-uuid',
      });

      await repository.findAuthorizedById('doc-uuid', mockAccessContext);

      expect(prismaServiceMock.document.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'doc-uuid',
          permissions: {
            some: {
              AND: [
                {
                  OR: [{ departmentId: null }, { departmentId: 'dept-uuid' }],
                },
                {
                  OR: [{ roleId: null }, { roleId: 'role-uuid' }],
                },
              ],
            },
          },
        },
        include: { permissions: true },
      });
    });
  });

  describe('findAuthorizedMany', () => {
    it('should list all documents without filters for Administrator if filter is empty', async () => {
      await repository.findAuthorizedMany(
        { skip: 0, take: 10, orderBy: { createdAt: 'desc' } },
        adminAccessContext,
      );

      expect(prismaServiceMock.document.findMany).toHaveBeenCalledWith({
        skip: 0,
        take: 10,
        orderBy: { createdAt: 'desc' },
        where: {},
        include: { permissions: true },
      });
      expect(prismaServiceMock.document.count).toHaveBeenCalledWith({
        where: {},
      });
    });

    it('should filter by departmentId for Administrator if client filter is supplied', async () => {
      await repository.findAuthorizedMany(
        {
          skip: 0,
          take: 10,
          orderBy: { createdAt: 'desc' },
          departmentId: 'filter-dept-uuid',
        },
        adminAccessContext,
      );

      expect(prismaServiceMock.document.findMany).toHaveBeenCalledWith({
        skip: 0,
        take: 10,
        orderBy: { createdAt: 'desc' },
        where: {
          permissions: {
            some: {
              departmentId: 'filter-dept-uuid',
            },
          },
        },
        include: { permissions: true },
      });
      expect(prismaServiceMock.document.count).toHaveBeenCalledWith({
        where: {
          permissions: {
            some: {
              departmentId: 'filter-dept-uuid',
            },
          },
        },
      });
    });

    it('should restrict list and count queries to user department permissions for Manager/Employee', async () => {
      await repository.findAuthorizedMany(
        { skip: 0, take: 10, orderBy: { createdAt: 'desc' } },
        mockAccessContext,
      );

      const expectedPredicate = {
        permissions: {
          some: {
            AND: [
              {
                OR: [{ departmentId: null }, { departmentId: 'dept-uuid' }],
              },
              {
                OR: [{ roleId: null }, { roleId: 'role-uuid' }],
              },
            ],
          },
        },
      };

      expect(prismaServiceMock.document.findMany).toHaveBeenCalledWith({
        skip: 0,
        take: 10,
        orderBy: { createdAt: 'desc' },
        where: expectedPredicate,
        include: { permissions: true },
      });
      expect(prismaServiceMock.document.count).toHaveBeenCalledWith({
        where: expectedPredicate,
      });
    });
  });
});
