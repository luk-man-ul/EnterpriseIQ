"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { SearchResultItem } from "../types/search-types";
import { handoffStore } from "../../dashboard/utils/handoff-store";

interface SearchResultsProps {
  results: SearchResultItem[];
  searched: boolean;
  lastSubmittedQuery: string;
}

export default function SearchResults({ results, searched, lastSubmittedQuery }: SearchResultsProps) {
  const router = useRouter();
  const [handoffError, setHandoffError] = useState<string | null>(null);

  const handleAskAI = () => {
    setHandoffError(null);
    const res = handoffStore.setMessage(lastSubmittedQuery);
    if (res.accepted) {
      router.push("/app/chat");
    } else {
      if (res.reason === "too_long") {
        setHandoffError("Your search query exceeds the 500-character limit and cannot be sent to the AI.");
      } else {
        setHandoffError("Search query is empty and cannot be sent to the AI.");
      }
    }
  };

  if (!searched) {
    return (
      <div className="w-full text-center py-12 text-zinc-500 text-xs font-sans">
        Submit a query above to retrieve matching segments.
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="w-full text-center py-12 text-zinc-500 text-xs font-sans">
        No semantic matches found matching threshold guidelines.
      </div>
    );
  }

  return (
    <div className="w-full space-y-4 font-sans text-white">
      {handoffError && (
        <div className="rounded-lg border border-red-900/50 bg-red-950/20 px-4 py-2.5 text-xs text-red-400">
          {handoffError}
        </div>
      )}

      <div className="flex items-center justify-between gap-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500">
          Search Results ({results.length})
        </h3>
        <button
          onClick={handleAskAI}
          className="text-xs font-semibold text-zinc-400 hover:text-white px-3 py-1.5 rounded-lg border border-zinc-800 hover:border-zinc-700 bg-zinc-900 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white shrink-0"
        >
          Ask AI about this search
        </button>
      </div>

      <div className="space-y-4">
        {results.map((item, idx) => {
          const scorePercent = (item.similarity * 100).toFixed(1);
          return (
            <div
              key={`${item.documentId}-${item.chunkIndex}-${idx}`}
              className="border border-zinc-800 bg-zinc-950 rounded-2xl p-6 space-y-3"
            >
              {/* Header metrics */}
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs border-b border-zinc-900 pb-2">
                <span className="font-semibold text-white truncate max-w-xs">
                  {item.documentName}
                </span>
                <div className="flex items-center space-x-3 text-zinc-400">
                  <span>Page {item.pageNumber}</span>
                  <span className="px-2.5 py-0.5 rounded-full bg-zinc-900 text-zinc-300 font-semibold border border-zinc-800">
                    Similarity Score: {item.similarity.toFixed(4)} ({scorePercent}%)
                  </span>
                </div>
              </div>

              {/* Snippet body */}
              <div className="whitespace-pre-wrap text-sm text-zinc-300 font-normal leading-relaxed break-words">
                {item.content}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

