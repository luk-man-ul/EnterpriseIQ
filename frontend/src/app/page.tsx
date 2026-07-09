"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../hooks/use-auth";
import { handleRootRedirect } from "./root-redirect";

export default function Home() {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    handleRootRedirect(status, (path) => router.replace(path));
  }, [status, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-black text-white font-sans">
      <div className="text-center">
        <p className="text-lg text-zinc-400 font-medium animate-pulse">Loading EnterpriseIQ...</p>
      </div>
    </div>
  );
}
