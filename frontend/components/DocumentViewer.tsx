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
  FileText,
  MousePointerClick,
  Info,
  X,
  MessageSquare,
  Copy,
  Sparkles,
  Layers,
  Check
} from "lucide-react";

interface DocumentViewerProps {
  document: DocumentItem | null;
  segments: DocumentSegment[];
  clauses: ClauseInfo[];
  highlightCitation: Citation | null;
  onClearHighlight: () => void;
  onAskAboutClause?: (clauseText: string) => void;
}

export const DocumentViewer: React.FC<DocumentViewerProps> = ({
  document,
  segments,
  clauses,
  highlightCitation,
  onClearHighlight,
  onAskAboutClause,
}) => {
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [inDocSearch, setInDocSearch] = useState<string>("");
  const [fontSizePercent, setFontSizePercent] = useState<number>(100);
  const [showOutline, setShowOutline] = useState<boolean>(true);
  const [viewMode, setViewMode] = useState<"structured" | "embed">("structured");

  // Interactive Clicked Segment State
  const [activeSegment, setActiveSegment] = useState<DocumentSegment | null>(null);
  const [copiedSegmentId, setCopiedSegmentId] = useState<string | null>(null);

  // Onboarding Popover State (5s after preprocess, only once per account)
  const [showOnboardingTip, setShowOnboardingTip] = useState<boolean>(false);

  const segmentRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  const totalPages = document?.page_count || 1;

  // Onboarding discovery tip: 5s after document is ready, only once per account
  useEffect(() => {
    if (!document) return;
    const hasSeenTip = localStorage.getItem("clausewise_seen_highlight_tip");
    if (!hasSeenTip) {
      const timer = setTimeout(() => {
        setShowOnboardingTip(true);
      }, 5000); // 5 seconds after preprocessing
      return () => clearTimeout(timer);
    }
  }, [document?.id]);

  const handleDismissOnboardingTip = () => {
    localStorage.setItem("clausewise_seen_highlight_tip", "true");
    setShowOnboardingTip(false);
  };

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

      setTimeout(() => {
        const targetSeg = segments.find(
          (s) =>
            (highlightCitation.start_offset !== undefined &&
              s.start_offset <= highlightCitation.start_offset &&
              s.end_offset >= highlightCitation.start_offset) ||
            s.text.includes(highlightCitation.quote.slice(0, 30))
        );

        if (targetSeg) {
          setActiveSegment(targetSeg);
          if (segmentRefs.current[targetSeg.id]) {
            segmentRefs.current[targetSeg.id]?.scrollIntoView({
              behavior: "smooth",
              block: "center",
            });
          }
        }
      }, 150);
    }
  }, [highlightCitation, segments]);

  if (!document) {
    return (
      <div className="flex-1 flex items-center justify-center bg-obsidian-950 text-slate-500 text-sm">
        Select a contract from the library to view extracted source text.
      </div>
    );
  }

  // Filter segments for the currently active page
  const pageSegments = segments.filter(
    (s) => !s.page_number || s.page_number === currentPage
  );

  const handleCopyText = (seg: DocumentSegment) => {
    navigator.clipboard.writeText(seg.text);
    setCopiedSegmentId(seg.id);
    setTimeout(() => setCopiedSegmentId(null), 2000);
  };

  const handleRedirectToOriginal = (seg: DocumentSegment) => {
    // Switch to raw PDF view at exact page
    const p = seg.page_number || currentPage;
    setCurrentPage(p);
    setViewMode("embed");
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-obsidian-950 overflow-hidden select-text text-slate-200 relative">
      {/* Viewer Action Bar */}
      <div className="h-12 border-b border-slate-800/80 bg-obsidian-900/90 px-4 flex items-center justify-between shrink-0 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowOutline(!showOutline)}
            className={`p-1.5 rounded-lg text-xs flex items-center gap-1.5 border transition-all ${
              showOutline
                ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
                : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"
            }`}
            title="Toggle Clause Outline"
          >
            <List className="w-3.5 h-3.5 text-emerald-400" />
            <span className="font-semibold hidden sm:inline">Clause Outline</span>
          </button>

          {/* Page Navigation Controls */}
          <div className="flex items-center gap-1.5 text-xs bg-slate-900/80 border border-slate-800 px-2 py-1 rounded-lg">
            <button
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="p-1 rounded text-slate-400 hover:text-white disabled:opacity-30"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-bold text-white px-1">
              Page {currentPage} of {totalPages}
            </span>
            <button
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="p-1 rounded text-slate-400 hover:text-white disabled:opacity-30"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Search, Zoom & Original Document Redirect Toggle */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
            <input
              type="text"
              placeholder="Find in page..."
              value={inDocSearch}
              onChange={(e) => setInDocSearch(e.target.value)}
              className="pl-8 pr-2.5 py-1 text-xs bg-slate-900 border border-slate-800 rounded-lg focus:outline-none focus:border-emerald-500/70 w-36 text-slate-200 placeholder-slate-500"
            />
          </div>

          <div className="flex items-center gap-1 border-l border-slate-800 pl-3">
            <button
              onClick={() => setFontSizePercent((f) => Math.max(80, f - 10))}
              className="p-1 text-slate-400 hover:text-white rounded"
              title="Zoom out text"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] text-slate-400 font-mono w-9 text-center">
              {fontSizePercent}%
            </span>
            <button
              onClick={() => setFontSizePercent((f) => Math.min(150, f + 10))}
              className="p-1 text-slate-400 hover:text-white rounded"
              title="Zoom in text"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* View mode toggle (Structured vs Original PDF) */}
          {document.file_type === "pdf" && (
            <div className="flex items-center gap-1 border-l border-slate-800 pl-3">
              <button
                onClick={() => setViewMode(viewMode === "structured" ? "embed" : "structured")}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-bold text-xs transition-all ${
                  viewMode === "embed"
                    ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                    : "bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700"
                }`}
              >
                <ExternalLink className="w-3 h-3 text-emerald-400" />
                <span>{viewMode === "structured" ? "Original PDF View" : "Structured View"}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Active Citation Notification Banner (from Chat) */}
      {highlightCitation && (
        <div className="bg-amber-950/80 border-b border-amber-500/30 px-4 py-2 flex items-center justify-between text-xs text-amber-200 shrink-0 backdrop-blur-md">
          <div className="flex items-center gap-2 truncate">
            <Highlighter className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="font-bold text-amber-300 shrink-0">
              Cited Passage (Page {highlightCitation.page_number || currentPage}):
            </span>
            <span className="italic truncate text-slate-300">
              "{highlightCitation.quote}"
            </span>
          </div>
          <button
            onClick={onClearHighlight}
            className="text-[11px] font-semibold text-amber-400 underline hover:text-amber-200 shrink-0 ml-3"
          >
            Clear Highlight
          </button>
        </div>
      )}

      {/* Main Workspace Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Clause Outline Drawer */}
        {showOutline && (
          <aside className="w-64 border-r border-slate-800/80 bg-obsidian-950 flex flex-col shrink-0 overflow-y-auto p-3 space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-1 block px-1">
              Indexed Clauses ({clauses.length})
            </span>
            {clauses.length === 0 ? (
              <p className="text-xs text-slate-500 italic p-2">No clause headings indexed.</p>
            ) : (
              clauses.map((clause, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    if (clause.page_number) setCurrentPage(clause.page_number);
                  }}
                  className="text-left p-2 rounded-lg hover:bg-slate-900/80 transition-colors border border-transparent hover:border-slate-800 group"
                >
                  <p className="text-xs font-semibold text-slate-300 truncate group-hover:text-emerald-400">
                    {clause.title}
                  </p>
                  <span className="text-[10px] text-slate-500 mt-0.5 block font-mono">
                    Page {clause.page_number || 1}
                  </span>
                </button>
              ))
            )}
          </aside>
        )}

        {/* Document Content View */}
        <div className="flex-1 overflow-y-auto p-8 flex justify-center bg-obsidian-950">
          {viewMode === "embed" && document.file_type === "pdf" ? (
            <div className="w-full h-full max-w-4xl bg-slate-900 shadow-2xl rounded-xl border border-slate-800 overflow-hidden flex flex-col">
              <div className="p-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between text-xs text-slate-300">
                <span className="font-bold flex items-center gap-1.5 text-emerald-400">
                  <FileText className="w-4 h-4" />
                  <span>Original PDF File (Direct Binary Render)</span>
                </span>
                <span className="text-slate-500">Navigated to Page {currentPage}</span>
              </div>
              <iframe
                src={`${getDocumentContentUrl(document.id)}#page=${currentPage}`}
                className="w-full flex-1 border-none"
                title="Original PDF Embed"
              />
            </div>
          ) : (
            <div
              className="w-full max-w-3xl bg-obsidian-900/90 shadow-2xl border border-slate-800 rounded-2xl p-10 space-y-6 text-slate-200 backdrop-blur-md relative"
              style={{ fontSize: `${fontSizePercent}%` }}
            >
              {/* Document Page Header */}
              <div className="border-b border-slate-800/80 pb-3 flex items-center justify-between text-xs text-slate-500">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-300 uppercase tracking-wider text-[11px]">
                    {document.filename}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[10px] font-bold border border-emerald-500/20">
                    Click text to highlight & inspect
                  </span>
                </div>
                <span className="font-mono text-slate-400">Page {currentPage} of {totalPages}</span>
              </div>

              {pageSegments.length === 0 ? (
                <div className="text-center py-16 text-slate-500 text-xs">
                  No text passages recorded on page {currentPage}.
                </div>
              ) : (
                pageSegments.map((segment) => {
                  const isActiveGreen = activeSegment?.id === segment.id;
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
                        <mark key={pIdx} className="bg-emerald-500/40 text-emerald-200 rounded px-1">
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
                      onClick={() => setActiveSegment(segment)}
                      className={`text-segment-clickable relative transition-all duration-200 group ${
                        isActiveGreen
                          ? "text-segment-active-green"
                          : isHighlightedCitation
                          ? "citation-target-highlight bg-amber-500/10"
                          : ""
                      }`}
                    >
                      {/* BUBBLE BOX (PUBBLEBOX) POPOVER: Appears when clicking the text */}
                      {isActiveGreen && (
                        <div className="absolute -top-16 left-2 z-50 bg-slate-900 border-2 border-emerald-500/80 rounded-xl px-3.5 py-2 shadow-[0_0_25px_rgba(16,185,129,0.4)] flex items-center gap-3 text-xs text-white pubblebox-arrow-bottom backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0"></span>
                            <div className="leading-tight">
                              <span className="font-bold text-emerald-300 block text-[11px]">
                                {segment.section_title || `Clause Block #${segment.paragraph_index ?? 0}`}
                              </span>
                              <span className="text-[10px] font-mono text-slate-400">
                                Start: [{segment.start_offset}] • End: [{segment.end_offset}] • {segment.end_offset - segment.start_offset} chars
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 border-l border-slate-700 pl-2">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRedirectToOriginal(segment);
                              }}
                              className="px-2.5 py-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-md text-[10px] font-bold flex items-center gap-1 shadow-sm transition-all"
                              title="Redirect and view in original raw PDF at this page"
                            >
                              <ExternalLink className="w-3 h-3" />
                              <span>Original Document</span>
                            </button>

                            {onAskAboutClause && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onAskAboutClause(segment.text);
                                }}
                                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-md text-[10px] font-medium flex items-center gap-1 transition-colors"
                                title="Ask AI about this clause"
                              >
                                <MessageSquare className="w-3 h-3 text-sky-400" />
                                <span>Analyze in Chat</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopyText(segment);
                              }}
                              className="p-1 text-slate-400 hover:text-white rounded"
                              title="Copy verbatim clause"
                            >
                              {copiedSegmentId === segment.id ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveSegment(null);
                              }}
                              className="p-1 text-slate-400 hover:text-white rounded ml-1"
                              title="Close bubble"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      )}

                      {segment.section_title && (
                        <h4 className="font-extrabold text-white mb-1.5 text-sm tracking-tight flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                          <span>{segment.section_title}</span>
                        </h4>
                      )}

                      <p className="text-slate-200 leading-relaxed text-sm whitespace-pre-wrap font-serif">
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

      {/* ONBOARDING DISCOVERY TIP: 5s after preprocess, only 1 time per account */}
      {showOnboardingTip && (
        <div className="fixed bottom-6 right-6 z-50 max-w-sm bg-obsidian-900 border-2 border-emerald-500/80 rounded-2xl p-5 shadow-[0_0_30px_rgba(16,185,129,0.35)] backdrop-blur-2xl animate-in fade-in slide-in-from-bottom-5 duration-300">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                <MousePointerClick className="w-4 h-4 text-emerald-400" />
              </div>
              <h4 className="font-bold text-sm text-white">
                Interactive Text Navigation
              </h4>
            </div>
            <button
              onClick={handleDismissOnboardingTip}
              className="text-slate-400 hover:text-white p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            Click directly on any extracted text block in the viewer! It will highlight in <strong className="text-emerald-400">green</strong>, display its exact character offset indexes <code className="bg-slate-950 px-1 py-0.5 rounded text-emerald-300">[start..end]</code>, and let you redirect straight to the original document!
          </p>

          <div className="mt-4 flex justify-end">
            <button
              onClick={handleDismissOnboardingTip}
              className="px-4 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold rounded-lg shadow-sm transition-all"
            >
              Got it, Explore Document
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
