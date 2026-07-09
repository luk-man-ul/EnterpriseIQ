/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
import { Test, TestingModule } from '@nestjs/testing';
import { DepartmentsController } from './departments.controller';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import * as DeptRepo from './domain/interfaces/department-repository.interface';
import { DepartmentRepository } from './repositories/department.repository';
import { PrismaService } from '../../infrastructure/database/prisma.service';

describe('DepartmentsController and Repository', () => {
  let controller: DepartmentsController;
  let repository: DepartmentRepository;

  const mockDepartments = [
    {
      id: 'uuid-1',
      name: 'Engineering',
      description: 'Technical team',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'uuid-2',
      name: 'Marketing',
      description: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  const mockPrismaService = {
    department: {
      findMany: jest.fn().mockResolvedValue(mockDepartments),
    },
  };

  const mockDepartmentRepository = {
    findAll: jest.fn().mockResolvedValue(mockDepartments),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DepartmentsController],
      providers: [
        {
          provide: DeptRepo.DEPARTMENT_REPOSITORY_TOKEN,
          useValue: mockDepartmentRepository,
        },
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        DepartmentRepository,
      ],
    }).compile();

    controller = module.get<DepartmentsController>(DepartmentsController);
    repository = module.get<DepartmentRepository>(DepartmentRepository);
    jest.clearAllMocks();
  });

  describe('DepartmentsController Routing and Guards', () => {
    it('should be configured with Controller prefix "departments" and JwtAuthGuard', () => {
      const guards = Reflect.getMetadata('__guards__', DepartmentsController);
      expect(guards).toBeDefined();
      expect(guards[0]).toBe(JwtAuthGuard);

      const path = Reflect.getMetadata('path', DepartmentsController);
      expect(path).toBe('departments');
    });
  });

  describe('DepartmentsController Handler', () => {
    it('should retrieve list of departments and map fields exactly', async () => {
      const response = await controller.findAll();

      expect(response.success).toBe(true);
      expect(response.message).toBe('Departments list retrieved.');
      expect(response.timestamp).toBeDefined();
      expect(response.data).toHaveLength(2);

      expect(response.data[0]).toEqual({
        departmentId: 'uuid-1',
        name: 'Engineering',
        description: 'Technical team',
      });

      // Assert nullable description remains null
      expect(response.data[1]).toEqual({
        departmentId: 'uuid-2',
        name: 'Marketing',
        description: null,
      });

      expect(mockDepartmentRepository.findAll).toHaveBeenCalledTimes(1);
    });
  });

  describe('DepartmentRepository Implementation', () => {
    it('should call Prisma findMany ordered by name ascending', async () => {
      await repository.findAll();

      expect(mockPrismaService.department.findMany).toHaveBeenCalledWith({
        orderBy: { name: 'asc' },
      });
    });
  });
});
