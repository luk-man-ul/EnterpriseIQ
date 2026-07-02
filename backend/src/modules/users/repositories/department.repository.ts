import { Injectable } from '@nestjs/common';
import { Department } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { IDepartmentRepository } from '../domain/interfaces/department-repository.interface';

@Injectable()
export class DepartmentRepository implements IDepartmentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Department | null> {
    return this.prisma.department.findUnique({ where: { id } });
  }

  async findByName(name: string): Promise<Department | null> {
    return this.prisma.department.findUnique({ where: { name } });
  }

  async create(
    data: Omit<Department, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<Department> {
    return this.prisma.department.create({ data });
  }
}
