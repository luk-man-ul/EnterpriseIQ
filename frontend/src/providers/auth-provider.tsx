"use client";

import React, { createContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CurrentUser, LoginRequest } from "../features/auth/types/auth-types";
import { authService } from "../features/auth/services/auth-service";
import { setAccessToken, clearAccessToken } from "../services/auth-token-store";
import { executeRefresh, onSessionExpired } from "../services/auth-refresh";
import { ApiError } from "../services/api-transport";

export interface AuthContextType {
  user: CurrentUser | null;
  status: "initializing" | "authenticated" | "unauthenticated";
  initializationError: "network" | "server" | null;
  login: (credentials: LoginRequest) => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

// File-scoped startup initialization promise to prevent Strict Mode duplicates
let initPromise: Promise<CurrentUser | null> | null = null;

async function initializeSession(): Promise<CurrentUser | null> {
  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    try {
      const token = await executeRefresh();
      const res = await authService.getCurrentUser(token);
      return res.data;
    } catch (err) {
      throw err;
    } finally {
      initPromise = null;
    }
  })();

  return initPromise;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [status, setStatus] = useState<
    "initializing" | "authenticated" | "unauthenticated"
  >("initializing");
  const [initializationError, setInitializationError] = useState<
    "network" | "server" | null
  >(null);

  const router = useRouter();

  useEffect(() => {
    let active = true;

    const unsubscribe = onSessionExpired(() => {
      if (active) {
        setUser(null);
        setStatus("unauthenticated");
      }
    });

    initializeSession()
      .then((profile) => {
        if (active) {
          if (profile) {
            setUser(profile);
            setStatus("authenticated");
            setInitializationError(null);
          } else {
            setUser(null);
            setStatus("unauthenticated");
            setInitializationError(null);
          }
        }
      })
      .catch((err) => {
        if (active) {
          setUser(null);
          setStatus("unauthenticated");

          if (err instanceof ApiError) {
            if (err.statusCode === 401) {
              setInitializationError(null);
            } else if (err.statusCode >= 500) {
              setInitializationError("server");
            } else {
              setInitializationError(null);
            }
          } else if (err instanceof Error && err.name === "AbortError") {
            // Aborted request while provider is active: fail state cleanly
            setInitializationError(null);
          } else {
            // Network TypeErrors (offline)
            setInitializationError("network");
          }
        }
      });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const login = async (credentials: LoginRequest) => {
    try {
      const res = await authService.login(credentials);
      const token = res.data.accessToken;
      setAccessToken(token);

      const userRes = await authService.getCurrentUser(token);
      setUser(userRes.data);
      setStatus("authenticated");
      setInitializationError(null);
    } catch (err) {
      throw err;
    }
  };

  const logout = async () => {
    // 1. Clear access token locally
    clearAccessToken();

    // 2. Clear React user/session state locally
    setUser(null);
    setStatus("unauthenticated");
    setInitializationError(null);

    // 3. Attempt backend logout
    try {
      await authService.logout();
    } catch (err) {
      // 4. Handle failure deliberately without exposing secrets
      console.error(
        "Backend session invalidation request failed:",
        err instanceof Error ? err.message : "Unknown error",
      );
    }

    // 5. Redirect
    router.replace("/login");
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        status,
        initializationError,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
