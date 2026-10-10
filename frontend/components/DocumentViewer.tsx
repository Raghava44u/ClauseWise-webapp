"use client";

import React, { useState, useEffect, useRef } from "react";
import { DocumentItem, DocumentSegment, Citation, ClauseInfo } from "@/lib/types";
import { getPageImageUrl, getPageInfo } from "@/lib/api";
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
  ArrowRight
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
  const [zoomPercent, setZoomPercent] = useState<number>(100);
  const [showOutline, setShowOutline] = useState<boolean>(true);
  const [viewMode, setViewMode] = useState<"original" | "structured">("original");

  // Page Dimensions for Bounding Box Overlay Mapping
  const [pageInfo, setPageInfo] = useState<{ width: number; height: number } | null>(null);

  // Interactive Clicked Segment State
  const [activeSegment, setActiveSegment] = useState<DocumentSegment | null>(null);
  const [copiedSegmentId, setCopiedSegmentId] = useState<string | null>(null);

  // Onboarding Popover State (5s after preprocess, only once per account)
  const [showOnboardingTip, setShowOnboardingTip] = useState<boolean>(false);

  const segmentRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  const totalPages = document?.page_count || 1;

  // Fetch page dimensions for bounding box mapping
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

  const handleSwitchToOriginal = (seg: DocumentSegment) => {
    const p = seg.page_number || currentPage;
    setCurrentPage(p);
    setActiveSegment(seg);
    setViewMode("original");
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

        {/* View Mode Toggle, Zoom & Search */}
        <div className="flex items-center gap-3">
          {/* Mode Switcher: Original Document vs Structured Text */}
          {document.file_type === "pdf" && (
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
              <button
                onClick={() => setViewMode("original")}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer ${
                  viewMode === "original"
                    ? "bg-white text-slate-900 font-semibold shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
                title="View original contract page with interactive green clause highlight box"
              >
                <Eye className="w-3.5 h-3.5 text-emerald-600" />
                <span>Original Document</span>
              </button>
              <button
                onClick={() => setViewMode("structured")}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer ${
                  viewMode === "structured"
                    ? "bg-white text-slate-900 font-semibold shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
                title="View clean text layout"
              >
                <AlignLeft className="w-3.5 h-3.5 text-slate-600" />
                <span>Text View</span>
              </button>
            </div>
          )}

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
                    // Find corresponding segment
                    const match = segments.find(
                      (s) =>
                        (s.page_number === clause.page_number &&
                          s.section_title?.toLowerCase() === clause.title.toLowerCase()) ||
                        (s.start_offset <= clause.start_offset && s.end_offset >= clause.start_offset)
                    );
                    if (match) setActiveSegment(match);
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

        {/* Document Content View */}
        <div className="flex-1 overflow-y-auto p-8 flex justify-center bg-slate-100/60">
          {viewMode === "original" && document.file_type === "pdf" ? (
            /* MODE 1: ORIGINAL DOCUMENT PAGE WITH GREEN HIGHLIGHT BOX OVERLAY (ZERO DOWNLOADS) */
            <div
              className="relative mx-auto bg-white shadow-md rounded-lg overflow-visible border border-slate-300"
              style={{
                width: `${Math.round(750 * (zoomPercent / 100))}px`,
                maxWidth: "100%",
              }}
            >
              {/* Native Original Rendered Page Image */}
              <img
                src={getPageImageUrl(document.id, currentPage)}
                alt={`Original Document Page ${currentPage}`}
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
                      onClick={() => setActiveSegment(segment)}
                      className={`absolute transition-all duration-150 cursor-pointer ${
                        isSelected
                          ? "z-40 border-2 border-emerald-500 bg-emerald-500/25 rounded-xs shadow-[0_0_12px_rgba(16,185,129,0.5)]"
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
          ) : (
            /* MODE 2: STRUCTURED TEXT VIEW */
            <div
              className="w-full max-w-3xl bg-white shadow-xs border border-slate-200/80 rounded-xl p-10 space-y-6 text-slate-800 relative"
              style={{ fontSize: `${zoomPercent}%` }}
            >
              {/* Document Page Header */}
              <div className="border-b border-slate-200 pb-3 flex items-center justify-between text-xs text-slate-500">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                    {document.filename}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px] font-semibold border border-emerald-200">
                    Click text to inspect offsets
                  </span>
                </div>
                <span className="font-mono text-slate-400">Page {currentPage} of {totalPages}</span>
              </div>

              {pageSegments.length === 0 ? (
                <div className="text-center py-16 text-slate-400 text-xs">
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
                      onClick={() => setActiveSegment(segment)}
                      className={`text-segment-clickable relative transition-all duration-150 group ${
                        isActiveGreen
                          ? "text-segment-active-green"
                          : isHighlightedCitation
                          ? "citation-target-highlight bg-amber-50"
                          : ""
                      }`}
                    >
                      {/* BUBBLE BOX (PUBBLEBOX) POPOVER */}
                      {isActiveGreen && (
                        <div className="absolute -top-14 left-2 z-50 bg-white border border-slate-300 rounded-xl px-3.5 py-2 shadow-lg flex items-center gap-3 text-xs text-slate-900 pubblebox-arrow-bottom animate-in fade-in zoom-in-95 duration-100">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                            <div className="leading-tight">
                              <span className="font-bold text-slate-900 block text-[11px]">
                                {segment.section_title || `Clause Block #${segment.paragraph_index ?? 0}`}
                              </span>
                              <span className="text-[10px] font-mono text-slate-500">
                                Start: [{segment.start_offset}] • End: [{segment.end_offset}] • {segment.end_offset - segment.start_offset} chars
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 border-l border-slate-200 pl-2.5">
                            {document.file_type === "pdf" && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSwitchToOriginal(segment);
                                }}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-[10px] font-semibold flex items-center gap-1 shadow-2xs transition-colors cursor-pointer"
                                title="Highlight in green box on the original document page"
                              >
                                <Eye className="w-3 h-3" />
                                <span>Highlight on Original Page</span>
                              </button>
                            )}

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
                              title="Close popover"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      )}

                      {segment.section_title && (
                        <h4 className="font-bold text-slate-900 mb-1 text-sm tracking-tight flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                          <span>{segment.section_title}</span>
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
            Click directly on any clause on the original document! It will highlight in a <strong className="text-emerald-700">green box</strong> right over the text, display its exact character offset indexes <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-800 font-mono">[start..end]</code>, and let you analyze it in Chat without downloading.
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
