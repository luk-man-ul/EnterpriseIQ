"use client";

import React from "react";
import { SearchResultItem } from "../types/search-types";

interface SearchResultsProps {
  results: SearchResultItem[];
  searched: boolean;
}

export default function SearchResults({ results, searched }: SearchResultsProps) {
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
      <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500">
        Search Results ({results.length})
      </h3>

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
