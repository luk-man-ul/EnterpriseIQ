export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginUser {
  userId: string;
  email: string;
  roleId: string;
  departmentId: string;
}

export interface LoginResponseData {
  accessToken: string;
  user: LoginUser;
}

export interface RefreshResponseData {
  accessToken: string;
}

export interface CurrentUser {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  roleId: string;
  departmentId: string;
}
