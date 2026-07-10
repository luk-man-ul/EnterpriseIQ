/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { Test, TestingModule } from '@nestjs/testing';
import { UserRole } from '@prisma/client';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from '../services/documents.service';
import { ListDocumentsDto } from '../dto/list-documents.dto';
import { Request } from 'express';

describe('DocumentsController', () => {
  let controller: DocumentsController;
  let serviceMock: any;

  const mockExpressUser = {
    userId: 'user-uuid',
    email: 'user@company.com',
    firstName: 'John',
    lastName: 'Doe',
    roleId: 'role-uuid',
    departmentId: 'dept-uuid',
    roleName: UserRole.Manager,
  };

  const mockRequest = {
    user: mockExpressUser,
  } as unknown as Request;

  beforeEach(async () => {
    serviceMock = {
      findMany: jest.fn().mockResolvedValue({ documents: [], pagination: {} }),
      findOne: jest.fn().mockResolvedValue({
        id: 'doc-uuid',
        filename: 'test.pdf',
        status: 'Completed',
        fileSize: 100,
        uploadedById: 'user-uuid',
        permissions: [{ departmentId: 'dept-uuid' }],
      }),
      remove: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DocumentsController],
      providers: [
        {
          provide: DocumentsService,
          useValue: serviceMock,
        },
      ],
    }).compile();

    controller = module.get<DocumentsController>(DocumentsController);
  });

  it('should map req.user to DocumentAccessContext and forward to findMany', async () => {
    const dto = new ListDocumentsDto();
    await controller.findAll(dto, mockRequest);

    expect(serviceMock.findMany).toHaveBeenCalledWith(
      dto,
      expect.objectContaining({
        userId: 'user-uuid',
        roleId: 'role-uuid',
        departmentId: 'dept-uuid',
        roleName: UserRole.Manager,
      }),
    );
  });

  it('should map req.user to DocumentAccessContext and forward to findOne (detail)', async () => {
    await controller.findOne('doc-uuid', mockRequest);

    expect(serviceMock.findOne).toHaveBeenCalledWith(
      'doc-uuid',
      expect.objectContaining({
        userId: 'user-uuid',
        roleId: 'role-uuid',
        departmentId: 'dept-uuid',
        roleName: UserRole.Manager,
      }),
    );
  });

  it('should map req.user to DocumentAccessContext and forward to getStatus', async () => {
    await controller.getStatus('doc-uuid', mockRequest);

    expect(serviceMock.findOne).toHaveBeenCalledWith(
      'doc-uuid',
      expect.objectContaining({
        userId: 'user-uuid',
        roleId: 'role-uuid',
        departmentId: 'dept-uuid',
        roleName: UserRole.Manager,
      }),
    );
  });

  it('should map req.user to DocumentAccessContext and forward to remove (delete)', async () => {
    await controller.remove('doc-uuid', mockRequest);

    expect(serviceMock.remove).toHaveBeenCalledWith(
      'doc-uuid',
      expect.objectContaining({
        userId: 'user-uuid',
        roleId: 'role-uuid',
        departmentId: 'dept-uuid',
        roleName: UserRole.Manager,
      }),
    );
  });
});
