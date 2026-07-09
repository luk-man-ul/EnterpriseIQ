import { Controller, Get, UseGuards, Inject } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import * as DeptRepo from './domain/interfaces/department-repository.interface';

@UseGuards(JwtAuthGuard)
@Controller('departments')
export class DepartmentsController {
  constructor(
    @Inject(DeptRepo.DEPARTMENT_REPOSITORY_TOKEN)
    private readonly departmentRepository: DeptRepo.IDepartmentRepository,
  ) {}

  @Get()
  async findAll() {
    const departments = await this.departmentRepository.findAll();
    const mapped = departments.map((dept) => ({
      departmentId: dept.id,
      name: dept.name,
      description: dept.description,
    }));

    return {
      success: true,
      message: 'Departments list retrieved.',
      data: mapped,
      timestamp: new Date().toISOString(),
    };
  }
}
