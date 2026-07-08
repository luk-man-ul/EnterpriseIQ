import { request } from "../../../services/api-transport";
import { ApiSuccessResponse } from "../../../types/api-contracts";
import {
  LoginRequest,
  LoginResponseData,
  RefreshResponseData,
  CurrentUser,
} from "../types/auth-types";

export const authService = {
  async login(
    credentials: LoginRequest,
  ): Promise<ApiSuccessResponse<LoginResponseData>> {
    return request<ApiSuccessResponse<LoginResponseData>>("auth/login", {
      method: "POST",
      body: credentials as unknown as Record<string, unknown>,
      credentials: "include",
    });
  },

  async refresh(): Promise<ApiSuccessResponse<RefreshResponseData>> {
    return request<ApiSuccessResponse<RefreshResponseData>>("auth/refresh", {
      method: "POST",
      credentials: "include",
    });
  },

  async logout(): Promise<ApiSuccessResponse<Record<string, never>>> {
    return request<ApiSuccessResponse<Record<string, never>>>("auth/logout", {
      method: "POST",
      credentials: "include",
    });
  },

  async getCurrentUser(token: string): Promise<ApiSuccessResponse<CurrentUser>> {
    return request<ApiSuccessResponse<CurrentUser>>("auth/me", {
      method: "GET",
      token,
      credentials: "omit",
    });
  },
};
