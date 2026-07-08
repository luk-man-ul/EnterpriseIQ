"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useAuth } from "../../../hooks/use-auth";
import { documentService } from "../services/document-service";
import { documentCapabilityService } from "../services/document-capability-service";
import {
  DocumentListItem,
  DocumentPagination,
  DocumentCapabilities,
} from "../types/document-types";
import DocumentList from "./document-list";
import UploadZone from "./upload-zone";
import DocumentDetails from "./document-details";
import DeleteDialog from "./delete-dialog";
import { ApiError } from "../../../services/api-transport";

export default function DocumentWorkspace() {
  const { user, status } = useAuth();

  // Catalog state
  const [documents, setDocuments] = useState<DocumentListItem[]>([]);
  const [pagination, setPagination] = useState<DocumentPagination>({
    page: 1,
    limit: 10,
    totalCount: 0,
  });
  const [loading, setLoading] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Selected document context
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);

  // Deletion context
  const [deleteTarget, setDeleteTarget] = useState<DocumentListItem | null>(null);

  // Capabilities resolution
  const [capabilities, setCapabilities] = useState<DocumentCapabilities>({
    canUploadDocuments: false,
    canDeleteDocuments: false,
  });

  const forceRefresh = useCallback(() => {
    setRefreshTrigger((prev) => prev + 1);
  }, []);

  // 1. Resolve role capabilities locally
  useEffect(() => {
    if (status !== "authenticated" || !user) return;

    documentCapabilityService
      .fetchRoles()
      .then((res) => {
        const resolved = documentCapabilityService.resolveCapabilities(
          user.roleId,
          res.data
        );
        setCapabilities(resolved);
      })
      .catch(() => {
        // Recoverable lookup failure: fail-closed to lowest privilege
        setCapabilities({
          canUploadDocuments: false,
          canDeleteDocuments: false,
        });
      });
  }, [status, user]);

  // 2. Fetch documents catalog list
  useEffect(() => {
    if (status !== "authenticated") return;

    const abortController = new AbortController();
    Promise.resolve().then(() => {
      setLoading(true);
      setCatalogError(null);
    });

    documentService
      .list(
        {
          page: pagination.page,
          limit: pagination.limit,
        },
        abortController.signal
      )
      .then((res) => {
        setDocuments(res.data.documents);
        setPagination(res.data.pagination);
      })
      .catch((err) => {
        if (err instanceof Error && err.name === "AbortError") {
          return; // Ignore lifecycle cancellations
        }
        if (err instanceof ApiError) {
          setCatalogError(err.message);
        } else {
          setCatalogError("Unable to connect to the server. Please try again.");
        }
      })
      .finally(() => {
        setLoading(false);
      });

    return () => {
      abortController.abort();
    };
  }, [status, pagination.page, pagination.limit, refreshTrigger]);

  const handlePageChange = (newPage: number) => {
    setPagination((prev) => ({ ...prev, page: newPage }));
  };

  return (
    <div className="flex-1 flex flex-col p-6 space-y-6 bg-black min-h-0">
      {/* Workspace Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white">
            Document Workspace
          </h2>
          <p className="text-xs text-zinc-500 mt-1">
            Access, view metadata, and manage ingestion indexes
          </p>
        </div>
        <button
          onClick={forceRefresh}
          disabled={loading}
          className="text-xs font-semibold text-zinc-400 hover:text-white px-3 py-1.5 rounded-lg border border-zinc-800 hover:border-zinc-700 bg-zinc-900 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          Refresh Catalog
        </button>
      </div>

      {catalogError && (
        <div className="rounded-lg border border-red-900/50 bg-red-950/20 px-4 py-3 text-xs text-red-400">
          {catalogError}
        </div>
      )}

      {/* Main Workspace Workspace Layout */}
      <div className="flex-1 flex flex-col lg:flex-row gap-6 min-h-0">
        <div className="flex-1 flex flex-col min-h-0">
          <DocumentList
            documents={documents}
            pagination={pagination}
            loading={loading}
            selectedId={selectedDocumentId}
            canDelete={capabilities.canDeleteDocuments}
            onSelect={(id) => setSelectedDocumentId(id)}
            onDeleteClick={(doc) => setDeleteTarget(doc)}
            onPageChange={handlePageChange}
          />
        </div>

        {/* Side panels */}
        <div className="w-full lg:w-80 flex flex-col space-y-6 shrink-0">
          {capabilities.canUploadDocuments && (
            <UploadZone onUploadSuccess={forceRefresh} />
          )}

          <DocumentDetails
            documentId={selectedDocumentId}
            onClose={() => setSelectedDocumentId(null)}
          />
        </div>
      </div>

      {/* Pessimistic Delete confirmation modal */}
      <DeleteDialog
        document={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onDeleteSuccess={forceRefresh}
      />
    </div>
  );
}
