"use client";

import React, { useEffect, useState } from "react";
import { documentService } from "../services/document-service";
import { DocumentDetails as IDocumentDetails } from "../types/document-types";
import { ApiError } from "../../../services/api-transport";

interface DocumentDetailsProps {
  documentId: string | null;
  onClose: () => void;
}

export default function DocumentDetails({
  documentId,
  onClose,
}: DocumentDetailsProps) {
  const [details, setDetails] = useState<IDocumentDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!documentId) {
      Promise.resolve().then(() => {
        setDetails(null);
        setErrorMsg(null);
      });
      return;
    }

    const abortController = new AbortController();
    
    Promise.resolve().then(() => {
      setLoading(true);
      setErrorMsg(null);
      setDetails(null);
    });

    documentService
      .getDetails(documentId, abortController.signal)
      .then((res) => {
        setDetails(res.data);
      })
      .catch((err) => {
        if (err instanceof Error && err.name === "AbortError") {
          return; // Ignore lifecycle cancellations
        }
        if (err instanceof ApiError) {
          setErrorMsg(err.message);
        } else {
          setErrorMsg("Failed to retrieve document metadata.");
        }
      })
      .finally(() => {
        setLoading(false);
      });

    return () => {
      abortController.abort();
    };
  }, [documentId]);

  if (!documentId) return null;

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <div className="w-full lg:w-80 bg-zinc-950 border border-zinc-800 rounded-2xl p-6 flex flex-col space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold tracking-tight text-white">
          Document Details
        </h3>
        <button
          onClick={onClose}
          className="text-xs text-zinc-500 hover:text-white font-medium px-2 py-1 rounded hover:bg-zinc-900 border border-transparent hover:border-zinc-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          Close
        </button>
      </div>

      {loading && (
        <div className="py-12 text-center text-xs text-zinc-500">
          Fetching metadata...
        </div>
      )}

      {errorMsg && (
        <div className="rounded-lg border border-red-900/50 bg-red-950/20 px-4 py-3 text-xs text-red-400">
          {errorMsg}
        </div>
      )}

      {details && (
        <div className="space-y-4 text-xs">
          <div>
            <span className="block text-zinc-500 uppercase tracking-wider font-semibold mb-1">
              Document ID
            </span>
            <span className="block text-white font-mono break-all bg-black px-2 py-1.5 rounded border border-zinc-900 select-all">
              {details.documentId}
            </span>
          </div>

          <div>
            <span className="block text-zinc-500 uppercase tracking-wider font-semibold mb-1">
              Filename
            </span>
            <span className="block text-white font-medium break-all">
              {details.filename}
            </span>
          </div>

          <div>
            <span className="block text-zinc-500 uppercase tracking-wider font-semibold mb-1">
              Status
            </span>
            <span className="block text-white font-medium">
              {details.status}
            </span>
          </div>

          <div>
            <span className="block text-zinc-500 uppercase tracking-wider font-semibold mb-1">
              File Size
            </span>
            <span className="block text-white font-medium">
              {formatBytes(details.fileSize)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
