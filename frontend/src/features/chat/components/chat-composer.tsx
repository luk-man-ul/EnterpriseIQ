"use client";

import React, { useState } from "react";

interface ChatComposerProps {
  loading: boolean;
  onSend: (message: string) => void;
}

export default function ChatComposer({ loading, onSend }: ChatComposerProps) {
  const [draft, setDraft] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const trimmed = draft.trim();
    if (!trimmed) {
      setErrorMsg("Message cannot be empty.");
      return;
    }

    if (trimmed.length > 500) {
      setErrorMsg("Message must be under 500 characters.");
      return;
    }

    onSend(trimmed);
    setDraft("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="w-full bg-zinc-950 border-t border-zinc-800 p-4 space-y-3 font-sans text-white">
      <form onSubmit={handleSubmit} className="relative flex items-end gap-3 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3">
        <textarea
          rows={1}
          placeholder="Ask EnterpriseIQ a question..."
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            if (errorMsg) setErrorMsg(null);
          }}
          onKeyDown={handleKeyDown}
          disabled={loading}
          className="flex-1 bg-transparent text-sm placeholder-zinc-500 focus:outline-none disabled:opacity-50 resize-none max-h-32 focus-visible:ring-1 focus-visible:ring-white py-0.5"
        />

        <div className="flex items-center space-x-3 shrink-0">
          <span className="text-[10px] text-zinc-500 font-semibold select-none">
            {draft.length}/500
          </span>
          <button
            type="submit"
            disabled={loading || !draft.trim() || draft.length > 500}
            className="text-xs font-semibold text-black bg-white hover:bg-zinc-200 disabled:opacity-30 disabled:hover:bg-white px-3 py-1.5 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            Send
          </button>
        </div>
      </form>

      {errorMsg && (
        <div className="rounded-lg border border-red-900/50 bg-red-950/20 px-4 py-2 text-xs text-red-400">
          {errorMsg}
        </div>
      )}
    </div>
  );
}
