"use client";

import React, { useState, useRef } from "react";
import { documentService } from "../services/document-service";
import { validateUploadFile } from "../utils/document-upload-validation";
import { ApiError } from "../../../services/api-transport";

interface UploadZoneProps {
  onUploadSuccess: () => void;
}

export default function UploadZone({ onUploadSuccess }: UploadZoneProps) {
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const processFile = (selectedFile: File) => {
    setErrorMsg(null);
    setSuccessMsg(null);

    const validationError = validateUploadFile(selectedFile);
    if (validationError) {
      setErrorMsg(validationError);
      setFile(null);
      return;
    }

    setFile(selectedFile);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (uploading) return;

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (uploading) return;

    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const triggerFileSelect = () => {
    if (uploading) return;
    fileInputRef.current?.click();
  };

  const handleUploadSubmit = async () => {
    if (!file || uploading) return;

    setUploading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      await documentService.upload(file);
      setSuccessMsg(`Successfully uploaded ${file.name}`);
      setFile(null);
      onUploadSuccess();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.statusCode === 409) {
          setErrorMsg("This document is already uploaded.");
        } else {
          setErrorMsg(err.message);
        }
      } else {
        setErrorMsg("Unable to connect to the server. Please try again.");
      }
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl p-6 flex flex-col space-y-4">
      <div className="flex flex-col">
        <h3 className="text-sm font-semibold tracking-tight text-white">
          Ingest Document
        </h3>
        <p className="text-xs text-zinc-500 mt-1">
          Supported types: PDF, DOCX, TXT (Max 50MB)
        </p>
      </div>

      <div
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={triggerFileSelect}
        className={`relative flex flex-col items-center justify-center border-2 border-dashed rounded-xl py-8 px-4 cursor-pointer text-center transition-all ${
          dragActive
            ? "border-white bg-zinc-900/40"
            : "border-zinc-800 hover:border-zinc-700 bg-zinc-900/10 hover:bg-zinc-900/20"
        } ${uploading ? "opacity-45 pointer-events-none" : ""}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf, application/vnd.openxmlformats-officedocument.wordprocessingml.document, text/plain, .pdf, .docx, .txt"
          onChange={handleFileChange}
          className="hidden"
          disabled={uploading}
        />

        <div className="text-zinc-400 space-y-2">
          <p className="text-xs font-medium">
            {file ? `Selected: ${file.name}` : "Drag and drop file here, or click to browse"}
          </p>
          {!file && (
            <p className="text-[10px] text-zinc-500 font-normal">
              Browser verifies type signatures on upload
            </p>
          )}
        </div>
      </div>

      {errorMsg && (
        <div className="rounded-lg border border-red-900/50 bg-red-950/20 px-4 py-3 text-xs text-red-400">
          {errorMsg}
        </div>
      )}

      {successMsg && (
        <div className="rounded-lg border border-green-900/50 bg-green-950/20 px-4 py-3 text-xs text-green-400">
          {successMsg}
        </div>
      )}

      {file && (
        <div className="flex items-center space-x-2">
          <button
            onClick={handleUploadSubmit}
            disabled={uploading}
            className="flex-1 rounded-lg bg-white text-black py-2.5 text-xs font-semibold hover:bg-zinc-200 disabled:opacity-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            {uploading ? "Uploading..." : "Process Upload"}
          </button>
          <button
            onClick={() => {
              setFile(null);
              setErrorMsg(null);
              setSuccessMsg(null);
            }}
            disabled={uploading}
            className="rounded-lg border border-zinc-800 text-zinc-400 hover:text-white px-3 py-2.5 text-xs font-semibold hover:bg-zinc-900 disabled:opacity-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            Clear
          </button>
        </div>
      )}
    </div>
  );
}
