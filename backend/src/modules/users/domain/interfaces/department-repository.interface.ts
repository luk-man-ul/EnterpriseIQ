import { Department } from '@prisma/client';

export const DEPARTMENT_REPOSITORY_TOKEN = 'IDepartmentRepository';

export interface IDepartmentRepository {
  findById(id: string): Promise<Department | null>;
  findByName(name: string): Promise<Department | null>;
  create(
    data: Omit<Department, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<Department>;
}
