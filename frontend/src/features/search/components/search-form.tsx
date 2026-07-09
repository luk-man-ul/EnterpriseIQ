"use client";

import React, { useState } from "react";
import { SearchRequest } from "../types/search-types";

interface SearchFormProps {
  loading: boolean;
  onSearch: (params: SearchRequest) => void;
}

export default function SearchForm({ loading, onSearch }: SearchFormProps) {
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState<number>(5);
  const [threshold, setThreshold] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      setErrorMsg("Query must not be empty.");
      return;
    }

    if (trimmedQuery.length > 500) {
      setErrorMsg("Query must be under 500 characters.");
      return;
    }

    const payload: SearchRequest = {
      query: trimmedQuery,
      limit: Number(limit),
    };

    if (threshold !== "") {
      const parsedThresh = Number(threshold);
      if (!isNaN(parsedThresh) && parsedThresh >= -1 && parsedThresh <= 1) {
        payload.threshold = parsedThresh;
      }
    }

    onSearch(payload);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl p-6 space-y-4 font-sans text-white"
    >
      <div className="flex flex-col space-y-1.5">
        <label htmlFor="search-query" className="text-xs font-semibold text-zinc-400">
          Query Context
        </label>
        <textarea
          id="search-query"
          placeholder="Enter prompt to execute semantic vector match..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          disabled={loading}
          rows={3}
          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm placeholder-zinc-500 focus:outline-none focus:border-zinc-700 disabled:opacity-50 resize-none focus-visible:ring-2 focus-visible:ring-white"
        />
        <div className="flex justify-between text-[10px] text-zinc-500">
          <span>Max 500 characters</span>
          <span>{query.length}/500</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex flex-col space-y-1.5">
          <label htmlFor="search-limit" className="text-xs font-semibold text-zinc-400">
            Limit Results
          </label>
          <input
            id="search-limit"
            type="number"
            min={1}
            max={100}
            value={limit}
            onChange={(e) => setLimit(Math.max(1, Math.min(100, Number(e.target.value))))}
            disabled={loading}
            className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-zinc-700 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-white"
          />
        </div>

        <div className="flex flex-col space-y-1.5">
          <label htmlFor="search-threshold" className="text-xs font-semibold text-zinc-400">
            Similarity Threshold (Optional, -1 to 1)
          </label>
          <input
            id="search-threshold"
            type="number"
            step="0.05"
            min={-1}
            max={1}
            placeholder="No threshold"
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
            disabled={loading}
            className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-zinc-700 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-white"
          />
        </div>
      </div>

      {errorMsg && (
        <div className="rounded-lg border border-red-900/50 bg-red-950/20 px-4 py-2.5 text-xs text-red-400">
          {errorMsg}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-white text-black py-2.5 text-xs font-semibold hover:bg-zinc-200 disabled:opacity-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        {loading ? "Searching..." : "Search Index"}
      </button>
    </form>
  );
}
