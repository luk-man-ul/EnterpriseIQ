"use client";

import React, { useState } from "react";
import { documentService } from "../services/document-service";
import { DocumentListItem } from "../types/document-types";
import { ApiError } from "../../../services/api-transport";

interface DeleteDialogProps {
  document: DocumentListItem | null;
  onClose: () => void;
  onDeleteSuccess: () => void;
}

export default function DeleteDialog({
  document,
  onClose,
  onDeleteSuccess,
}: DeleteDialogProps) {
  const [deleting, setDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!document) return null;

  const handleDeleteSubmit = async () => {
    setDeleting(true);
    setErrorMsg(null);

    try {
      await documentService.delete(document.documentId);
      onDeleteSuccess();
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.statusCode === 403) {
          setErrorMsg("You do not have permission to delete this document.");
        } else {
          setErrorMsg(err.message);
        }
      } else {
        setErrorMsg("Unable to delete document. Please try again.");
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
            Confirm Deletion
          </h3>
          <p className="text-xs text-zinc-400 mt-2">
            Are you sure you want to permanently delete{" "}
            <span className="font-semibold text-white break-all">{document.filename}</span>?
            This will remove the file records and all similarity search indexing vectors.
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
