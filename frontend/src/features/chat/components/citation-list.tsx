"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ChatCitation } from "../types/chat-types";

interface CitationListProps {
  citations: ChatCitation[];
}

export default function CitationList({ citations }: CitationListProps) {
  const [selectedCitation, setSelectedCitation] = useState<ChatCitation | null>(null);

  if (!citations || citations.length === 0) return null;

  return (
    <div className="mt-4 pt-3 border-t border-zinc-900/60 font-sans text-xs">
      <span className="block text-zinc-500 font-bold uppercase tracking-wider mb-2 select-none">
        Sources Verified
      </span>
      <div className="flex flex-wrap gap-2">
        {citations.map((c, idx) => {
          const docLabel = `[DOC-${idx + 1}]`;
          return (
            <button
              key={`${c.documentId}-${idx}`}
              onClick={() => setSelectedCitation(selectedCitation === c ? null : c)}
              className="text-left px-2.5 py-1 rounded bg-zinc-900 border border-zinc-800 hover:bg-zinc-800/80 transition-all text-zinc-300 font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              {docLabel} {c.filename} {c.page !== undefined ? `(Page ${c.page})` : ""}
            </button>
          );
        })}
      </div>

      {selectedCitation && (
        <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-900/20 p-3 space-y-1.5 text-[11px] text-zinc-400">
          <div className="flex justify-between border-b border-zinc-900 pb-1">
            <span className="font-semibold text-white">Citation Details</span>
            <button
              onClick={() => setSelectedCitation(null)}
              className="text-zinc-500 hover:text-white transition-colors"
            >
              Hide
            </button>
          </div>
          <div>
            <span className="text-zinc-500">Document ID:</span>{" "}
            <span className="font-mono text-zinc-300 break-all select-all">{selectedCitation.documentId}</span>
          </div>
          <div>
            <span className="text-zinc-500">Filename:</span>{" "}
            <span className="text-zinc-300">{selectedCitation.filename}</span>
          </div>
          {selectedCitation.page !== undefined && (
            <div>
              <span className="text-zinc-500">Source Page:</span>{" "}
              <span className="text-zinc-300">{selectedCitation.page}</span>
            </div>
          )}
          <div className="pt-2 border-t border-zinc-900/60 mt-2">
            <Link
              href={`/app/documents?documentId=${encodeURIComponent(selectedCitation.documentId)}`}
              className="inline-flex items-center text-[10px] font-bold text-zinc-400 hover:text-white transition-colors"
            >
              Open in Documents Workspace →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
