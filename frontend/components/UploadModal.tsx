"use client";

import React, { useState, useRef, useEffect } from "react";
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
  FileCheck,
  Cpu,
  Layers,
  Sparkles,
  ShieldCheck,
  Terminal
} from "lucide-react";

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadSuccess: (newDoc: DocumentItem) => void;
}

const PROCESSING_STAGES = [
  { id: 1, label: "Validating Contract Format & Integrity", detail: "PDF / DOCX structure and sanitization" },
  { id: 2, label: "PaddleOCR & Dual-Engine Text Extraction", detail: "Scanned page optical character recognition" },
  { id: 3, label: "Character Offset Indexing & Segment Mapping", detail: "Deterministic source byte spans" },
  { id: 4, label: "BM25 Lexical Vector Ingestion", detail: "Legal corpus inverted indexing" },
  { id: 5, label: "Constructing Neural Clause Risk Graph", detail: "Structured clause boundaries & metadata" },
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

  // Progressive simulated pipeline steps while waiting for server response
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
      }, 950);
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
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-obsidian-900 border border-obsidian-800 rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200 text-slate-100 overflow-hidden">
        {/* Glow ambient background accent */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        <button
          onClick={onClose}
          disabled={uploading}
          className="absolute right-5 top-5 text-slate-400 hover:text-white p-1 rounded-xl bg-obsidian-800/80 border border-obsidian-700/60 transition-colors disabled:opacity-40"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="mb-5 relative z-10">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-semibold mb-2">
            <Sparkles className="w-3 h-3" />
            <span>AI Neural Legal Ingestion</span>
          </div>
          <h3 className="text-lg font-bold text-white tracking-tight">
            Upload & Analyze Legal Contract
          </h3>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed">
            PDF or DOCX documents up to 200 pages / 50 MB. Scanned pages are automatically analyzed with PaddleOCR, extracting character offsets and verifiable clause indexes.
          </p>
        </div>

        {uploading ? (
          /* High-Tech Animated Processing Radar & Laser Scan */
          <div className="space-y-6 relative z-10 py-2">
            {/* Document Visualizer with Sweeping Laser Scan Line */}
            <div className="relative mx-auto w-56 h-36 rounded-2xl bg-obsidian-950/80 border border-emerald-500/30 overflow-hidden shadow-2xl p-4 flex flex-col justify-between">
              {/* Animated sweeping laser line */}
              <div className="scanner-laser-line" />
              
              {/* Document skeleton lines */}
              <div className="space-y-2 opacity-60">
                <div className="h-2 w-28 bg-emerald-400/40 rounded-full" />
                <div className="h-1.5 w-44 bg-slate-700 rounded-full" />
                <div className="h-1.5 w-36 bg-slate-700 rounded-full" />
                <div className="h-1.5 w-40 bg-slate-700 rounded-full" />
              </div>

              <div className="pt-2 border-t border-obsidian-800 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                <span className="flex items-center gap-1 text-emerald-400">
                  <Cpu className="w-3 h-3 animate-spin" />
                  <span>OCR SCANNING</span>
                </span>
                <span>{selectedFile?.name.slice(0, 14)}...</span>
              </div>
            </div>

            {/* Step-by-step progress checklist */}
            <div className="space-y-2.5 bg-obsidian-950/60 p-4 rounded-2xl border border-obsidian-800/80">
              {PROCESSING_STAGES.map((stage, idx) => {
                const isCompleted = idx < currentStageIndex;
                const isCurrent = idx === currentStageIndex;
                return (
                  <div
                    key={stage.id}
                    className={`flex items-start gap-3 text-xs transition-all duration-300 ${
                      isCompleted
                        ? "text-emerald-300 opacity-90"
                        : isCurrent
                        ? "text-cyan-300 font-semibold"
                        : "text-slate-500 opacity-40"
                    }`}
                  >
                    <div className="mt-0.5 shrink-0">
                      {isCompleted ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : isCurrent ? (
                        <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
                      ) : (
                        <div className="w-4 h-4 rounded-full border border-slate-700 flex items-center justify-center text-[9px] font-mono">
                          {stage.id}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="leading-tight">{stage.label}</p>
                      <p className="text-[10px] text-slate-400 font-normal">{stage.detail}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            <p className="text-center text-[11px] text-slate-400 font-mono animate-pulse">
              Extracting token indexes and character boundary anchors...
            </p>
          </div>
        ) : (
          /* Normal Drag & Drop Upload State */
          <div className="space-y-4 relative z-10">
            {/* Drag & Drop Area */}
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-7 text-center cursor-pointer transition-all ${
                dragActive
                  ? "border-emerald-400 bg-emerald-500/10 shadow-lg shadow-emerald-500/10"
                  : "border-obsidian-700 hover:border-emerald-500/60 hover:bg-obsidian-800/50"
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

              <div className="flex flex-col items-center gap-3">
                <div className="w-13 h-13 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-inner">
                  <Upload className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-white">
                    Drop your contract here, or <span className="text-emerald-400 underline">browse computer</span>
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Accepts .pdf (digital & scanned) and .docx formats
                  </p>
                </div>
              </div>
            </div>

            {/* Selected File Details */}
            {selectedFile && (
              <div className="p-3.5 bg-obsidian-950/80 border border-emerald-500/30 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                    <FileCheck className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-white truncate">
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
                  className="text-slate-400 hover:text-white text-xs px-2.5 py-1 rounded-md bg-obsidian-800"
                >
                  Replace
                </button>
              </div>
            )}

            {/* Error Alert */}
            {error && (
              <div className="p-3 bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{error}</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="mt-5 flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={uploading}
                className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white hover:bg-obsidian-800 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUpload}
                disabled={!selectedFile || uploading}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 disabled:from-obsidian-800 disabled:to-obsidian-800 disabled:text-slate-500 text-obsidian-950 text-xs font-bold rounded-xl shadow-lg shadow-emerald-500/20 transition-all active:scale-95 disabled:cursor-not-allowed cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Start Neural Extraction</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
