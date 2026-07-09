import { vi, describe, it, expect, beforeEach } from "vitest";
import { adminService } from "./services/admin-service";
import { requestWithAuth } from "../../services/authenticated-request";
import { ApiError } from "../../services/api-transport";

vi.mock("../../services/authenticated-request", () => ({
  requestWithAuth: vi.fn(),
}));

describe("Admin Service and Capabilities Spec", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("API Request Composition", () => {
    it("should fetch paginated users via requestWithAuth", async () => {
      vi.mocked(requestWithAuth).mockResolvedValue({
        success: true,
        message: "Users list retrieved.",
        data: {
          users: [],
          pagination: { page: 1, limit: 20, totalCount: 0 },
        },
      });

      const res = await adminService.listUsers({ page: 2, limit: 15 });

      expect(vi.mocked(requestWithAuth)).toHaveBeenCalledTimes(1);
      expect(vi.mocked(requestWithAuth)).toHaveBeenCalledWith("users?page=2&limit=15", {
        method: "GET",
        signal: undefined,
      });
      expect(res.success).toBe(true);
    });

    it("should fetch departments via requestWithAuth", async () => {
      vi.mocked(requestWithAuth).mockResolvedValue({
        success: true,
        message: "Departments list retrieved.",
        data: [],
      });

      const res = await adminService.listDepartments();

      expect(vi.mocked(requestWithAuth)).toHaveBeenCalledTimes(1);
      expect(vi.mocked(requestWithAuth)).toHaveBeenCalledWith("departments", {
        method: "GET",
        signal: undefined,
      });
      expect(res.success).toBe(true);
    });
  });

  describe("Admin Capability Resolution", () => {
    const rolesList = [
      { roleId: "r1", name: "Administrator", description: null },
      { roleId: "r2", name: "Manager", description: null },
      { roleId: "r3", name: "Employee", description: null },
    ];

    const resolveAdmin = (roleId: string | undefined, list: typeof rolesList) => {
      if (!roleId) return false;
      const matched = list.find((r) => r.roleId === roleId);
      return matched?.name === "Administrator";
    };

    it("should resolve true only for Administrator role", () => {
      expect(resolveAdmin("r1", rolesList)).toBe(true);
      expect(resolveAdmin("r2", rolesList)).toBe(false);
      expect(resolveAdmin("r3", rolesList)).toBe(false);
      expect(resolveAdmin("r4", rolesList)).toBe(false); // unknown
      expect(resolveAdmin(undefined, rolesList)).toBe(false); // missing
    });
  });

  describe("Label Resolution Map Helpers", () => {
    const roles = [{ roleId: "r1", name: "Administrator", description: null }];
    const departments = [{ departmentId: "d1", name: "IT", description: null }];

    const getRoleLabel = (roleId: string, list: typeof roles) => {
      const match = list.find((r) => r.roleId === roleId);
      return match ? match.name : "Unknown role";
    };

    const getDeptLabel = (deptId: string, list: typeof departments) => {
      const match = list.find((d) => d.departmentId === deptId);
      return match ? match.name : "Unknown department";
    };

    it("resolves role labels or returns unknown fallback", () => {
      expect(getRoleLabel("r1", roles)).toBe("Administrator");
      expect(getRoleLabel("r2", roles)).toBe("Unknown role");
    });

    it("resolves department labels or returns unknown fallback", () => {
      expect(getDeptLabel("d1", departments)).toBe("IT");
      expect(getDeptLabel("d2", departments)).toBe("Unknown department");
    });
  });

  describe("Error Propagation", () => {
    it("should propagate ApiError objects correctly", async () => {
      vi.mocked(requestWithAuth).mockRejectedValue(new ApiError(403, "Forbidden", "Access Denied"));

      await expect(adminService.listUsers({ page: 1, limit: 10 })).rejects.toThrow(ApiError);
    });

    it("should propagate TypeError objects correctly", async () => {
      vi.mocked(requestWithAuth).mockRejectedValue(new TypeError("Failed to fetch"));

      await expect(adminService.listUsers({ page: 1, limit: 10 })).rejects.toThrow(TypeError);
    });
  });

  describe("Create User payload and API routing", () => {
    it("should send standard POST request to users route with plain JSON body", async () => {
      vi.mocked(requestWithAuth).mockResolvedValue({
        success: true,
        message: "User created successfully.",
        data: { userId: "new-user-uuid" },
      });

      const payload = {
        firstName: "Test",
        lastName: "User",
        email: "testuser@enterpriseiq.local",
        password: "Password@123456",
        roleId: "role-uuid",
        departmentId: "dept-uuid",
      };

      const res = await adminService.createUser(payload);

      expect(vi.mocked(requestWithAuth)).toHaveBeenCalledTimes(1);
      expect(vi.mocked(requestWithAuth)).toHaveBeenCalledWith("users", {
        method: "POST",
        body: payload,
      });
      expect(res.data.userId).toBe("new-user-uuid");
      
      // Verify body remains a plain JSON-compatible object (no FormData)
      const callArgs = vi.mocked(requestWithAuth).mock.calls[0][1];
      expect(callArgs?.body).toBe(payload);
      expect(callArgs?.body instanceof FormData).toBe(false);
    });
  });
});
