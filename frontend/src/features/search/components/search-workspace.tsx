"use client";

import React, { useState, useEffect, useRef } from "react";
import SearchForm from "./search-form";
import SearchResults from "./search-results";
import { searchService } from "../services/search-service";
import { SearchRequest, SearchResultItem } from "../types/search-types";
import { ApiError } from "../../../services/api-transport";

export default function SearchWorkspace() {
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const handleSearchSubmit = async (params: SearchRequest) => {
    // Abort ongoing query to prevent race conditions
    abortControllerRef.current?.abort();
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setLoading(true);
    setErrorMsg(null);
    setSearched(false);

    try {
      const res = await searchService.search(params, abortController.signal);
      setResults(res.data.results);
      setSearched(true);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return; // Ignore lifecycle/stale cancellations silently
      }

      if (err instanceof ApiError) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg("Unable to connect to the server. Please try again.");
      }
    } finally {
      if (abortControllerRef.current === abortController) {
        setLoading(false);
      }
    }
  };

  return (
    <div className="flex-1 flex flex-col p-6 space-y-6 bg-black min-h-0 overflow-y-auto">
      {/* Search Header */}
      <div className="border-b border-zinc-800 pb-4">
        <h2 className="text-xl font-bold tracking-tight text-white">
          Knowledge Search
        </h2>
        <p className="text-xs text-zinc-500 mt-1">
          Perform semantic queries across indexed files to match context shards
        </p>
      </div>

      <SearchForm loading={loading} onSearch={handleSearchSubmit} />

      {errorMsg && (
        <div className="rounded-lg border border-red-900/50 bg-red-950/20 px-4 py-3 text-xs text-red-400">
          {errorMsg}
        </div>
      )}

      <SearchResults results={results} searched={searched} />
    </div>
  );
}
