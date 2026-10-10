"use client";

import React, { useState, useEffect, useRef } from "react";
import { DocumentItem, DocumentSegment, Citation, ClauseInfo } from "@/lib/types";
import { getDocumentContentUrl } from "@/lib/api";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  List,
  Highlighter,
  ExternalLink,
  CheckCircle2,
  FileText
} from "lucide-react";

interface DocumentViewerProps {
  document: DocumentItem | null;
  segments: DocumentSegment[];
  clauses: ClauseInfo[];
  highlightCitation: Citation | null;
  onClearHighlight: () => void;
}

export const DocumentViewer: React.FC<DocumentViewerProps> = ({
  document,
  segments,
  clauses,
  highlightCitation,
  onClearHighlight,
}) => {
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [inDocSearch, setInDocSearch] = useState<string>("");
  const [fontSizePercent, setFontSizePercent] = useState<number>(100);
  const [showOutline, setShowOutline] = useState<boolean>(true);
  const [viewMode, setViewMode] = useState<"structured" | "embed">("structured");

  const segmentRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  const totalPages = document?.page_count || 1;

  // Jump to citation page and scroll into view when highlightCitation changes
  useEffect(() => {
    if (highlightCitation) {
      let targetPage = 1;
      if (typeof highlightCitation.page_number === "number") {
        targetPage = highlightCitation.page_number;
      } else if (typeof highlightCitation.page_number === "string") {
        const parsed = parseInt(highlightCitation.page_number.split("-")[0]);
        if (!isNaN(parsed)) targetPage = parsed;
      }
      setCurrentPage(targetPage);

      // Scroll after DOM update
      setTimeout(() => {
        // Try finding matching segment by citation start_offset or quote text
        const targetSeg = segments.find(
          (s) =>
            (highlightCitation.start_offset !== undefined &&
              s.start_offset <= highlightCitation.start_offset &&
              s.end_offset >= highlightCitation.start_offset) ||
            s.text.includes(highlightCitation.quote.slice(0, 30))
        );

        if (targetSeg && segmentRefs.current[targetSeg.id]) {
          segmentRefs.current[targetSeg.id]?.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
        }
      }, 150);
    }
  }, [highlightCitation, segments]);

  if (!document) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-100 text-slate-400 text-sm">
        Select a document from the library to view source text.
      </div>
    );
  }

  // Filter segments for the currently active page (or all segments if single-page)
  const pageSegments = segments.filter(
    (s) => !s.page_number || s.page_number === currentPage
  );

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-100 overflow-hidden select-text">
      {/* Viewer Action Bar */}
      <div className="h-12 border-b border-slate-200 bg-white px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowOutline(!showOutline)}
            className={`p-1.5 rounded text-xs flex items-center gap-1 border transition-colors ${
              showOutline ? "bg-navy-50 text-navy-800 border-navy-200" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            }`}
            title="Toggle Clause Outline"
          >
            <List className="w-3.5 h-3.5" />
            <span className="font-medium hidden sm:inline">Clause Outline</span>
          </button>

          {/* Page Navigation Controls */}
          <div className="flex items-center gap-1 text-xs">
            <button
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="p-1 rounded text-slate-600 hover:bg-slate-100 disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-medium text-slate-700 px-1">
              Page {currentPage} of {totalPages}
            </span>
            <button
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="p-1 rounded text-slate-600 hover:bg-slate-100 disabled:opacity-40"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Search within document & Zoom controls */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2 top-2 text-slate-400" />
            <input
              type="text"
              placeholder="Find in page..."
              value={inDocSearch}
              onChange={(e) => setInDocSearch(e.target.value)}
              className="pl-7 pr-2 py-1 text-xs bg-slate-50 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-navy-600 w-36 text-slate-800"
            />
          </div>

          <div className="flex items-center gap-1 border-l border-slate-200 pl-2">
            <button
              onClick={() => setFontSizePercent((f) => Math.max(80, f - 10))}
              className="p-1 text-slate-600 hover:bg-slate-100 rounded"
              title="Zoom out text"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] text-slate-500 font-mono w-9 text-center">
              {fontSizePercent}%
            </span>
            <button
              onClick={() => setFontSizePercent((f) => Math.min(150, f + 10))}
              className="p-1 text-slate-600 hover:bg-slate-100 rounded"
              title="Zoom in text"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* View mode toggle */}
          {document.file_type === "pdf" && (
            <div className="flex items-center gap-1 border-l border-slate-200 pl-2 text-xs">
              <button
                onClick={() => setViewMode(viewMode === "structured" ? "embed" : "structured")}
                className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-[11px]"
              >
                {viewMode === "structured" ? "Raw PDF View" : "Structured View"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Active Citation Notification Banner */}
      {highlightCitation && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center justify-between text-xs text-amber-900 shrink-0">
          <div className="flex items-center gap-2 truncate">
            <Highlighter className="w-4 h-4 text-amber-600 shrink-0" />
            <span className="font-semibold shrink-0">
              Highlighted Passage (Page {highlightCitation.page_number || currentPage}):
            </span>
            <span className="italic truncate text-slate-700">
              "{highlightCitation.quote}"
            </span>
          </div>
          <button
            onClick={onClearHighlight}
            className="text-[11px] font-medium text-amber-800 underline hover:text-amber-950 shrink-0 ml-3"
          >
            Clear Highlight
          </button>
        </div>
      )}

      {/* Main Workspace Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Clause Outline Drawer */}
        {showOutline && (
          <aside className="w-64 border-r border-slate-200 bg-white flex flex-col shrink-0 overflow-y-auto p-3 space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1 block">
              Contract Outline ({clauses.length})
            </span>
            {clauses.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No clause headings indexed.</p>
            ) : (
              clauses.map((clause, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    if (clause.page_number) setCurrentPage(clause.page_number);
                  }}
                  className="text-left p-2 rounded hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-200 group"
                >
                  <p className="text-xs font-semibold text-slate-800 truncate group-hover:text-navy-700">
                    {clause.title}
                  </p>
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Page {clause.page_number || 1}
                  </span>
                </button>
              ))
            )}
          </aside>
        )}

        {/* Document Content View */}
        <div className="flex-1 overflow-y-auto p-8 flex justify-center bg-slate-100">
          {viewMode === "embed" && document.file_type === "pdf" ? (
            <div className="w-full h-full max-w-4xl bg-white shadow-md rounded-lg overflow-hidden">
              <iframe
                src={`${getDocumentContentUrl(document.id)}#page=${currentPage}`}
                className="w-full h-full border-none"
                title="PDF Document Embed"
              />
            </div>
          ) : (
            <div
              className="w-full max-w-3xl bg-white shadow-sm border border-slate-200 rounded-lg p-10 space-y-6"
              style={{ fontSize: `${fontSizePercent}%` }}
            >
              {/* Page Header */}
              <div className="border-b border-slate-100 pb-3 flex items-center justify-between text-xs text-slate-400">
                <span className="font-semibold text-slate-500 uppercase tracking-wider text-[10px]">
                  {document.filename}
                </span>
                <span>Page {currentPage} of {totalPages}</span>
              </div>

              {pageSegments.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-xs">
                  No text passages recorded on page {currentPage}.
                </div>
              ) : (
                pageSegments.map((segment) => {
                  const isHighlightedCitation =
                    highlightCitation &&
                    ((highlightCitation.start_offset !== undefined &&
                      segment.start_offset <= highlightCitation.start_offset &&
                      segment.end_offset >= highlightCitation.start_offset) ||
                      segment.text.includes(highlightCitation.quote.slice(0, 30)));

                  // In-doc search highlight
                  let displayText: React.ReactNode = segment.text;
                  if (inDocSearch.trim()) {
                    const parts = segment.text.split(new RegExp(`(${inDocSearch})`, "gi"));
                    displayText = parts.map((part, pIdx) =>
                      part.toLowerCase() === inDocSearch.toLowerCase() ? (
                        <mark key={pIdx} className="bg-amber-200 text-slate-900 rounded px-0.5">
                          {part}
                        </mark>
                      ) : (
                        part
                      )
                    );
                  }

                  return (
                    <div
                      key={segment.id}
                      ref={(el) => {
                        segmentRefs.current[segment.id] = el;
                      }}
                      className={`transition-all duration-300 p-2 rounded ${
                        isHighlightedCitation
                          ? "citation-target-highlight bg-amber-50"
                          : "hover:bg-slate-50"
                      }`}
                    >
                      {segment.section_title && (
                        <h4 className="font-bold text-slate-900 mb-1 text-sm tracking-tight text-navy-950">
                          {segment.section_title}
                        </h4>
                      )}

                      <p className="text-slate-800 leading-relaxed text-sm whitespace-pre-wrap font-serif">
                        {displayText}
                      </p>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
