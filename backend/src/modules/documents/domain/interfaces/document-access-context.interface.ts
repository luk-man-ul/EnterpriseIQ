import { UserRole } from '@prisma/client';

export interface DocumentAccessContext {
  userId: string;
  roleId: string;
  departmentId: string;
  roleName: UserRole;
}
