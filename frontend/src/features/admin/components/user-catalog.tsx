"use client";

import React, { useEffect, useState } from "react";
import { adminService } from "../services/admin-service";
import { useAdminCapability } from "../../../providers/admin-capability-provider";
import { AdminUserListItem, DepartmentLookupItem } from "../types/admin-types";
import { ApiError } from "../../../services/api-transport";
import { CreateUserDialog } from "./create-user-dialog";

export function UserCatalog() {
  const { roles } = useAdminCapability();
  const [users, setUsers] = useState<AdminUserListItem[]>([]);
  const [departments, setDepartments] = useState<DepartmentLookupItem[]>([]);
  const [departmentsError, setDepartmentsError] = useState(false);

  const [loading, setLoading] = useState(true);
  const [errorState, setErrorState] = useState<{
    type: "none" | "forbidden" | "network" | "server" | "generic";
    message: string;
  }>({ type: "none", message: "" });

  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [totalCount, setTotalCount] = useState(0);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  // Fetch departments once on mount
  useEffect(() => {
    const controller = new AbortController();
    Promise.resolve().then(() => {
      setDepartmentsError(false);
    });

    adminService.listDepartments(controller.signal)
      .then((res) => {
        setDepartments(res.data || []);
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        console.error("Failed to load departments lookup:", err);
        setDepartmentsError(true);
      });

    return () => {
      controller.abort();
    };
  }, []);

  // Fetch users when page or refreshTrigger changes
  useEffect(() => {
    const controller = new AbortController();
    Promise.resolve().then(() => {
      setLoading(true);
      setErrorState({ type: "none", message: "" });
    });

    adminService.listUsers({ page, limit }, controller.signal)
      .then((res) => {
        if (res.data) {
          setUsers(res.data.users || []);
          setTotalCount(res.data.pagination?.totalCount || 0);
        }
        setLoading(false);
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        
        console.error("Failed to load user list:", err);
        setLoading(false);
        setUsers([]);

        if (err instanceof ApiError) {
          if (err.statusCode === 403) {
            setErrorState({
              type: "forbidden",
              message: "Administrator privileges are required to manage users.",
            });
            return;
          }
          if (err.statusCode >= 500) {
            setErrorState({
              type: "server",
              message: "A server error occurred. Please try again later.",
            });
            return;
          }
        }

        if (err instanceof TypeError) {
          setErrorState({
            type: "network",
            message: "Unable to connect to the server. Please check your connection and try again.",
          });
          return;
        }

        setErrorState({
          type: "generic",
          message: "An unexpected error occurred while retrieving users.",
        });
      });

    return () => {
      controller.abort();
    };
  }, [page, limit, refreshTrigger]);

  // Handle success message auto-clear and cleanup
  useEffect(() => {
    if (!successMessage) return;

    const timer = setTimeout(() => {
      setSuccessMessage("");
    }, 4000);

    return () => clearTimeout(timer);
  }, [successMessage]);

  const handlePrev = () => {
    if (page > 1) {
      setPage((p) => p - 1);
    }
  };

  const handleNext = () => {
    if (page * limit < totalCount) {
      setPage((p) => p + 1);
    }
  };

  const handleCreateClose = (success: boolean) => {
    setIsCreateOpen(false);

    if (!success) {
      return;
    }

    setSuccessMessage("User created successfully.");

    if (page === 1) {
      setRefreshTrigger((current) => current + 1);
    } else {
      setPage(1);
    }
  };

  const getRoleLabel = (roleId: string) => {
    const role = roles.find((r) => r.roleId === roleId);
    return role ? role.name : "Unknown role";
  };

  const getDepartmentLabel = (deptId: string) => {
    const dept = departments.find((d) => d.departmentId === deptId);
    return dept ? dept.name : "Unknown department";
  };

  if (errorState.type === "forbidden") {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-zinc-950/40 rounded-xl border border-zinc-900 min-h-[300px]">
        <p className="text-sm font-semibold text-red-400 mb-2">Access Denied</p>
        <p className="text-xs text-zinc-400 text-center">{errorState.message}</p>
      </div>
    );
  }

  if (errorState.type !== "none") {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-zinc-950/40 rounded-xl border border-zinc-900 min-h-[300px]">
        <p className="text-sm font-semibold text-red-400 mb-2">Error loading users</p>
        <p className="text-xs text-zinc-400 text-center mb-4">{errorState.message}</p>
        <button
          onClick={() => setPage(page)}
          className="text-xs font-semibold px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg hover:bg-zinc-850 hover:text-white transition-colors"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-white">Users Catalog</h2>
          <p className="text-xs text-zinc-400">Manage corporate users, assign roles, and set departments.</p>
        </div>
        <div>
          <button
            onClick={() => setIsCreateOpen(true)}
            className="text-xs font-semibold px-4 py-2.5 bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white rounded-lg hover:border-zinc-700 bg-zinc-900 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white cursor-pointer"
          >
            Create User
          </button>
        </div>
      </div>

      {/* Success Notification Banner */}
      {successMessage && (
        <div className="p-3 bg-green-950/30 border border-green-900/50 rounded-lg text-[11px] text-green-400 font-medium">
          {successMessage}
        </div>
      )}

      {/* Degradation Warning Banner */}
      {departmentsError && (
        <div className="p-3 bg-yellow-950/30 border border-yellow-900/50 rounded-lg text-[11px] text-yellow-500">
          Warning: Department metadata lookup failed. Users list remains active, but department names are degraded to fallbacks.
        </div>
      )}

      {/* Catalog Table */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden min-h-[250px] flex flex-col justify-between">
        {loading ? (
          <div className="flex-1 flex items-center justify-center py-20">
            <p className="text-xs text-zinc-400 animate-pulse">Loading catalog entries...</p>
          </div>
        ) : users.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-20">
            <p className="text-xs font-medium text-zinc-400">No users found</p>
            <p className="text-[10px] text-zinc-500 mt-1">Seeded or newly created users will appear here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900/50">
                  <th className="px-6 py-3.5 text-[10px] font-bold uppercase tracking-wider text-zinc-400">Name</th>
                  <th className="px-6 py-3.5 text-[10px] font-bold uppercase tracking-wider text-zinc-400">Email</th>
                  <th className="px-6 py-3.5 text-[10px] font-bold uppercase tracking-wider text-zinc-400">Role</th>
                  <th className="px-6 py-3.5 text-[10px] font-bold uppercase tracking-wider text-zinc-400">Department</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900">
                {users.map((item) => (
                  <tr key={item.userId} className="hover:bg-zinc-900/30 transition-colors">
                    <td className="px-6 py-4 text-xs font-medium text-white">
                      {item.firstName} {item.lastName}
                    </td>
                    <td className="px-6 py-4 text-xs text-zinc-400">{item.email}</td>
                    <td className="px-6 py-4 text-xs">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-zinc-900 border border-zinc-800 text-zinc-400">
                        {getRoleLabel(item.roleId)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-zinc-400">
                      {getDepartmentLabel(item.departmentId)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer Pagination */}
        {totalCount > 0 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-800 bg-zinc-900/20 text-xs">
            <span className="text-zinc-500 text-[10px]">
              Showing page {page} of {Math.ceil(totalCount / limit)} ({totalCount} users total)
            </span>
            <div className="flex items-center space-x-2">
              <button
                onClick={handlePrev}
                disabled={page <= 1 || loading}
                className="px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg hover:text-white hover:bg-zinc-850 transition-colors disabled:opacity-40 disabled:hover:text-zinc-400 disabled:hover:bg-zinc-900 cursor-pointer disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={handleNext}
                disabled={page * limit >= totalCount || loading}
                className="px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg hover:text-white hover:bg-zinc-850 transition-colors disabled:opacity-40 disabled:hover:text-zinc-400 disabled:hover:bg-zinc-900 cursor-pointer disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      <CreateUserDialog
        isOpen={isCreateOpen}
        onClose={handleCreateClose}
        departments={departments}
      />
    </div>
  );
}
