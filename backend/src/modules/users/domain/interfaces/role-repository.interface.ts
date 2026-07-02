import { Role, UserRole } from '@prisma/client';

export const ROLE_REPOSITORY_TOKEN = 'IRoleRepository';

export interface IRoleRepository {
  findById(id: string): Promise<Role | null>;
  findByName(name: UserRole): Promise<Role | null>;
  create(data: Omit<Role, 'id' | 'createdAt' | 'updatedAt'>): Promise<Role>;
  findAll(): Promise<Role[]>;
}
