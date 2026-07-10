"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "../../../hooks/use-auth";
import { useAdminCapability } from "../../../providers/admin-capability-provider";
import { documentService } from "../../documents/services/document-service";
import { chatService } from "../../chat/services/chat-service";
import { DocumentListItem } from "../../documents/types/document-types";
import { ChatSession } from "../../chat/types/chat-types";
import { ApiError } from "../../../services/api-transport";

export default function OverviewDashboard() {
  const { user } = useAuth();
  const { roles, loading: rolesLoading } = useAdminCapability();

  // Documents state
  const [documents, setDocuments] = useState<DocumentListItem[]>([]);
  const [docCount, setDocCount] = useState<number>(0);
  const [docsLoading, setDocsLoading] = useState<boolean>(true);
  const [docsError, setDocsError] = useState<string | null>(null);

  // Chat sessions state
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [chatCount, setChatCount] = useState<number>(0);
  const [chatLoading, setChatLoading] = useState<boolean>(true);
  const [chatError, setChatError] = useState<string | null>(null);

  const loadDocuments = useCallback((signal: AbortSignal) => {
    documentService.list({ page: 1, limit: 3 }, signal)
      .then((res) => {
        if (!signal.aborted) {
          setDocuments(res.data.documents || []);
          setDocCount(res.data.pagination?.totalCount || 0);
          setDocsLoading(false);
        }
      })
      .catch((err) => {
        if (err instanceof Error && err.name === "AbortError") {
          return;
        }
        if (!signal.aborted) {
          if (err instanceof ApiError) {
            setDocsError(err.message);
          } else {
            setDocsError("Failed to fetch documents. Please try again.");
          }
          setDocsLoading(false);
        }
      });
  }, []);

  const loadChatSessions = useCallback((signal: AbortSignal) => {
    chatService.list(signal)
      .then((res) => {
        if (!signal.aborted) {
          const sessionList = res.data || [];
          setSessions(sessionList);
          setChatCount(sessionList.length);
          setChatLoading(false);
        }
      })
      .catch((err) => {
        if (err instanceof Error && err.name === "AbortError") {
          return;
        }
        if (!signal.aborted) {
          if (err instanceof ApiError) {
            setChatError(err.message);
          } else {
            setChatError("Failed to fetch chat sessions. Please try again.");
          }
          setChatLoading(false);
        }
      });
  }, []);

  // Fetch documents lifecycle
  useEffect(() => {
    const controller = new AbortController();
    loadDocuments(controller.signal);
    return () => {
      controller.abort();
    };
  }, [loadDocuments]);

  // Fetch chat sessions lifecycle
  useEffect(() => {
    const controller = new AbortController();
    loadChatSessions(controller.signal);
    return () => {
      controller.abort();
    };
  }, [loadChatSessions]);

  const handleDocsRetry = () => {
    setDocsLoading(true);
    setDocsError(null);
    const controller = new AbortController();
    loadDocuments(controller.signal);
  };

  const handleChatRetry = () => {
    setChatLoading(true);
    setChatError(null);
    const controller = new AbortController();
    loadChatSessions(controller.signal);
  };

  // Safe role name lookup from cache
  const matchedRole = user?.roleId ? roles.find((r) => r.roleId === user.roleId) : null;
  const roleName = matchedRole?.name;

  const formatDate = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return isoString;
    }
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case "Completed":
        return "bg-green-950/40 text-green-400 border-green-900/50";
      case "Processing":
        return "bg-blue-950/40 text-blue-400 border-blue-900/50";
      case "Failed":
        return "bg-red-950/40 text-red-400 border-red-900/50";
      case "Pending":
      default:
        return "bg-zinc-900 text-zinc-400 border-zinc-800";
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-8 bg-black text-white font-sans">
      {/* Personalized Welcome Card */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 sm:p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-6">
          {!rolesLoading && roleName && (
            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 bg-zinc-900 border border-zinc-800 px-2.5 py-1 rounded-full">
              {roleName}
            </span>
          )}
        </div>
        <div className="max-w-2xl space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Welcome back, {user?.firstName || "User"}
          </h1>
          <p className="text-sm text-zinc-400 leading-relaxed">
            Search organizational knowledge, explore authorized documents, and continue AI-assisted conversations from one workspace.
          </p>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Metric: Authorized Documents */}
        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 flex flex-col justify-between min-h-[140px]">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Authorized Documents
          </span>
          {docsLoading ? (
            <div className="h-9 w-24 bg-zinc-900 rounded animate-pulse mt-2" />
          ) : docsError ? (
            <span className="text-sm text-red-400 mt-2">Unavailable</span>
          ) : (
            <span className="text-3xl sm:text-4xl font-bold tracking-tight text-white mt-2">
              {docCount}
            </span>
          )}
          <span className="text-[10px] text-zinc-500 mt-2">
            Documents visible under your department scope
          </span>
        </div>

        {/* Metric: Saved Conversations */}
        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 flex flex-col justify-between min-h-[140px]">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Saved Conversations
          </span>
          {chatLoading ? (
            <div className="h-9 w-24 bg-zinc-900 rounded animate-pulse mt-2" />
          ) : chatError ? (
            <span className="text-sm text-red-400 mt-2">Unavailable</span>
          ) : (
            <span className="text-3xl sm:text-4xl font-bold tracking-tight text-white mt-2">
              {chatCount}
            </span>
          )}
          <span className="text-[10px] text-zinc-500 mt-2">
            Your active private chat workspace sessions
          </span>
        </div>
      </div>

      {/* Quick Actions Grid */}
      <div className="space-y-4">
        <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-500">
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Link
            href="/app/documents"
            className="group p-5 bg-zinc-950 hover:bg-zinc-900/40 border border-zinc-800 hover:border-zinc-700 rounded-2xl transition-all space-y-2 text-left"
          >
            <span className="block text-sm font-semibold text-white group-hover:text-zinc-200">
              Browse Documents
            </span>
            <span className="block text-xs text-zinc-500">
              View and manage your department&apos;s file catalog
            </span>
          </Link>
          <Link
            href="/app/search"
            className="group p-5 bg-zinc-950 hover:bg-zinc-900/40 border border-zinc-800 hover:border-zinc-700 rounded-2xl transition-all space-y-2 text-left"
          >
            <span className="block text-sm font-semibold text-white group-hover:text-zinc-200">
              Search Knowledge
            </span>
            <span className="block text-xs text-zinc-500">
              Perform secure permission-aware semantic search
            </span>
          </Link>
          <Link
            href="/app/chat"
            className="group p-5 bg-zinc-950 hover:bg-zinc-900/40 border border-zinc-800 hover:border-zinc-700 rounded-2xl transition-all space-y-2 text-left"
          >
            <span className="block text-sm font-semibold text-white group-hover:text-zinc-200">
              Ask EnterpriseIQ
            </span>
            <span className="block text-xs text-zinc-500">
              Launch conversational AI sessions with source citations
            </span>
          </Link>
        </div>
      </div>

      {/* Recent Activity Sections Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Documents Card */}
        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 flex flex-col min-h-[300px]">
          <div className="flex items-center justify-between pb-4 border-b border-zinc-900 mb-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400">
              Recent Documents
            </h3>
            <Link
              href="/app/documents"
              className="text-xs text-zinc-500 hover:text-white transition-colors"
            >
              View All
            </Link>
          </div>

          <div className="flex-1 flex flex-col justify-center">
            {docsLoading ? (
              <div className="space-y-4">
                <div className="h-12 w-full bg-zinc-900 rounded animate-pulse" />
                <div className="h-12 w-full bg-zinc-900 rounded animate-pulse" />
                <div className="h-12 w-full bg-zinc-900 rounded animate-pulse" />
              </div>
            ) : docsError ? (
              <div className="text-center py-6 space-y-3">
                <p className="text-xs text-zinc-500">{docsError}</p>
                <button
                  onClick={handleDocsRetry}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-white transition-colors"
                >
                  Retry
                </button>
              </div>
            ) : documents.length === 0 ? (
              <p className="text-xs text-center text-zinc-500 py-6">
                No recent documents found.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="text-zinc-500 font-semibold border-b border-zinc-900/60 uppercase">
                      <th className="pb-3 pr-4">Filename</th>
                      <th className="pb-3 pr-4 hidden sm:table-cell">Uploaded</th>
                      <th className="pb-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-900/40 text-sm">
                    {documents.map((doc) => (
                      <tr key={doc.documentId} className="text-white hover:bg-zinc-900/10">
                        <td className="py-3 pr-4 font-medium max-w-[150px] sm:max-w-xs truncate">
                          {doc.filename}
                        </td>
                        <td className="py-3 pr-4 hidden sm:table-cell text-xs text-zinc-500 whitespace-nowrap">
                          {formatDate(doc.createdAt)}
                        </td>
                        <td className="py-3 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${getStatusStyle(
                              doc.status
                            )}`}
                          >
                            {doc.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Recent Conversations Card */}
        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 flex flex-col min-h-[300px]">
          <div className="flex items-center justify-between pb-4 border-b border-zinc-900 mb-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400">
              Recent Conversations
            </h3>
            <Link
              href="/app/chat"
              className="text-xs text-zinc-500 hover:text-white transition-colors"
            >
              View All
            </Link>
          </div>

          <div className="flex-1 flex flex-col justify-center">
            {chatLoading ? (
              <div className="space-y-4">
                <div className="h-12 w-full bg-zinc-900 rounded animate-pulse" />
                <div className="h-12 w-full bg-zinc-900 rounded animate-pulse" />
                <div className="h-12 w-full bg-zinc-900 rounded animate-pulse" />
              </div>
            ) : chatError ? (
              <div className="text-center py-6 space-y-3">
                <p className="text-xs text-zinc-500">{chatError}</p>
                <button
                  onClick={handleChatRetry}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-white transition-colors"
                >
                  Retry
                </button>
              </div>
            ) : sessions.length === 0 ? (
              <p className="text-xs text-center text-zinc-500 py-6">
                No recent conversations found.
              </p>
            ) : (
              <div className="divide-y divide-zinc-900/60">
                {sessions.slice(0, 3).map((session) => (
                  <div
                    key={session.chatSessionId}
                    className="py-3.5 flex items-center justify-between hover:bg-zinc-900/10"
                  >
                    <div className="space-y-0.5 truncate max-w-[70%]">
                      <span className="block text-sm font-medium text-white truncate">
                        {session.title || "Untitled Session"}
                      </span>
                      <span className="block text-[10px] text-zinc-500">
                        {formatDate(session.createdAt)}
                      </span>
                    </div>
                    <Link
                      href="/app/chat"
                      className="text-[10px] font-semibold text-zinc-400 hover:text-white px-2 py-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 rounded transition-colors"
                    >
                      Open
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
