"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../../hooks/use-auth";
import { ApiError } from "../../../services/api-transport";

export default function LoginForm() {
  const { user, status, login } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [validationError, setValidationError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // If already authenticated, redirect to protected landing
  useEffect(() => {
    if (status === "authenticated" && user) {
      router.replace("/app");
    }
  }, [status, user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    setApiError(null);

    // Basic client validation
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setValidationError("Email is required.");
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setValidationError("Please enter a valid email address.");
      return;
    }
    if (!password) {
      setValidationError("Password is required.");
      return;
    }

    setLoading(true);
    try {
      await login({ email: trimmedEmail, password });
      router.replace("/app");
    } catch (err) {
      if (err instanceof ApiError) {
        setApiError(err.message);
      } else {
        setApiError("Unable to connect to the server. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  if (status === "initializing") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-white font-sans">
        <div className="text-center">
          <p className="text-lg text-zinc-400">Loading EnterpriseIQ...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-black px-4 font-sans text-white">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 px-8 py-10 shadow-2xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-white mb-2">
            EnterpriseIQ
          </h1>
          <p className="text-sm text-zinc-400">Sign in to your account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label
              htmlFor="email"
              className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2"
            >
              Email Address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
              disabled={loading}
              className="w-full rounded-lg border border-zinc-800 bg-black px-4 py-3 text-sm text-white placeholder-zinc-600 focus:border-zinc-500 focus:outline-none disabled:opacity-50"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              disabled={loading}
              className="w-full rounded-lg border border-zinc-800 bg-black px-4 py-3 text-sm text-white placeholder-zinc-600 focus:border-zinc-500 focus:outline-none disabled:opacity-50"
            />
          </div>

          {validationError && (
            <div className="rounded-lg border border-red-900/50 bg-red-950/20 px-4 py-3 text-xs text-red-400">
              {validationError}
            </div>
          )}

          {apiError && (
            <div className="rounded-lg border border-red-900/50 bg-red-950/20 px-4 py-3 text-xs text-red-400">
              {apiError}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-white py-3 text-sm font-semibold text-black transition-colors hover:bg-zinc-200 disabled:opacity-50"
          >
            {loading ? "Signing In..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
