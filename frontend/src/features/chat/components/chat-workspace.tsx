"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { useAuth } from "../../../hooks/use-auth";
import { chatService } from "../services/chat-service";
import { chatStreamService } from "../services/chat-stream-service";
import { SSEParser } from "../utils/sse-parser";
import { ChatSession, ChatMessage, ChatCitation, ChatStreamEvent } from "../types/chat-types";
import SessionList from "./session-list";
import MessageList from "./message-list";
import ChatComposer from "./chat-composer";
import DeleteSessionDialog from "./delete-session-dialog";
import { ApiError } from "../../../services/api-transport";
import { handoffStore } from "../../dashboard/utils/handoff-store";

export default function ChatWorkspace() {
  const { status } = useAuth();

  // Sessions list
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);

  // Active session details
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  // Active turn stream state
  const [streaming, setStreaming] = useState(false);
  const [currentTurnMessage, setCurrentTurnMessage] = useState<string | null>(null);
  const [currentCitations, setCurrentCitations] = useState<ChatCitation[]>([]);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [ariaStatus, setAriaStatus] = useState<string>("idle");

  // Deletion context
  const [deleteTarget, setDeleteTarget] = useState<ChatSession | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  // 1. Fetch sessions on mount/auth success
  const fetchSessionsList = useCallback(async () => {
    setLoadingSessions(true);
    try {
      const res = await chatService.list();
      setSessions(res.data);
    } catch {
      // Quietly suppress REST retrieval error
    } finally {
      setLoadingSessions(false);
    }
  }, []);

  useEffect(() => {
    if (status === "authenticated") {
      Promise.resolve().then(() => {
        fetchSessionsList();
      });
    }
  }, [status, fetchSessionsList]);

  // 2. Fetch session history when active ID changes
  useEffect(() => {
    if (status !== "authenticated" || !activeSessionId) {
      Promise.resolve().then(() => {
        setMessages([]);
        setHistoryError(null);
      });
      return;
    }

    const abortController = new AbortController();
    Promise.resolve().then(() => {
      setLoadingHistory(true);
      setHistoryError(null);
    });

    chatService
      .getHistory(activeSessionId)
      .then((res) => {
        if (!abortController.signal.aborted) {
          setMessages(res.data);
        }
      })
      .catch((err) => {
        if (err instanceof Error && err.name === "AbortError") {
          return;
        }
        if (err instanceof ApiError) {
          setHistoryError(err.message);
        } else {
          setHistoryError("Failed to retrieve chat history.");
        }
      })
      .finally(() => {
        if (!abortController.signal.aborted) {
          setLoadingHistory(false);
        }
      });

    return () => {
      abortController.abort();
    };
  }, [status, activeSessionId]);

  // Cleanup abort controller on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  // 3. Handle message submit (Stream trigger)
  const handleSendMessage = async (content: string, overrideSessionId?: string | null) => {
    // 1. Cancel previous stream if active
    abortControllerRef.current?.abort();
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    // 2. Create optimistic User message
    const tempUserMsg: ChatMessage = {
      id: `temp-user-${Date.now()}`,
      role: "User",
      content,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, tempUserMsg]);
    setStreaming(true);
    setCurrentTurnMessage("");
    setCurrentCitations([]);
    setStreamError(null);
    setAriaStatus("generating");

    let isCompleteReceived = false;
    let newSessionId: string | null = null;

    const finalSessionId = overrideSessionId !== undefined ? overrideSessionId : activeSessionId;

    try {
      const bodyStream = await chatStreamService.connectStream(
        content,
        finalSessionId ?? undefined,
        abortController.signal
      );

      const parser = new SSEParser((event: ChatStreamEvent) => {
        if (abortController.signal.aborted) return;

        if (event.type === "message") {
          setCurrentTurnMessage((prev) => (prev !== null ? prev + event.token : event.token));
        } else if (event.type === "citation") {
          setCurrentCitations((prev) => [...prev, event.citation]);
        } else if (event.type === "complete") {
          isCompleteReceived = true;
          newSessionId = event.chatSessionId;
        } else if (event.type === "error") {
          setStreamError(`Error: ${event.message}`);
          setAriaStatus("interrupted");
        }
      });

      const reader = bodyStream.getReader();

      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done || abortController.signal.aborted) {
            break;
          }
          parser.feed(value);
        }
        parser.flush();
      } finally {
        reader.releaseLock();
      }

      if (abortController.signal.aborted) {
        setAriaStatus("interrupted");
        return;
      }

      // Check wire contract complete policy
      if (!isCompleteReceived) {
        setStreamError("Response stream was interrupted. The displayed response may be incomplete.");
        setAriaStatus("interrupted");
      } else {
        setAriaStatus("complete");
        if (newSessionId) {
          setActiveSessionId(newSessionId);
          fetchSessionsList();
        } else {
          // Re-fetch history for active session to ensure database alignment
          const resolvedSessionId = finalSessionId;
          if (resolvedSessionId) {
            const hist = await chatService.getHistory(resolvedSessionId);
            setMessages(hist.data);
          }
        }
        // Clear active turn states
        setCurrentTurnMessage(null);
        setCurrentCitations([]);
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        setAriaStatus("interrupted");
        return; // Silent on user cancellation
      }

      setAriaStatus("interrupted");
      if (err instanceof ApiError) {
        setStreamError(err.message);
      } else {
        setStreamError("Unable to connect to the server. Please try again.");
      }
    } finally {
      if (abortControllerRef.current === abortController) {
        setStreaming(false);
      }
    }
  };

  const handleNewChat = () => {
    if (streaming) return;
    setActiveSessionId(null);
    setMessages([]);
    setStreamError(null);
    setCurrentTurnMessage(null);
    setCurrentCitations([]);
  };

  // 2b. Auto-consume transient search query handoff
  useEffect(() => {
    if (status !== "authenticated") return;

    const query = handoffStore.consumeMessage();
    if (query) {
      Promise.resolve().then(() => {
        handleNewChat();
        handleSendMessage(query, null);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const handleCancelGeneration = () => {
    abortControllerRef.current?.abort();
    setStreaming(false);
    setAriaStatus("interrupted");
    setStreamError("Stream generation canceled by user.");
  };

  const handleSelectSession = (id: string) => {
    if (streaming) return; // Prevent selection changes during active streams
    setActiveSessionId(id);
  };

  const handleDeleteSuccess = () => {
    fetchSessionsList();
    if (activeSessionId && deleteTarget?.chatSessionId === activeSessionId) {
      setActiveSessionId(null);
      setMessages([]);
    }
  };

  return (
    <div className="flex-1 flex flex-col lg:flex-row p-6 gap-6 bg-black min-h-0">
      {/* Session rail list */}
      <div className="w-full lg:w-64 flex flex-col shrink-0 min-h-0">
        <SessionList
          sessions={sessions}
          activeId={activeSessionId}
          loading={loadingSessions}
          onSelect={handleSelectSession}
          onNewChat={handleNewChat}
          onDeleteClick={(session) => {
            if (streaming && activeSessionId === session.chatSessionId) {
              return; // Prevent deletion of active stream session
            }
            setDeleteTarget(session);
          }}
        />
      </div>

      {/* Messaging Panel */}
      <div className="flex-1 flex flex-col bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden min-h-0 relative">
        {/* Screen Reader Status */}
        <div className="sr-only" aria-live="polite">
          {ariaStatus === "generating" && "Generating AI response..."}
          {ariaStatus === "complete" && "Response complete."}
          {ariaStatus === "interrupted" && "Generation interrupted."}
        </div>

        {/* Message feed */}
        <div className="flex-1 min-h-0 flex flex-col">
          {historyError && (
            <div className="m-4 rounded-lg border border-red-900/50 bg-red-950/20 px-4 py-3 text-xs text-red-400">
              {historyError}
            </div>
          )}

          <MessageList
            messages={messages}
            currentTurnMessage={currentTurnMessage}
            currentCitations={currentCitations}
            streaming={streaming}
          />
        </div>

        {streamError && (
          <div className="mx-6 my-2 rounded-lg border border-red-900/50 bg-red-950/20 px-4 py-2.5 text-xs text-red-400">
            {streamError}
          </div>
        )}

        {/* Active Stream Abort Button */}
        {streaming && (
          <div className="flex justify-center py-2 bg-zinc-950/40">
            <button
              onClick={handleCancelGeneration}
              className="text-xs font-semibold text-zinc-400 hover:text-white px-3 py-1.5 rounded-lg border border-zinc-800 hover:border-zinc-700 bg-zinc-900 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              Stop Generating
            </button>
          </div>
        )}

        {/*Composer */}
        <ChatComposer loading={streaming || loadingHistory} onSend={handleSendMessage} />
      </div>

      {/* Delete Confirmation Dialogue */}
      <DeleteSessionDialog
        session={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onDeleteSuccess={handleDeleteSuccess}
      />
    </div>
  );
}
