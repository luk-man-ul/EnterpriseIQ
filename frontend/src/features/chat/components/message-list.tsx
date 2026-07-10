"use client";

import React from "react";
import { ChatMessage, ChatCitation } from "../types/chat-types";
import CitationList from "./citation-list";

interface MessageListProps {
  messages: ChatMessage[];
  currentTurnMessage: string | null;
  currentCitations: ChatCitation[];
  streaming: boolean;
}

export default function MessageList({
  messages,
  currentTurnMessage,
  currentCitations,
  streaming,
}: MessageListProps) {
  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 font-sans text-white min-h-0">
      {messages.length === 0 && !currentTurnMessage && (
        <div className="h-full flex flex-col items-center justify-center text-center p-8 text-zinc-550">
          <p className="text-sm font-semibold">Start a new conversation thread</p>
          <p className="text-xs text-zinc-600 mt-1 max-w-xs leading-relaxed">
            EnterpriseIQ will retrieve authorized document shards to answer queries.
          </p>
        </div>
      )}

      {messages.map((msg) => {
        const isUser = msg.role === "User";
        return (
          <div
            key={msg.id}
            className={`flex flex-col space-y-1.5 max-w-[85%] ${
              isUser ? "ml-auto items-end" : "mr-auto items-start"
            }`}
          >
            {/* Role Header */}
            <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-500 select-none">
              {isUser ? "You" : "EnterpriseIQ"}
            </span>

            {/* Bubble */}
            <div
              className={`rounded-2xl px-5 py-3.5 text-sm font-normal border leading-relaxed break-words whitespace-pre-wrap ${
                isUser
                  ? "bg-zinc-900 border-zinc-800 text-white"
                  : "bg-zinc-950/60 border-zinc-800 text-zinc-300"
              }`}
            >
              {msg.content}
              {!isUser && msg.citations && msg.citations.length > 0 && (
                <CitationList citations={msg.citations} />
              )}
            </div>
          </div>
        );
      })}

      {/* Temporary turning stream bubble */}
      {currentTurnMessage !== null && (
        <div className="flex flex-col space-y-1.5 max-w-[85%] mr-auto items-start">
          <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-500 select-none">
            EnterpriseIQ
          </span>
          <div className="rounded-2xl px-5 py-3.5 text-sm font-normal border leading-relaxed break-words whitespace-pre-wrap bg-zinc-950/60 border-zinc-800 text-zinc-300">
            {currentTurnMessage || (streaming ? "Thinking..." : "")}
            {currentCitations.length > 0 && (
              <CitationList citations={currentCitations} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
