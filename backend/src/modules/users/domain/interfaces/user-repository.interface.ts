import { User } from '@prisma/client';

export const USER_REPOSITORY_TOKEN = 'IUserRepository';

export interface IUserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  create(data: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User>;
  update(
    id: string,
    data: Partial<Omit<User, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<User>;
  delete(id: string): Promise<User>;
  findMany(params: {
    skip: number;
    take: number;
    orderBy: { [key: string]: 'asc' | 'desc' };
    where?: { departmentId?: string };
  }): Promise<{ users: User[]; totalCount: number }>;
}
