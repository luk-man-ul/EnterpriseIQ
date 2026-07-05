/* eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
import { Test, TestingModule } from '@nestjs/testing';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { SearchController } from './search.controller';
import { SearchService } from '../services/search.service';

describe('SearchController', () => {
  let controller: SearchController;
  let searchServiceMock: jest.Mocked<SearchService>;

  beforeEach(async () => {
    searchServiceMock = {
      search: jest.fn().mockResolvedValue({ query: 'test', results: [] }),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SearchController],
      providers: [
        {
          provide: SearchService,
          useValue: searchServiceMock,
        },
      ],
    }).compile();

    controller = module.get<SearchController>(SearchController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should delegate search to SearchService with correct arguments, excluding userId', async () => {
    const mockUser = {
      userId: 'user-uuid-999',
      roleId: 'role-uuid-111',
      departmentId: 'dept-uuid-222',
      roleName: UserRole.Employee,
      email: 'employee@test.com',
      firstName: 'Test',
      lastName: 'User',
    };

    const mockReq = {
      user: mockUser,
    } as any;

    const dto = {
      query: 'what is the corporate policy?',
      limit: 10,
      threshold: 0.5,
    };

    const expectedResponse = {
      query: 'what is the corporate policy?',
      results: [],
    };
    searchServiceMock.search.mockResolvedValue(expectedResponse);

    const result = await controller.search(dto, mockReq);

    // Verify service delegation
    expect(searchServiceMock.search).toHaveBeenCalledTimes(1);
    expect(searchServiceMock.search).toHaveBeenCalledWith(dto, {
      userRoleId: 'role-uuid-111',
      userDepartmentId: 'dept-uuid-222',
      roleName: UserRole.Employee,
    });

    // Verify returned response matches service response wrapped in envelope
    expect(result.success).toBe(true);
    expect(result.data).toBe(expectedResponse);
    expect(result.timestamp).toBeDefined();

    // Explicitly assert that the userId was NOT passed into the authorization parameters
    const calledArgs = searchServiceMock.search.mock.calls[0][1];
    expect(calledArgs).not.toHaveProperty('userId');
  });

  it('should be protected by JwtAuthGuard via class decorator metadata', () => {
    const guards = Reflect.getMetadata('__guards__', SearchController);
    expect(guards).toBeDefined();
    expect(guards).toHaveLength(1);
    expect(guards[0]).toBe(JwtAuthGuard);
  });
});
