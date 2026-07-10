"use client";

import React, { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../../hooks/use-auth";
import { AdminCapabilityProvider, useAdminCapability } from "../../providers/admin-capability-provider";

function ProtectedLayoutInner({
  children,
}: {
  children: React.ReactNode;
}) {
  const { status, user, logout, initializationError } = useAuth();
  const { isAdministrator } = useAdminCapability();
  const router = useRouter();
  const pathname = usePathname();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Close mobile drawer on Escape key press
  useEffect(() => {
    if (!mobileMenuOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMobileMenuOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [mobileMenuOpen]);

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

  const navLinks = [
    { name: "Overview", href: "/app" },
    { name: "Documents", href: "/app/documents" },
    { name: "Search", href: "/app/search" },
    { name: "Chat", href: "/app/chat" },
  ];

  if (isAdministrator) {
    navLinks.push({ name: "Users", href: "/app/admin/users" });
  }

  const renderSidebar = (onLinkClick?: () => void) => (
    <div className="flex-1 flex flex-col justify-between p-6 bg-zinc-950 border-r border-zinc-800 text-white font-sans h-full">
      <div className="space-y-8">
        {/* Brand */}
        <div className="flex items-center space-x-3">
          <span className="text-xl font-bold tracking-tight">EnterpriseIQ</span>
          <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold px-2 py-0.5 bg-zinc-900 rounded border border-zinc-800">
            Workspace
          </span>
        </div>

        {/* Navigation Links */}
        <nav className="flex flex-col space-y-1.5" aria-label="Sidebar Navigation">
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.name}
                href={link.href}
                onClick={onLinkClick}
                className={`text-xs font-semibold px-4 py-3 rounded-lg border transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-white ${
                  isActive
                    ? "bg-zinc-950 bg-zinc-900 border-zinc-800 text-white"
                    : "border-transparent text-zinc-400 hover:text-white hover:bg-zinc-900/40"
                }`}
              >
                {link.name}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* User and Session Menu */}
      <div className="space-y-4 pt-4 border-t border-zinc-800">
        <div className="flex flex-col space-y-1">
          <span className="text-xs text-zinc-400 font-medium truncate">
            {user?.email}
          </span>
          <span className="text-[10px] text-zinc-500 uppercase font-semibold tracking-wider">
            Active Session
          </span>
        </div>

        <button
          onClick={logout}
          className="w-full text-xs font-semibold text-zinc-400 hover:text-white px-3 py-2.5 rounded-lg border border-zinc-800 hover:border-zinc-700 bg-zinc-900 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          Sign Out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-black text-white font-sans flex flex-col lg:flex-row">
      {/* Alert Header */}
      {initializationError && (
        <div className="fixed top-0 inset-x-0 z-50 bg-red-950/40 border-b border-red-900/50 text-red-400 text-xs px-4 py-2.5 text-center">
          {initializationError === "network"
            ? "Unable to connect to the server. Please try again."
            : "A server error occurred. Please try again later."}
        </div>
      )}

      {/* Mobile Header Bar */}
      <header className="lg:hidden flex items-center justify-between border-b border-zinc-800 bg-zinc-950 px-6 py-4 z-40 shrink-0">
        <div className="flex items-center space-x-3">
          <span className="text-lg font-bold tracking-tight">EnterpriseIQ</span>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-expanded={mobileMenuOpen}
          aria-label="Toggle navigation menu"
          className="text-xs font-semibold text-zinc-400 hover:text-white px-3 py-1.5 rounded-lg border border-zinc-800 hover:border-zinc-700 bg-zinc-900 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          {mobileMenuOpen ? "Close" : "Menu"}
        </button>
      </header>

      {/* Mobile Drawer Overlay */}
      {mobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 flex bg-black/60"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div
            aria-label="Navigation Drawer"
            className="w-64 h-full transform transition-transform"
            onClick={(e) => e.stopPropagation()}
          >
            {renderSidebar(() => setMobileMenuOpen(false))}
          </div>
        </div>
      )}

      {/* Desktop Persistent Sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 z-30 shrink-0">
        {renderSidebar()}
      </aside>

      {/* Layout Content wrapper */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-64">
        <main className="flex-1 flex flex-col min-h-0 min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AdminCapabilityProvider>
      <ProtectedLayoutInner>{children}</ProtectedLayoutInner>
    </AdminCapabilityProvider>
  );
}
