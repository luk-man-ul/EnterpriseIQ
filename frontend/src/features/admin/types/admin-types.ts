export interface AdminUserListItem {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  roleId: string;
  departmentId: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdminUserPagination {
  page: number;
  limit: number;
  totalCount: number;
}

export interface AdminUserListData {
  users: AdminUserListItem[];
  pagination: AdminUserPagination;
}

export interface DepartmentLookupItem {
  departmentId: string;
  name: string;
  description: string | null;
}

export interface CreateUserPayload {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  roleId: string;
  departmentId: string;
}

