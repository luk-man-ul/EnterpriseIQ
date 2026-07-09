"use client";

import React from "react";
import { useAdminCapability } from "../../../../../providers/admin-capability-provider";
import { UserCatalog } from "../../../../../features/admin/components/user-catalog";

export default function AdminUsersPage() {
  const { isAdministrator, loading, error } = useAdminCapability();

  if (loading) {
    return (
      <div className="flex-grow flex items-center justify-center p-8">
        <p className="text-xs text-zinc-400 animate-pulse font-medium">Verifying administrator permissions...</p>
      </div>
    );
  }

  if (error || !isAdministrator) {
    return (
      <div className="flex-grow flex items-center justify-center p-8">
        <div className="max-w-md w-full text-center p-8 bg-zinc-950/40 rounded-xl border border-zinc-900">
          <p className="text-sm font-semibold text-red-400 mb-2">Access Denied</p>
          <p className="text-xs text-zinc-400">
            Administrator privileges are required to manage users and access this workspace.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-grow p-6 space-y-6">
      <UserCatalog />
    </div>
  );
}
