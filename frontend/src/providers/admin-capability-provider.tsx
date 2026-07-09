import React, { createContext, useContext, useEffect, useState } from "react";
import { useAuth } from "../hooks/use-auth";
import { requestWithAuth } from "../services/authenticated-request";
import { ApiSuccessResponse } from "../types/api-contracts";

export interface RoleLookupItem {
  roleId: string;
  name: string;
  description: string | null;
}

export interface AdminCapabilityContextType {
  isAdministrator: boolean;
  loading: boolean;
  error: boolean;
  roles: RoleLookupItem[];
}

export const AdminCapabilityContext = createContext<AdminCapabilityContextType>({
  isAdministrator: false,
  loading: true,
  error: false,
  roles: [],
});

export function AdminCapabilityProvider({ children }: { children: React.ReactNode }) {
  const { user, status } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [roles, setRoles] = useState<RoleLookupItem[]>([]);
  const [isAdministrator, setIsAdministrator] = useState(false);

  useEffect(() => {
    if (status !== "authenticated" || !user?.roleId) {
      Promise.resolve().then(() => {
        setIsAdministrator(false);
        setLoading(status === "initializing");
      });
      return;
    }

    let active = true;
    Promise.resolve().then(() => {
      setLoading(true);
      setError(false);
    });

    requestWithAuth<ApiSuccessResponse<RoleLookupItem[]>>("roles", { method: "GET" })
      .then((res) => {
        if (!active) return;
        const rolesList = res.data || [];
        setRoles(rolesList);
        const matched = rolesList.find((r) => r.roleId === user.roleId);
        setIsAdministrator(matched?.name === "Administrator");
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setIsAdministrator(false);
        setError(true);
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [status, user?.roleId]);

  return (
    <AdminCapabilityContext.Provider value={{ isAdministrator, loading, error, roles }}>
      {children}
    </AdminCapabilityContext.Provider>
  );
}

export function useAdminCapability() {
  return useContext(AdminCapabilityContext);
}
