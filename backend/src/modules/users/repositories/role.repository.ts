import { Injectable } from '@nestjs/common';
import { Role, UserRole } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { IRoleRepository } from '../domain/interfaces/role-repository.interface';

@Injectable()
export class RoleRepository implements IRoleRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Role | null> {
    return this.prisma.role.findUnique({ where: { id } });
  }

  async findByName(name: UserRole): Promise<Role | null> {
    return this.prisma.role.findUnique({ where: { name } });
  }

  async create(
    data: Omit<Role, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<Role> {
    return this.prisma.role.create({ data });
  }

  async findAll(): Promise<Role[]> {
    return this.prisma.role.findMany();
  }
}
