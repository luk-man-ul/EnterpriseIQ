"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../hooks/use-auth";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { status, logout, initializationError } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [status, router]);

  if (status === "initializing") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-white font-sans">
        <div className="text-center">
          <p className="text-lg text-zinc-400">Loading EnterpriseIQ...</p>
        </div>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return null; // Prevents render flashing during redirects
  }

  return (
    <div className="min-h-screen bg-black text-white font-sans flex flex-col">
      {initializationError && (
        <div className="bg-red-950/40 border-b border-red-900/50 text-red-400 text-xs px-4 py-2.5 text-center">
          {initializationError === "network"
            ? "Unable to connect to the server. Please try again."
            : "A server error occurred. Please try again later."}
        </div>
      )}
      <header className="border-b border-zinc-800 bg-zinc-950 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <span className="text-xl font-bold tracking-tight">EnterpriseIQ</span>
          <span className="text-xs uppercase tracking-widest text-zinc-500 font-semibold px-2 py-0.5 bg-zinc-900 rounded-md">
            Workspace
          </span>
        </div>
        <button
          onClick={logout}
          className="text-xs font-semibold text-zinc-400 hover:text-white px-3 py-1.5 rounded-lg border border-zinc-800 hover:border-zinc-700 bg-zinc-900 transition-colors"
        >
          Sign Out
        </button>
      </header>
      <main className="flex-1 flex flex-col">{children}</main>
    </div>
  );
}
