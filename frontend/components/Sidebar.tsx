"use client";

import React, { useState } from "react";
import { DocumentItem } from "@/lib/types";
import { formatBytes } from "@/lib/utils";
import {
  FileText,
  Upload,
  Trash2,
  Search,
  CheckSquare,
  Square,
  Layers,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Sparkles,
  Scale,
  ShieldCheck,
  ChevronRight
} from "lucide-react";

interface SidebarProps {
  documents: DocumentItem[];
  selectedDocId: string | null;
  onSelectDoc: (id: string) => void;
  multiSelectIds: string[];
  onToggleMultiSelect: (id: string) => void;
  isMultiSelectMode: boolean;
  onToggleMultiSelectMode: () => void;
  onOpenUploadModal: () => void;
  onDeleteDoc: (id: string) => void;
  loading: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  documents,
  selectedDocId,
  onSelectDoc,
  multiSelectIds,
  onToggleMultiSelect,
  isMultiSelectMode,
  onToggleMultiSelectMode,
  onOpenUploadModal,
  onDeleteDoc,
  loading,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const filteredDocs = documents.filter((doc) =>
    doc.filename.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <aside className="w-80 h-full bg-obsidian-950 border-r border-slate-800/80 flex flex-col shrink-0 select-none text-slate-200">
      {/* Brand & Logo Header */}
      <div className="p-4 border-b border-slate-800/70 flex items-center justify-between bg-obsidian-900/60 backdrop-blur-md">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 via-teal-600 to-cyan-600 p-0.5 shadow-[0_0_15px_rgba(16,185,129,0.35)]">
            <div className="w-full h-full bg-obsidian-950 rounded-[10px] flex items-center justify-center">
              <Scale className="w-5 h-5 text-emerald-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="font-extrabold text-base tracking-tight text-white leading-tight">
                ClauseWise
              </h1>
              <span className="text-[9px] uppercase font-bold tracking-widest px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                PRO
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium">
              Legal Contract Intelligence
            </p>
          </div>
        </div>
      </div>

      {/* Upload Contract Call-To-Action Button */}
      <div className="p-3 border-b border-slate-800/60">
        <button
          onClick={onOpenUploadModal}
          className="w-full group relative overflow-hidden flex items-center justify-center gap-2 py-2.5 px-4 bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white text-xs font-bold rounded-xl shadow-[0_0_20px_rgba(16,185,129,0.25)] hover:shadow-[0_0_25px_rgba(16,185,129,0.45)] transition-all duration-200 focus:outline-none"
        >
          <Upload className="w-4 h-4 text-emerald-200 group-hover:scale-110 transition-transform" />
          <span>Upload Contract</span>
          <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded ml-1 font-mono">
            PDF / DOCX
          </span>
        </button>
      </div>

      {/* Search Bar & Multi-Select Toggle */}
      <div className="px-3 pt-3 pb-2 space-y-2">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
          <input
            type="text"
            placeholder="Search contract library..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-900/80 border border-slate-800 rounded-lg focus:outline-none focus:border-emerald-500/80 text-slate-200 placeholder-slate-500 focus:ring-1 focus:ring-emerald-500/50"
          />
        </div>

        <div className="flex items-center justify-between text-xs text-slate-400 px-1 pt-1">
          <span className="font-bold uppercase tracking-wider text-[10px] text-slate-500">
            Library ({documents.length})
          </span>
          <button
            onClick={onToggleMultiSelectMode}
            className={`flex items-center gap-1 text-[11px] font-semibold transition-colors px-2 py-0.5 rounded ${
              isMultiSelectMode
                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
            }`}
          >
            <Layers className="w-3 h-3 text-cyan-400" />
            <span>{isMultiSelectMode ? "Done Selecting" : "Cross-Doc Mode"}</span>
          </button>
        </div>
      </div>

      {/* Contract Documents List */}
      <div className="flex-1 overflow-y-auto px-2 py-1 space-y-1.5">
        {loading && documents.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500 flex flex-col items-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
            <span>Loading document library...</span>
          </div>
        ) : filteredDocs.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            {searchQuery ? "No contracts matching query." : "No contracts uploaded yet."}
          </div>
        ) : (
          filteredDocs.map((doc) => {
            const isSelected = doc.id === selectedDocId;
            const isChecked = multiSelectIds.includes(doc.id);

            return (
              <div
                key={doc.id}
                onClick={() => {
                  if (isMultiSelectMode) {
                    onToggleMultiSelect(doc.id);
                  } else {
                    onSelectDoc(doc.id);
                  }
                }}
                className={`group relative flex items-start gap-2.5 p-2.5 rounded-xl cursor-pointer transition-all border ${
                  isSelected && !isMultiSelectMode
                    ? "bg-slate-900/90 border-emerald-500/70 shadow-[0_0_15px_rgba(16,185,129,0.15)] ring-1 ring-emerald-500/30"
                    : isChecked && isMultiSelectMode
                    ? "bg-cyan-950/60 border-cyan-500/60"
                    : "border-slate-800/40 bg-slate-900/30 hover:bg-slate-900/70 hover:border-slate-700/60"
                }`}
              >
                {/* File Format Badge / Multi-select checkbox */}
                <div className="mt-0.5 shrink-0">
                  {isMultiSelectMode ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleMultiSelect(doc.id);
                      }}
                      className="text-cyan-400"
                    >
                      {isChecked ? (
                        <CheckSquare className="w-4 h-4 text-cyan-400" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-600" />
                      )}
                    </button>
                  ) : (
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black uppercase tracking-wider ${
                        doc.file_type === "pdf"
                          ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                          : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                      }`}
                    >
                      {doc.file_type}
                    </div>
                  )}
                </div>

                {/* Contract Meta */}
                <div className="flex-1 min-w-0 pr-6">
                  <p
                    className={`text-xs font-semibold truncate ${
                      isSelected ? "text-white" : "text-slate-300 group-hover:text-white"
                    }`}
                    title={doc.filename}
                  >
                    {doc.filename}
                  </p>
                  <div className="flex items-center gap-1.5 mt-1 text-[11px] text-slate-500">
                    <span>{formatBytes(doc.file_size)}</span>
                    {doc.page_count && (
                      <>
                        <span>•</span>
                        <span>{doc.page_count} pg</span>
                      </>
                    )}
                    {doc.ocr_applied && (
                      <span className="ml-1 px-1.5 py-0.2 bg-purple-500/10 border border-purple-500/20 text-purple-300 font-bold rounded text-[9px]">
                        OCR
                      </span>
                    )}
                  </div>

                  {/* Processing Status Badges */}
                  {doc.status === "processing" && (
                    <div className="flex items-center gap-1 mt-1 text-[10px] text-cyan-400 font-semibold animate-pulse">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span>Indexing document...</span>
                    </div>
                  )}
                  {doc.status === "failed" && (
                    <div
                      className="flex items-center gap-1 mt-1 text-[10px] text-rose-400 font-medium truncate"
                      title={doc.error_message || "Extraction failed"}
                    >
                      <AlertCircle className="w-3 h-3 shrink-0" />
                      <span className="truncate">Processing failed</span>
                    </div>
                  )}
                </div>

                {/* Delete Button / Inline Confirmation */}
                <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  {confirmDeleteId === doc.id ? (
                    <div className="flex items-center gap-1 bg-obsidian-950 border border-rose-500/40 shadow-xl rounded-md p-1 z-10">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteDoc(doc.id);
                          setConfirmDeleteId(null);
                        }}
                        className="px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-[10px] font-bold"
                      >
                        Delete
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmDeleteId(null);
                        }}
                        className="px-1 py-0.5 text-slate-400 hover:text-white text-[10px]"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmDeleteId(doc.id);
                      }}
                      className="p-1 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors"
                      title="Delete contract"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer Info with Active AI Model Status */}
      <div className="p-3 border-t border-slate-800/70 bg-obsidian-900/60 text-[11px] text-slate-400 flex items-center justify-between">
        <span className="flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="text-slate-300 font-medium">Gemini 2.5 Flash</span>
        </span>
        <span className="text-[10px] font-mono text-slate-500">PaddleOCR Active</span>
      </div>
    </aside>
  );
};
