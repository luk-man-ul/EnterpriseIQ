import { requestWithAuth } from "../../../services/authenticated-request";
import { ApiSuccessResponse } from "../../../types/api-contracts";
import { AdminUserListData, DepartmentLookupItem, CreateUserPayload } from "../types/admin-types";

export const adminService = {
  async listUsers(
    params: { page: number; limit: number },
    signal?: AbortSignal
  ): Promise<ApiSuccessResponse<AdminUserListData>> {
    const query = new URLSearchParams({
      page: String(params.page),
      limit: String(params.limit),
    }).toString();

    return requestWithAuth<ApiSuccessResponse<AdminUserListData>>(`users?${query}`, {
      method: "GET",
      signal,
    });
  },

  async listDepartments(
    signal?: AbortSignal
  ): Promise<ApiSuccessResponse<DepartmentLookupItem[]>> {
    return requestWithAuth<ApiSuccessResponse<DepartmentLookupItem[]>>("departments", {
      method: "GET",
      signal,
    });
  },

  async createUser(
    payload: CreateUserPayload
  ): Promise<ApiSuccessResponse<{ userId: string }>> {
    return requestWithAuth<ApiSuccessResponse<{ userId: string }>>("users", {
      method: "POST",
      body: payload as unknown as Record<string, unknown>,
    });
  },
};
