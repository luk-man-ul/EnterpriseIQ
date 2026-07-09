"use client";

import React, { useState } from "react";
import { chatService } from "../services/chat-service";
import { ChatSession } from "../types/chat-types";
import { ApiError } from "../../../services/api-transport";

interface DeleteSessionDialogProps {
  session: ChatSession | null;
  onClose: () => void;
  onDeleteSuccess: () => void;
}

export default function DeleteSessionDialog({
  session,
  onClose,
  onDeleteSuccess,
}: DeleteSessionDialogProps) {
  const [deleting, setDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!session) return null;

  const handleDeleteSubmit = async () => {
    setDeleting(true);
    setErrorMsg(null);

    try {
      await chatService.deleteSession(session.chatSessionId);
      onDeleteSuccess();
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg("Unable to delete session. Please try again.");
      }
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 font-sans text-white">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 px-6 py-6 shadow-2xl space-y-6">
        <div>
          <h3 className="text-base font-semibold tracking-tight text-white">
            Delete Chat Session
          </h3>
          <p className="text-xs text-zinc-400 mt-2">
            Are you sure you want to permanently delete this chat thread?
            This will remove all stored user and assistant messages for{" "}
            <span className="font-semibold text-white break-all">&quot;{session.title || "Untitled Session"}&quot;</span>.
          </p>
        </div>

        {errorMsg && (
          <div className="rounded-lg border border-red-900/50 bg-red-950/20 px-4 py-2.5 text-xs text-red-400">
            {errorMsg}
          </div>
        )}

        <div className="flex items-center justify-end space-x-2">
          <button
            onClick={onClose}
            disabled={deleting}
            className="rounded-lg border border-zinc-800 text-zinc-400 hover:text-white px-4 py-2 text-xs font-semibold hover:bg-zinc-900 disabled:opacity-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            Cancel
          </button>
          <button
            onClick={handleDeleteSubmit}
            disabled={deleting}
            className="rounded-lg bg-red-650 hover:bg-red-750 text-white px-4 py-2 text-xs font-semibold disabled:opacity-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
          >
            {deleting ? "Deleting..." : "Confirm Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}
