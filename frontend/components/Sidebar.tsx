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
  ShieldAlert,
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
    <aside className="w-80 h-full bg-white border-r border-slate-200 flex flex-col shrink-0 select-none">
      {/* Brand & Logo */}
      <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
        <div className="flex items-center space-x-2.5">
          <div className="w-9 h-9 rounded-lg bg-navy-800 flex items-center justify-center text-white shadow-sm">
            <svg
              className="w-5 h-5 text-sky-400"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
              <path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
              <path d="M7 21h10" />
              <path d="M12 3v18" />
              <path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2" />
            </svg>
          </div>
          <div>
            <h1 className="font-bold text-base tracking-tight text-slate-900 leading-tight">
              ClauseWise
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              Contract Intelligence
            </p>
          </div>
        </div>
      </div>

      {/* Upload Action */}
      <div className="p-3 border-b border-slate-100">
        <button
          onClick={onOpenUploadModal}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-navy-800 hover:bg-navy-900 text-white text-sm font-medium rounded-lg shadow-sm transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-navy-600 focus:ring-offset-1"
        >
          <Upload className="w-4 h-4 text-sky-400" />
          <span>Upload Contract</span>
        </button>
      </div>

      {/* Search & Multi-Select Controls */}
      <div className="px-3 pt-3 pb-2 space-y-2">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search contracts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-navy-600 text-slate-800 placeholder-slate-400"
          />
        </div>

        <div className="flex items-center justify-between text-xs text-slate-500 px-0.5 pt-1">
          <span className="font-semibold uppercase tracking-wider text-[10px] text-slate-400">
            Library ({documents.length})
          </span>
          <button
            onClick={onToggleMultiSelectMode}
            className={`flex items-center gap-1 font-medium transition-colors ${
              isMultiSelectMode ? "text-navy-700 font-semibold" : "hover:text-slate-700"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>{isMultiSelectMode ? "Done" : "Cross-Doc Select"}</span>
          </button>
        </div>
      </div>

      {/* Document Library List */}
      <div className="flex-1 overflow-y-auto px-2 py-1 space-y-1">
        {loading && documents.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-navy-600" />
            <span>Loading document library...</span>
          </div>
        ) : filteredDocs.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            {searchQuery ? "No contracts matching search." : "No contracts uploaded yet."}
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
                    ? "bg-navy-50/70 border-navy-300 shadow-xs"
                    : isChecked && isMultiSelectMode
                    ? "bg-sky-50/70 border-sky-300"
                    : "border-transparent hover:bg-slate-100/80 hover:border-slate-200"
                }`}
              >
                {/* Multi-select checkbox or Doc Icon */}
                <div className="mt-0.5 shrink-0">
                  {isMultiSelectMode ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleMultiSelect(doc.id);
                      }}
                      className="text-navy-700"
                    >
                      {isChecked ? (
                        <CheckSquare className="w-4 h-4 text-navy-700" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-400" />
                      )}
                    </button>
                  ) : (
                    <div
                      className={`w-7 h-7 rounded flex items-center justify-center text-xs font-bold uppercase ${
                        doc.file_type === "pdf"
                          ? "bg-rose-100 text-rose-700"
                          : "bg-blue-100 text-blue-700"
                      }`}
                    >
                      {doc.file_type}
                    </div>
                  )}
                </div>

                {/* Doc Details */}
                <div className="flex-1 min-w-0 pr-6">
                  <p
                    className={`text-xs font-medium truncate ${
                      isSelected ? "text-navy-950 font-semibold" : "text-slate-800"
                    }`}
                    title={doc.filename}
                  >
                    {doc.filename}
                  </p>
                  <div className="flex items-center gap-1.5 mt-1 text-[11px] text-slate-400">
                    <span>{formatBytes(doc.file_size)}</span>
                    {doc.page_count && (
                      <>
                        <span>•</span>
                        <span>{doc.page_count} pg</span>
                      </>
                    )}
                    {doc.ocr_applied && (
                      <span className="ml-1 px-1.5 py-0.2 bg-purple-100 text-purple-700 font-medium rounded text-[10px]">
                        OCR
                      </span>
                    )}
                  </div>

                  {/* Processing Status Badges */}
                  {doc.status === "processing" && (
                    <div className="flex items-center gap-1 mt-1 text-[10px] text-blue-600 font-medium">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span>Indexing clauses...</span>
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

                {/* Delete Button / Confirmation */}
                <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  {confirmDeleteId === doc.id ? (
                    <div className="flex items-center gap-1 bg-white border border-rose-200 shadow-md rounded p-1">
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
                        className="px-1 py-0.5 text-slate-400 hover:text-slate-600 text-[10px]"
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
                      className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
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

      {/* Footer Info */}
      <div className="p-3 border-t border-slate-200 bg-slate-50/70 text-[11px] text-slate-400 flex items-center justify-between">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
          <span>Engine Online</span>
        </span>
        <span className="text-[10px] font-mono text-slate-400">v1.0.0</span>
      </div>
    </aside>
  );
};
