"use client";

import React, { useState, useRef, useEffect } from "react";
import { DocumentItem } from "@/lib/types";
import { uploadDocument } from "@/lib/api";
import { formatBytes } from "@/lib/utils";
import {
  Upload,
  X,
  AlertCircle,
  Loader2,
  CheckCircle2,
  FileCheck,
  Cpu,
  Sparkles
} from "lucide-react";

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadSuccess: (newDoc: DocumentItem) => void;
}

const PROCESSING_STAGES = [
  { id: 1, label: "Validating Document Format", detail: "PDF / DOCX structure and integrity" },
  { id: 2, label: "PaddleOCR & Text Extraction", detail: "Scanned and digital text capture" },
  { id: 3, label: "Character Offset Indexing", detail: "Verifiable byte spans and positions" },
  { id: 4, label: "Lexical Vector Ingestion", detail: "BM25 keyword search index" },
  { id: 5, label: "Neural Clause Risk Graph", detail: "Contract structure and section boundary mapping" },
];

export const UploadModal: React.FC<UploadModalProps> = ({
  isOpen,
  onClose,
  onUploadSuccess,
}) => {
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);
  const [currentStageIndex, setCurrentStageIndex] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (uploading) {
      setCurrentStageIndex(0);
      interval = setInterval(() => {
        setCurrentStageIndex((prev) => {
          if (prev < PROCESSING_STAGES.length - 1) {
            return prev + 1;
          }
          return prev;
        });
      }, 900);
    } else {
      setCurrentStageIndex(0);
    }
    return () => clearInterval(interval);
  }, [uploading]);

  if (!isOpen) return null;

  const handleFileValidation = (file: File) => {
    setError(null);
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext !== "pdf" && ext !== "docx") {
      setError("Unsupported format. Please upload a PDF (.pdf) or Word (.docx) contract.");
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
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-xl relative animate-in fade-in zoom-in-95 duration-150 text-slate-800 overflow-hidden">
        <button
          onClick={onClose}
          disabled={uploading}
          className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 p-1 rounded-md transition-colors disabled:opacity-40 cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="mb-4">
          <h3 className="text-base font-bold text-slate-900 tracking-tight">
            Upload Contract
          </h3>
          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
            Upload PDF or DOCX contracts up to 50 MB. Scanned pages are automatically analyzed with PaddleOCR.
          </p>
        </div>

        {uploading ? (
          /* Clean Animated Processing State */
          <div className="space-y-5 py-1">
            {/* Document sheet with clean emerald scanner line */}
            <div className="relative mx-auto w-52 h-32 rounded-lg bg-slate-50 border border-slate-200 overflow-hidden shadow-2xs p-4 flex flex-col justify-between">
              <div className="scanner-laser-line" />
              
              <div className="space-y-2 opacity-50">
                <div className="h-2 w-24 bg-slate-400 rounded-full" />
                <div className="h-1.5 w-40 bg-slate-300 rounded-full" />
                <div className="h-1.5 w-32 bg-slate-300 rounded-full" />
                <div className="h-1.5 w-36 bg-slate-300 rounded-full" />
              </div>

              <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-500 font-mono">
                <span className="flex items-center gap-1 text-emerald-700 font-semibold">
                  <Cpu className="w-3 h-3 animate-spin text-emerald-600" />
                  <span>EXTRACTING</span>
                </span>
                <span className="truncate max-w-[100px]">{selectedFile?.name}</span>
              </div>
            </div>

            {/* Step-by-step checklist */}
            <div className="space-y-2 bg-slate-50 p-3.5 rounded-lg border border-slate-200 text-xs">
              {PROCESSING_STAGES.map((stage, idx) => {
                const isCompleted = idx < currentStageIndex;
                const isCurrent = idx === currentStageIndex;
                return (
                  <div
                    key={stage.id}
                    className={`flex items-start gap-2.5 transition-colors ${
                      isCompleted
                        ? "text-emerald-800 font-medium"
                        : isCurrent
                        ? "text-slate-900 font-semibold"
                        : "text-slate-400 opacity-60"
                    }`}
                  >
                    <div className="mt-0.5 shrink-0">
                      {isCompleted ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      ) : isCurrent ? (
                        <Loader2 className="w-3.5 h-3.5 text-slate-700 animate-spin" />
                      ) : (
                        <div className="w-3.5 h-3.5 rounded-full border border-slate-300 flex items-center justify-center text-[9px] font-mono text-slate-400">
                          {stage.id}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="leading-tight text-[11px]">{stage.label}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* Normal Drag & Drop Area */
          <div className="space-y-4">
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                dragActive
                  ? "border-emerald-500 bg-emerald-50/50"
                  : "border-slate-300 hover:border-slate-400 bg-slate-50/50 hover:bg-slate-50"
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

              <div className="flex flex-col items-center gap-2.5">
                <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-800">
                    Drag contract here, or <span className="text-emerald-700 underline">browse files</span>
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Supports .pdf and .docx contracts
                  </p>
                </div>
              </div>
            </div>

            {/* Selected File Details */}
            {selectedFile && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                  <FileCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-800 truncate">
                      {selectedFile.name}
                    </p>
                    <p className="text-[10px] text-slate-400 font-mono">
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
                  className="text-slate-400 hover:text-slate-700 text-xs px-2 py-0.5 rounded cursor-pointer"
                >
                  Change
                </button>
              </div>
            )}

            {/* Error Alert */}
            {error && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="mt-5 flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={uploading}
                className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUpload}
                disabled={!selectedFile || uploading}
                className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer disabled:cursor-not-allowed"
              >
                <span>Process Contract</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
