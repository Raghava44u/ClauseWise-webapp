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
  Scale
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
    <aside className="w-80 h-full bg-slate-50 border-r border-slate-200 flex flex-col shrink-0 select-none text-slate-800">
      {/* Brand & Logo Header */}
      <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-white">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-lg bg-slate-900 flex items-center justify-center text-white shadow-xs">
            <Scale className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="font-bold text-sm tracking-tight text-slate-900 leading-tight">
                ClauseWise
              </h1>
              <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200">
                PRO
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              Legal Contract Intelligence
            </p>
          </div>
        </div>
      </div>

      {/* Upload Contract Call-To-Action Button */}
      <div className="p-3 border-b border-slate-200 bg-white">
        <button
          onClick={onOpenUploadModal}
          className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
        >
          <Upload className="w-3.5 h-3.5 text-emerald-400" />
          <span>Upload Contract</span>
          <span className="text-[10px] text-slate-400 ml-1 font-mono">
            PDF / DOCX
          </span>
        </button>
      </div>

      {/* Search Bar & Multi-Select Toggle */}
      <div className="px-3 pt-3 pb-2 space-y-2">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search contracts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-slate-400 text-slate-800 placeholder-slate-400 shadow-2xs"
          />
        </div>

        <div className="flex items-center justify-between text-xs text-slate-500 px-1 pt-0.5">
          <span className="font-bold uppercase tracking-wider text-[10px] text-slate-400">
            Library ({documents.length})
          </span>
          <button
            onClick={onToggleMultiSelectMode}
            className={`flex items-center gap-1 text-[11px] font-medium transition-colors px-2 py-0.5 rounded cursor-pointer ${
              isMultiSelectMode
                ? "bg-slate-200 text-slate-900 font-semibold"
                : "text-slate-500 hover:text-slate-800 hover:bg-slate-200/50"
            }`}
          >
            <Layers className="w-3 h-3 text-slate-600" />
            <span>{isMultiSelectMode ? "Done" : "Compare Multiple"}</span>
          </button>
        </div>
      </div>

      {/* Contract Documents List */}
      <div className="flex-1 overflow-y-auto px-3 py-1 space-y-1.5">
        {loading && documents.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-slate-500" />
            <span>Loading document library...</span>
          </div>
        ) : filteredDocs.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
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
                className={`group relative flex items-start gap-2.5 p-2.5 rounded-lg cursor-pointer transition-all border ${
                  isSelected && !isMultiSelectMode
                    ? "bg-white border-l-4 border-l-emerald-600 border-slate-300 shadow-xs"
                    : isChecked && isMultiSelectMode
                    ? "bg-emerald-50 border-emerald-300"
                    : "bg-white/70 border-slate-200 hover:bg-white hover:border-slate-300"
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
                      className="text-slate-700"
                    >
                      {isChecked ? (
                        <CheckSquare className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-400" />
                      )}
                    </button>
                  ) : (
                    <div className="w-6 h-6 rounded bg-slate-100 border border-slate-200 flex items-center justify-center text-[9px] font-bold text-slate-600 uppercase">
                      {doc.file_type}
                    </div>
                  )}
                </div>

                {/* Contract Meta */}
                <div className="flex-1 min-w-0 pr-6">
                  <p
                    className={`text-xs font-semibold truncate ${
                      isSelected ? "text-slate-900" : "text-slate-700 group-hover:text-slate-900"
                    }`}
                    title={doc.filename}
                  >
                    {doc.filename}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-slate-400">
                    <span>{formatBytes(doc.file_size)}</span>
                    {doc.page_count && (
                      <>
                        <span>•</span>
                        <span>{doc.page_count} pg</span>
                      </>
                    )}
                    {doc.ocr_applied && (
                      <span className="ml-1 px-1 py-0.2 bg-slate-100 text-slate-600 font-medium rounded text-[9px]">
                        OCR
                      </span>
                    )}
                  </div>

                  {/* Processing Status Badges */}
                  {doc.status === "processing" && (
                    <div className="flex items-center gap-1 mt-1 text-[10px] text-slate-600 font-medium animate-pulse">
                      <Loader2 className="w-3 h-3 animate-spin text-emerald-600" />
                      <span>Indexing contract...</span>
                    </div>
                  )}
                  {doc.status === "failed" && (
                    <div
                      className="flex items-center gap-1 mt-1 text-[10px] text-rose-600 font-medium truncate"
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
                    <div className="flex items-center gap-1 bg-white border border-rose-300 shadow-md rounded p-1 z-10">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteDoc(doc.id);
                          setConfirmDeleteId(null);
                        }}
                        className="px-1.5 py-0.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-[10px] font-semibold"
                      >
                        Delete
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmDeleteId(null);
                        }}
                        className="px-1 py-0.5 text-slate-500 hover:text-slate-800 text-[10px]"
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
                      className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
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
      <div className="p-3 border-t border-slate-200 bg-white text-[11px] text-slate-500 flex items-center justify-between">
        <span className="flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="text-slate-700 font-medium">Gemini 2.5 Flash</span>
        </span>
        <span className="text-[10px] font-mono text-slate-400">PaddleOCR Ready</span>
      </div>
    </aside>
  );
};
