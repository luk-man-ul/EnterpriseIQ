"use client";

import React from "react";
import { ChatSession } from "../types/chat-types";

interface SessionListProps {
  sessions: ChatSession[];
  activeId: string | null;
  loading: boolean;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  onDeleteClick: (session: ChatSession) => void;
}

export default function SessionList({
  sessions,
  activeId,
  loading,
  onSelect,
  onNewChat,
  onDeleteClick,
}: SessionListProps) {
  const formatDate = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl p-4 flex flex-col space-y-4 font-sans text-white h-full min-h-0">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500">
          Chat Sessions
        </h3>
        <button
          onClick={onNewChat}
          className="text-xs font-semibold text-white bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 px-2.5 py-1.5 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          New Chat
        </button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 min-h-0">
        {sessions.length === 0 ? (
          <div className="text-center py-8 text-zinc-650 text-xs">
            {loading ? "Loading sessions..." : "No sessions recorded."}
          </div>
        ) : (
          sessions.map((session) => {
            const isSelected = activeId === session.chatSessionId;
            return (
              <div
                key={session.chatSessionId}
                onClick={() => onSelect(session.chatSessionId)}
                className={`group flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer border transition-all ${
                  isSelected
                    ? "bg-zinc-900 border-zinc-850 text-white"
                    : "border-transparent hover:bg-zinc-900/40 text-zinc-400 hover:text-white"
                }`}
              >
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-xs font-semibold truncate">
                    {session.title || "Untitled Session"}
                  </span>
                  <span className="text-[10px] text-zinc-500 mt-0.5">
                    {formatDate(session.createdAt)}
                  </span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteClick(session);
                  }}
                  className="opacity-0 group-hover:opacity-100 focus:opacity-100 text-[10px] font-semibold text-zinc-500 hover:text-red-400 hover:bg-red-950/20 border border-transparent hover:border-red-900/40 px-2 py-1 rounded transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                >
                  Delete
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
