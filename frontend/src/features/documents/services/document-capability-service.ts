import { requestWithAuth } from "../../../services/authenticated-request";
import { ApiSuccessResponse } from "../../../types/api-contracts";
import { RoleItem, DocumentCapabilities } from "../types/document-types";

export const documentCapabilityService = {
  async fetchRoles(): Promise<ApiSuccessResponse<RoleItem[]>> {
    return requestWithAuth<ApiSuccessResponse<RoleItem[]>>("roles", {
      method: "GET",
    });
  },

  resolveCapabilities(
    userRoleId: string,
    rolesList: RoleItem[],
  ): DocumentCapabilities {
    const matchedRole = rolesList.find((r) => r.roleId === userRoleId);
    if (!matchedRole) {
      return {
        canUploadDocuments: false,
        canDeleteDocuments: false,
      };
    }

    const isAdminOrManager =
      matchedRole.name === "Administrator" || matchedRole.name === "Manager";

    return {
      canUploadDocuments: isAdminOrManager,
      canDeleteDocuments: isAdminOrManager,
    };
  },
};
