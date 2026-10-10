"use client";

import React, { useState, useEffect, useRef } from "react";
import { DocumentItem, DocumentSegment, Citation, ClauseInfo } from "../lib/types";
import { getPageImageUrl, getPageInfo } from "../lib/api";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  List,
  Highlighter,
  X,
  MessageSquare,
  Copy,
  FileText,
  MousePointerClick,
  Check,
  Eye,
  AlignLeft,
  Columns,
  ArrowRight,
  Sparkles
} from "lucide-react";

interface DocumentViewerProps {
  document: DocumentItem | null;
  segments: DocumentSegment[];
  clauses: ClauseInfo[];
  highlightCitation: Citation | null;
  onClearHighlight: () => void;
  onAskAboutClause?: (clauseText: string) => void;
}

export type ViewLayoutMode = "split" | "extracted" | "original";

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
  const [zoomPercent, setZoomPercent] = useState<number>(100);
  const [showOutline, setShowOutline] = useState<boolean>(true);
  
  // Default to Split View on desktop so user sees Extracted Text on Left & Original Document on Right!
  const [layoutMode, setLayoutMode] = useState<ViewLayoutMode>("split");

  // Page Dimensions for Bounding Box Overlay Mapping
  const [pageInfo, setPageInfo] = useState<{ width: number; height: number } | null>(null);

  // Active Clicked Segment State
  const [activeSegment, setActiveSegment] = useState<DocumentSegment | null>(null);
  const [copiedSegmentId, setCopiedSegmentId] = useState<string | null>(null);

  // Onboarding Popover State (5s after preprocess, only once per account)
  const [showOnboardingTip, setShowOnboardingTip] = useState<boolean>(false);

  const segmentRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const originalOverlayRef = useRef<HTMLDivElement | null>(null);

  const totalPages = document?.page_count || 1;

  // Fetch page dimensions for coordinate mapping
  useEffect(() => {
    if (document && document.file_type === "pdf") {
      getPageInfo(document.id, currentPage)
        .then((info) => setPageInfo(info))
        .catch(() => setPageInfo({ width: 595, height: 842 }));
    }
  }, [document?.id, currentPage]);

  // Onboarding discovery tip: 5s after document is ready, only once per account
  useEffect(() => {
    if (!document) return;
    const hasSeenTip = localStorage.getItem("clausewise_seen_highlight_tip");
    if (!hasSeenTip) {
      const timer = setTimeout(() => {
        setShowOnboardingTip(true);
      }, 5000);
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
      <div className="flex-1 flex items-center justify-center bg-slate-50 text-slate-400 text-sm">
        Select a contract from the library to view extracted source text.
      </div>
    );
  }

  const pageSegments = segments.filter(
    (s) => !s.page_number || s.page_number === currentPage
  );

  const handleCopyText = (seg: DocumentSegment) => {
    navigator.clipboard.writeText(seg.text);
    setCopiedSegmentId(seg.id);
    setTimeout(() => setCopiedSegmentId(null), 2000);
  };

  const handleSelectSegment = (seg: DocumentSegment) => {
    setActiveSegment(seg);
    if (seg.page_number && seg.page_number !== currentPage) {
      setCurrentPage(seg.page_number);
    }
    // If currently in extracted-only mode on mobile/narrow screen, switch to split view so user sees the green box on original
    if (layoutMode === "extracted") {
      setLayoutMode("split");
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-100/70 overflow-hidden select-text text-slate-800 relative">
      {/* Viewer Action Bar */}
      <div className="h-12 border-b border-slate-200 bg-white px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowOutline(!showOutline)}
            className={`p-1.5 rounded-lg text-xs flex items-center gap-1.5 border transition-all cursor-pointer ${
              showOutline
                ? "bg-slate-100 text-slate-900 border-slate-300 font-semibold"
                : "bg-white text-slate-600 border-slate-200 hover:text-slate-900"
            }`}
            title="Toggle Clause Outline"
          >
            <List className="w-3.5 h-3.5 text-slate-700" />
            <span className="hidden sm:inline">Clause Outline</span>
          </button>

          {/* Page Navigation Controls */}
          <div className="flex items-center gap-1 text-xs bg-slate-50 border border-slate-200 px-2 py-1 rounded-lg">
            <button
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="p-1 rounded text-slate-500 hover:text-slate-900 disabled:opacity-30 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-semibold text-slate-800 px-1">
              Page {currentPage} of {totalPages}
            </span>
            <button
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="p-1 rounded text-slate-500 hover:text-slate-900 disabled:opacity-30 cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* View Mode Switcher, Zoom & Search */}
        <div className="flex items-center gap-3">
          {/* Mode Switcher: Split View (Both) vs Extracted Text vs Original Document */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
            <button
              onClick={() => setLayoutMode("split")}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer ${
                layoutMode === "split"
                  ? "bg-white text-slate-900 font-semibold shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
              title="View Extracted Text and Original Document side-by-side"
            >
              <Columns className="w-3.5 h-3.5 text-emerald-600" />
              <span>Split View</span>
            </button>
            <button
              onClick={() => setLayoutMode("extracted")}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer ${
                layoutMode === "extracted"
                  ? "bg-white text-slate-900 font-semibold shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
              title="View parsed text"
            >
              <AlignLeft className="w-3.5 h-3.5 text-slate-600" />
              <span>Extracted Text</span>
            </button>
            {document.file_type === "pdf" && (
              <button
                onClick={() => setLayoutMode("original")}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer ${
                  layoutMode === "original"
                    ? "bg-white text-slate-900 font-semibold shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
                title="View original contract page"
              >
                <Eye className="w-3.5 h-3.5 text-emerald-600" />
                <span>Original Document</span>
              </button>
            )}
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Find in page..."
              value={inDocSearch}
              onChange={(e) => setInDocSearch(e.target.value)}
              className="pl-8 pr-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-slate-400 w-36 text-slate-800 placeholder-slate-400"
            />
          </div>

          <div className="flex items-center gap-1 border-l border-slate-200 pl-3">
            <button
              onClick={() => setZoomPercent((f) => Math.max(70, f - 10))}
              className="p-1 text-slate-500 hover:text-slate-900 rounded cursor-pointer"
              title="Zoom out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] text-slate-600 font-mono w-9 text-center">
              {zoomPercent}%
            </span>
            <button
              onClick={() => setZoomPercent((f) => Math.min(150, f + 10))}
              className="p-1 text-slate-500 hover:text-slate-900 rounded cursor-pointer"
              title="Zoom in"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Active Citation Notification Banner (from Chat) */}
      {highlightCitation && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center justify-between text-xs text-amber-900 shrink-0">
          <div className="flex items-center gap-2 truncate">
            <Highlighter className="w-4 h-4 text-amber-600 shrink-0" />
            <span className="font-bold shrink-0">
              Cited Passage (Page {highlightCitation.page_number || currentPage}):
            </span>
            <span className="italic truncate text-slate-700">
              "{highlightCitation.quote}"
            </span>
          </div>
          <button
            onClick={onClearHighlight}
            className="text-[11px] font-semibold text-amber-700 underline hover:text-amber-900 shrink-0 ml-3 cursor-pointer"
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
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1 block px-1">
              Indexed Clauses ({clauses.length})
            </span>
            {clauses.length === 0 ? (
              <p className="text-xs text-slate-400 italic p-2">No clause headings indexed.</p>
            ) : (
              clauses.map((clause, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    if (clause.page_number) setCurrentPage(clause.page_number);
                    const match = segments.find(
                      (s) =>
                        (s.page_number === clause.page_number &&
                          s.section_title?.toLowerCase() === clause.title.toLowerCase()) ||
                        (s.start_offset <= clause.start_offset && s.end_offset >= clause.start_offset)
                    );
                    if (match) handleSelectSegment(match);
                  }}
                  className="text-left p-2 rounded-lg hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-200 group cursor-pointer"
                >
                  <p className="text-xs font-medium text-slate-700 truncate group-hover:text-slate-900">
                    {clause.title}
                  </p>
                  <span className="text-[10px] text-slate-400 mt-0.5 block font-mono">
                    Page {clause.page_number || 1}
                  </span>
                </button>
              ))
            )}
          </aside>
        )}

        {/* WORKSPACE AREA: Dynamic Layout (Split, Extracted Only, Original Only) */}
        <div className="flex-1 overflow-y-auto p-5 flex gap-6 bg-slate-100/60 justify-center">
          
          {/* PANEL 1: EXTRACTED TEXT & STRUCTURED CLAUSES */}
          {(layoutMode === "split" || layoutMode === "extracted") && (
            <div
              className={`flex-1 flex flex-col space-y-4 ${
                layoutMode === "split" ? "max-w-2xl min-w-[340px]" : "max-w-3xl mx-auto"
              }`}
            >
              {/* Header Badge */}
              <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex items-center justify-between shadow-2xs">
                <div>
                  <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <AlignLeft className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Extracted Text & Structured Clauses</span>
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Click any extracted clause below to highlight it in a green box on the original document.
                  </p>
                </div>
                <span className="text-[10px] font-mono text-slate-400 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                  Page {currentPage}
                </span>
              </div>

              {/* List of Extracted Clauses on Current Page */}
              <div className="space-y-3 pb-8">
                {pageSegments.length === 0 ? (
                  <div className="text-center py-16 text-slate-400 text-xs bg-white rounded-xl border border-slate-200">
                    No text extracted on page {currentPage}.
                  </div>
                ) : (
                  pageSegments.map((segment) => {
                    const isActive = activeSegment?.id === segment.id;

                    // In-doc search highlight
                    let displayText: React.ReactNode = segment.text;
                    if (inDocSearch.trim()) {
                      const parts = segment.text.split(new RegExp(`(${inDocSearch})`, "gi"));
                      displayText = parts.map((part, pIdx) =>
                        part.toLowerCase() === inDocSearch.toLowerCase() ? (
                          <mark key={pIdx} className="bg-emerald-100 text-emerald-900 rounded px-1">
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
                        onClick={() => handleSelectSegment(segment)}
                        className={`p-4 rounded-xl border transition-all cursor-pointer relative ${
                          isActive
                            ? "bg-emerald-50/70 border-emerald-500 shadow-xs ring-1 ring-emerald-500/30"
                            : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50 shadow-2xs"
                        }`}
                      >
                        {/* Segment Card Header */}
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className={`w-2 h-2 rounded-full shrink-0 ${
                                isActive ? "bg-emerald-600 animate-pulse" : "bg-slate-400"
                              }`}
                            />
                            <h4
                              className={`text-xs font-bold truncate ${
                                isActive ? "text-emerald-900" : "text-slate-800"
                              }`}
                            >
                              {segment.section_title || `Clause Block #${segment.paragraph_index ?? 0}`}
                            </h4>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                              [{segment.start_offset}..{segment.end_offset}]
                            </span>
                            <span className="text-[10px] text-emerald-700 font-semibold flex items-center gap-0.5 bg-emerald-100/60 px-1.5 py-0.5 rounded">
                              <span>Refer Original</span>
                              <ArrowRight className="w-2.5 h-2.5" />
                            </span>
                          </div>
                        </div>

                        {/* Extracted Text Body */}
                        <p className="text-xs leading-relaxed text-slate-700 font-serif whitespace-pre-wrap">
                          {displayText}
                        </p>

                        {/* Quick Action Toolbar inside card when active */}
                        {isActive && (
                          <div className="mt-3 pt-2.5 border-t border-emerald-200/60 flex items-center justify-between text-xs">
                            <span className="text-[10px] text-emerald-800 font-medium">
                              Highlighted in green on original document →
                            </span>

                            <div className="flex items-center gap-1.5">
                              {onAskAboutClause && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onAskAboutClause(segment.text);
                                  }}
                                  className="px-2 py-1 bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 rounded-md text-[10px] font-medium flex items-center gap-1 transition-colors cursor-pointer"
                                >
                                  <MessageSquare className="w-3 h-3 text-slate-600" />
                                  <span>Analyze in Chat</span>
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCopyText(segment);
                                }}
                                className="p-1 text-slate-400 hover:text-slate-700 rounded cursor-pointer"
                                title="Copy clause"
                              >
                                {copiedSegmentId === segment.id ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* PANEL 2: ORIGINAL CONTRACT DOCUMENT WITH GREEN HIGHLIGHT BOX (ZERO DOWNLOADS) */}
          {(layoutMode === "split" || layoutMode === "original") && document.file_type === "pdf" && (
            <div
              className={`flex-1 flex flex-col space-y-4 ${
                layoutMode === "split" ? "max-w-2xl min-w-[340px]" : "max-w-3xl mx-auto"
              }`}
            >
              {/* Header Badge */}
              <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex items-center justify-between shadow-2xs">
                <div>
                  <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Original Contract Document (Referenced Source)</span>
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Direct high-resolution render. Clauses highlight in a green box.
                  </p>
                </div>
                <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  Zero Downloads
                </span>
              </div>

              {/* Native Original Rendered Page Image with Green Bounding Box Overlay */}
              <div
                ref={originalOverlayRef}
                className="relative mx-auto bg-white shadow-md rounded-lg overflow-visible border border-slate-300 w-full"
                style={{
                  maxWidth: `${Math.round(750 * (zoomPercent / 100))}px`,
                }}
              >
                <img
                  src={getPageImageUrl(document.id, currentPage)}
                  alt={`Original Contract Page ${currentPage}`}
                  className="w-full h-auto block select-none rounded-lg"
                />

                {/* Interactive Bounding Box Overlay Layer */}
                <div className="absolute inset-0 z-20 pointer-events-auto">
                  {pageSegments.map((segment) => {
                    let bbox: number[] | null = null;
                    if (segment.bbox_json) {
                      try {
                        bbox = JSON.parse(segment.bbox_json);
                      } catch (e) {}
                    }
                    if (!bbox || bbox.length < 4) return null;

                    const pw = pageInfo?.width || 595;
                    const ph = pageInfo?.height || 842;
                    const left = (bbox[0] / pw) * 100;
                    const top = (bbox[1] / ph) * 100;
                    const width = ((bbox[2] - bbox[0]) / pw) * 100;
                    const height = Math.max(1.8, ((bbox[3] - bbox[1]) / ph) * 100);

                    const isSelected = activeSegment?.id === segment.id;

                    return (
                      <div
                        key={segment.id}
                        onClick={() => handleSelectSegment(segment)}
                        className={`absolute transition-all duration-150 cursor-pointer ${
                          isSelected
                            ? "z-40 border-2 border-emerald-500 bg-emerald-500/25 rounded-xs shadow-[0_0_14px_rgba(16,185,129,0.5)] ring-1 ring-emerald-500"
                            : "z-10 hover:border hover:border-emerald-400 hover:bg-emerald-500/10 rounded-xs"
                        }`}
                        style={{
                          left: `${left}%`,
                          top: `${top}%`,
                          width: `${width}%`,
                          height: `${height}%`,
                        }}
                        title={segment.section_title || segment.text.slice(0, 80)}
                      >
                        {/* Floating Pubblebox above the green highlight box on the original document */}
                        {isSelected && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="absolute -top-14 left-0 z-50 bg-white border border-slate-300 rounded-xl px-3.5 py-2 shadow-xl flex items-center gap-3 text-xs text-slate-900 pubblebox-arrow-bottom whitespace-nowrap animate-in fade-in zoom-in-95 duration-100"
                          >
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                              <div className="leading-tight">
                                <span className="font-bold text-slate-900 block text-[11px] truncate max-w-[200px]">
                                  {segment.section_title || `Clause Block #${segment.paragraph_index ?? 0}`}
                                </span>
                                <span className="text-[10px] font-mono text-slate-500">
                                  [{segment.start_offset}..{segment.end_offset}] • {segment.end_offset - segment.start_offset} chars
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 border-l border-slate-200 pl-2">
                              {onAskAboutClause && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onAskAboutClause(segment.text);
                                  }}
                                  className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-md text-[10px] font-medium flex items-center gap-1 transition-colors cursor-pointer"
                                  title="Analyze this clause in Chat"
                                >
                                  <MessageSquare className="w-3 h-3 text-slate-600" />
                                  <span>Analyze in Chat</span>
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCopyText(segment);
                                }}
                                className="p-1 text-slate-400 hover:text-slate-700 rounded cursor-pointer"
                                title="Copy verbatim clause"
                              >
                                {copiedSegmentId === segment.id ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveSegment(null);
                                }}
                                className="p-1 text-slate-400 hover:text-slate-700 rounded ml-0.5 cursor-pointer"
                                title="Close box popup"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ONBOARDING DISCOVERY TIP: Clean, friendly light card */}
      {showOnboardingTip && (
        <div className="fixed bottom-6 right-6 z-50 max-w-sm bg-white border border-slate-300 rounded-xl p-5 shadow-xl animate-in fade-in slide-in-from-bottom-5 duration-200 text-slate-900">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
                <MousePointerClick className="w-4 h-4 text-emerald-600" />
              </div>
              <h4 className="font-semibold text-sm text-slate-900">
                Interactive Text Navigation
              </h4>
            </div>
            <button
              onClick={handleDismissOnboardingTip}
              className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed">
            Click directly on any extracted clause card! It will automatically refer to the original document page and highlight that exact passage in a <strong className="text-emerald-700">green box</strong> with zero downloads.
          </p>

          <div className="mt-4 flex justify-end">
            <button
              onClick={handleDismissOnboardingTip}
              className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg shadow-2xs transition-colors cursor-pointer"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
