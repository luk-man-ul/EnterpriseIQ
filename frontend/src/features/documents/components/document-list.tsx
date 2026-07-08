"use client";

import React from "react";
import { DocumentListItem, DocumentPagination } from "../types/document-types";

interface DocumentListProps {
  documents: DocumentListItem[];
  pagination: DocumentPagination;
  loading: boolean;
  selectedId: string | null;
  canDelete: boolean;
  onSelect: (id: string) => void;
  onDeleteClick: (doc: DocumentListItem) => void;
  onPageChange: (newPage: number) => void;
}

export default function DocumentList({
  documents,
  pagination,
  loading,
  selectedId,
  canDelete,
  onSelect,
  onDeleteClick,
  onPageChange,
}: DocumentListProps) {
  const { page, limit, totalCount } = pagination;
  const totalPages = Math.max(1, Math.ceil(totalCount / limit));

  const formatDate = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return isoString;
    }
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case "Completed":
        return "bg-green-950/40 text-green-400 border-green-900/50";
      case "Processing":
        return "bg-blue-950/40 text-blue-400 border-blue-900/50";
      case "Failed":
        return "bg-red-950/40 text-red-400 border-red-900/50";
      case "Pending":
      default:
        return "bg-zinc-900 text-zinc-400 border-zinc-800";
    }
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden">
      <div className="flex-1 overflow-x-auto min-h-0">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900/50 text-xs font-semibold uppercase tracking-wider text-zinc-400">
              <th className="px-6 py-4">Filename</th>
              <th className="px-6 py-4 hidden sm:table-cell">Date Uploaded</th>
              <th className="px-6 py-4">Status</th>
              {canDelete && <th className="px-6 py-4 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/50 text-sm">
            {documents.length === 0 ? (
              <tr>
                <td
                  colSpan={canDelete ? 4 : 3}
                  className="px-6 py-12 text-center text-zinc-500"
                >
                  {loading ? "Loading documents..." : "No documents cataloged in this department."}
                </td>
              </tr>
            ) : (
              documents.map((doc) => {
                const isSelected = selectedId === doc.documentId;
                return (
                  <tr
                    key={doc.documentId}
                    onClick={() => onSelect(doc.documentId)}
                    className={`cursor-pointer transition-colors hover:bg-zinc-900/40 ${
                      isSelected ? "bg-zinc-900/60" : ""
                    }`}
                  >
                    <td className="px-6 py-4 font-medium text-white truncate max-w-[200px] sm:max-w-xs">
                      {doc.filename}
                    </td>
                    <td className="px-6 py-4 hidden sm:table-cell text-zinc-400 whitespace-nowrap">
                      {formatDate(doc.createdAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusStyle(
                          doc.status
                        )}`}
                      >
                        {doc.status}
                      </span>
                    </td>
                    {canDelete && (
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteClick(doc);
                          }}
                          className="text-xs font-semibold text-zinc-500 hover:text-red-400 transition-colors px-2.5 py-1 rounded hover:bg-red-950/20 border border-transparent hover:border-red-900/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                        >
                          Delete
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="border-t border-zinc-800 bg-zinc-900/20 px-6 py-4 flex items-center justify-between">
        <span className="text-xs text-zinc-500">
          Showing {documents.length} of {totalCount} documents
        </span>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1 || loading}
            className="text-xs font-semibold text-zinc-400 hover:text-white px-3 py-1.5 rounded-lg border border-zinc-850 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-30 disabled:pointer-events-none transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            Previous
          </button>
          <span className="text-xs text-zinc-400 font-medium px-2">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages || loading}
            className="text-xs font-semibold text-zinc-400 hover:text-white px-3 py-1.5 rounded-lg border border-zinc-850 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-30 disabled:pointer-events-none transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
