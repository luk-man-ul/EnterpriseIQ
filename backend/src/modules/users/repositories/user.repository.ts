import { Injectable } from '@nestjs/common';
import { User } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { IUserRepository } from '../domain/interfaces/user-repository.interface';

@Injectable()
export class UserRepository implements IUserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async create(
    data: Omit<User, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<User> {
    return this.prisma.user.create({ data });
  }

  async update(
    id: string,
    data: Partial<Omit<User, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<User> {
    return this.prisma.user.update({ where: { id }, data });
  }

  async delete(id: string): Promise<User> {
    return this.prisma.user.delete({ where: { id } });
  }

  async findMany(params: {
    skip: number;
    take: number;
    orderBy: { [key: string]: 'asc' | 'desc' };
    where?: { departmentId?: string };
  }): Promise<{ users: User[]; totalCount: number }> {
    const { skip, take, orderBy, where } = params;

    const [users, totalCount] = await Promise.all([
      this.prisma.user.findMany({
        skip,
        take,
        orderBy,
        where,
      }),
      this.prisma.user.count({ where }),
    ]);

    return { users, totalCount };
  }
}
