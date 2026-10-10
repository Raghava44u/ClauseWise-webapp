"use client";

import React, { useState, useRef } from "react";
import { DocumentItem } from "@/lib/types";
import { uploadDocument } from "@/lib/api";
import { formatBytes } from "@/lib/utils";
import {
  Upload,
  X,
  FileText,
  AlertCircle,
  Loader2,
  CheckCircle2,
  FileCheck
} from "lucide-react";

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadSuccess: (newDoc: DocumentItem) => void;
}

export const UploadModal: React.FC<UploadModalProps> = ({
  isOpen,
  onClose,
  onUploadSuccess,
}) => {
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileValidation = (file: File) => {
    setError(null);
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext !== "pdf" && ext !== "docx") {
      setError("Unsupported file format. Please upload a PDF (.pdf) or Word (.docx) contract.");
      setSelectedFile(null);
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      setError(`File size (${formatBytes(file.size)}) exceeds the 50 MB limit.`);
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileValidation(e.dataTransfer.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    setUploading(true);
    setError(null);

    try {
      const doc = await uploadDocument(selectedFile);
      onUploadSuccess(doc);
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to process contract");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 relative animate-in fade-in zoom-in-95 duration-150">
        <button
          onClick={onClose}
          disabled={uploading}
          className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 p-1 rounded-md"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="mb-4">
          <h3 className="text-base font-bold text-slate-900">
            Upload Legal Contract
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            PDF or DOCX documents up to 150 pages / 50 MB. Scanned pages are processed with PaddleOCR.
          </p>
        </div>

        {/* Drag & Drop Area */}
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
            dragActive
              ? "border-navy-600 bg-navy-50/50"
              : "border-slate-300 hover:border-navy-500 hover:bg-slate-50"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleFileValidation(e.target.files[0]);
              }
            }}
            className="hidden"
          />

          <div className="flex flex-col items-center gap-2">
            <div className="w-12 h-12 rounded-full bg-navy-50 text-navy-700 flex items-center justify-center">
              <Upload className="w-6 h-6 text-navy-800" />
            </div>
            <p className="text-xs font-semibold text-slate-700">
              Drag contract file here, or <span className="text-navy-700 underline">browse</span>
            </p>
            <p className="text-[11px] text-slate-400">
              Supports .pdf and .docx contracts
            </p>
          </div>
        </div>

        {/* Selected File Details */}
        {selectedFile && (
          <div className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <FileCheck className="w-5 h-5 text-emerald-600 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-800 truncate">
                  {selectedFile.name}
                </p>
                <p className="text-[10px] text-slate-400">
                  {formatBytes(selectedFile.size)}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedFile(null);
              }}
              className="text-slate-400 hover:text-slate-600 text-xs p-1"
            >
              Change
            </button>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="mt-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-6 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={uploading}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleUpload}
            disabled={!selectedFile || uploading}
            className="flex items-center gap-1.5 px-5 py-2 bg-navy-800 hover:bg-navy-900 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
          >
            {uploading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Extracting & Indexing...</span>
              </>
            ) : (
              <span>Process Contract</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
