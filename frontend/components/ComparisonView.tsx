"use client";

import React, { useState, useEffect } from "react";
import { DocumentItem, ComparisonResponse, ComparisonItem, Citation } from "@/lib/types";
import { compareDocuments, createAmendmentDemo } from "@/lib/api";
import {
  GitCompare,
  AlertOctagon,
  AlertTriangle,
  Info,
  CheckCircle2,
  ArrowRight,
  Filter,
  DollarSign,
  FileText,
  Loader2,
  PlusCircle,
  MinusCircle,
  Edit3,
  Sparkles,
  Upload,
  ShieldAlert,
  Layers,
  ArrowUpRight
} from "lucide-react";

interface ComparisonViewProps {
  documents: DocumentItem[];
  onNavigateCitation: (citation: Citation) => void;
  onDocumentAdded?: (newDoc: DocumentItem) => void;
  onOpenUploadModal?: () => void;
}

export const ComparisonView: React.FC<ComparisonViewProps> = ({
  documents,
  onNavigateCitation,
  onDocumentAdded,
  onOpenUploadModal,
}) => {
  const [baseDocId, setBaseDocId] = useState<string>(documents[0]?.id || "");
  const [targetDocId, setTargetDocId] = useState<string>(
    documents[1]?.id || (documents.length > 1 ? documents[1].id : "")
  );
  const [loading, setLoading] = useState<boolean>(false);
  const [generatingDemo, setGeneratingDemo] = useState<boolean>(false);
  const [comparison, setComparison] = useState<ComparisonResponse | null>(null);
  const [filterSignificance, setFilterSignificance] = useState<string>("all");
  const [filterNumericOnly, setFilterNumericOnly] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-align distinct documents when list changes
  useEffect(() => {
    if (documents.length >= 2) {
      if (!baseDocId || !documents.some(d => d.id === baseDocId)) {
        setBaseDocId(documents[0].id);
      }
      if (!targetDocId || targetDocId === baseDocId || !documents.some(d => d.id === targetDocId)) {
        const other = documents.find(d => d.id !== (baseDocId || documents[0].id));
        if (other) setTargetDocId(other.id);
      }
    } else if (documents.length === 1) {
      setBaseDocId(documents[0].id);
      setTargetDocId("");
    }
  }, [documents, baseDocId]);

  const handleCompare = async (bId = baseDocId, tId = targetDocId) => {
    if (!bId || !tId) {
      setError("Please select both a baseline and a revised contract to compare.");
      return;
    }
    if (bId === tId) {
      setError("Please select two distinct contracts to compare (e.g. Baseline Agreement vs. Amended Version).");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await compareDocuments(bId, tId);
      setComparison(res);
    } catch (err: any) {
      setError(err.message || "Failed to compare contracts");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateAmendedDemo = async () => {
    if (documents.length === 0) return;
    const base = documents[0];
    setGeneratingDemo(true);
    setError(null);
    try {
      const newDoc = await createAmendmentDemo(base.id);
      if (onDocumentAdded) {
        onDocumentAdded(newDoc);
      }
      setBaseDocId(base.id);
      setTargetDocId(newDoc.id);
      // Auto run comparison between the baseline and newly generated amendment
      setTimeout(() => {
        handleCompare(base.id, newDoc.id);
      }, 500);
    } catch (err: any) {
      setError(err.message || "Failed to generate amended contract demo.");
    } finally {
      setGeneratingDemo(false);
    }
  };

  const filteredItems = comparison?.items.filter((item) => {
    if (filterNumericOnly && !item.is_numeric_change) return false;
    if (filterSignificance !== "all" && item.significance !== filterSignificance) return false;
    return true;
  }) || [];

  return (
    <div className="flex-1 flex flex-col h-full bg-obsidian-950/95 overflow-y-auto p-6 space-y-6 text-slate-100">
      {/* Informative Guidance Banner if less than 2 documents are present */}
      {documents.length < 2 && (
        <div className="relative overflow-hidden rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-obsidian-900 via-obsidian-900/90 to-emerald-950/40 p-6 shadow-2xl backdrop-blur-xl">
          <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
            <div className="space-y-2 max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Dual-Contract Redline Engine</span>
              </div>
              <h2 className="text-xl font-bold text-white tracking-tight">
                Comparison Requires Two Contract Versions
              </h2>
              <p className="text-xs text-slate-300 leading-relaxed">
                You currently have <span className="font-semibold text-emerald-400">{documents.length} document</span> in your library. Contract comparison performs automated clause-by-clause alignment between an <span className="text-white font-medium">Original Baseline</span> and a <span className="text-white font-medium">Revised Target</span> contract, detecting numerical shifts (e.g. indemnity caps, payment terms), risk changes, and deletions.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0">
              {documents.length === 1 && (
                <button
                  onClick={handleGenerateAmendedDemo}
                  disabled={generatingDemo}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-obsidian-950 text-xs font-bold shadow-lg shadow-emerald-500/20 transition-all active:scale-95 disabled:opacity-50"
                >
                  {generatingDemo ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Synthesizing Redline Revision...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Generate Sample Revised Version (1-Click)</span>
                    </>
                  )}
                </button>
              )}

              {onOpenUploadModal && (
                <button
                  onClick={onOpenUploadModal}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-obsidian-800 hover:bg-obsidian-700 border border-obsidian-700 text-slate-200 text-xs font-semibold transition-all active:scale-95"
                >
                  <Upload className="w-4 h-4 text-cyan-400" />
                  <span>Upload 2nd Contract</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Contract Version Selector Panel */}
      <div className="bg-obsidian-900/80 border border-obsidian-800 rounded-2xl p-6 shadow-xl backdrop-blur-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <GitCompare className="w-4 h-4 text-emerald-400" />
            <span>Clause-Level Contract Version Comparison</span>
          </h3>
          <span className="text-[11px] font-mono text-slate-400 px-2.5 py-1 bg-obsidian-800/80 border border-obsidian-700/60 rounded-full">
            {documents.length} Contracts Available
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Baseline Contract Selector */}
          <div className="bg-obsidian-950/60 border border-obsidian-800 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-rose-300 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
                Baseline Contract (Original)
              </label>
              <span className="text-[10px] text-slate-500 font-mono">Reference</span>
            </div>
            <select
              value={baseDocId}
              onChange={(e) => setBaseDocId(e.target.value)}
              disabled={documents.length === 0}
              className="w-full text-xs p-2.5 bg-obsidian-900 border border-obsidian-700/80 rounded-lg focus:outline-none focus:border-emerald-500 text-slate-200 font-medium cursor-pointer"
            >
              {documents.length === 0 ? (
                <option value="">No contracts uploaded yet</option>
              ) : (
                documents.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.filename} ({d.page_count || 1} pages)
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Revised Contract Selector */}
          <div className="bg-obsidian-950/60 border border-obsidian-800 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-emerald-300 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                Revised Contract (Target / Redline)
              </label>
              <span className="text-[10px] text-slate-500 font-mono">Amendments</span>
            </div>
            <select
              value={targetDocId}
              onChange={(e) => setTargetDocId(e.target.value)}
              disabled={documents.length < 2}
              className="w-full text-xs p-2.5 bg-obsidian-900 border border-obsidian-700/80 rounded-lg focus:outline-none focus:border-emerald-500 text-slate-200 font-medium cursor-pointer disabled:opacity-50"
            >
              {documents.length < 2 ? (
                <option value="">Upload or generate a 2nd contract to compare</option>
              ) : (
                documents.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.filename} ({d.page_count || 1} pages)
                  </option>
                ))
              )}
            </select>
          </div>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs rounded-xl flex items-center gap-2.5">
            <AlertOctagon className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-obsidian-800/60">
          <div className="text-[11px] text-slate-400 flex items-center gap-2">
            <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
            <span>Detects monetary discrepancies, liability shift, and clause omissions</span>
          </div>

          <button
            onClick={() => handleCompare()}
            disabled={loading || documents.length < 2 || baseDocId === targetDocId}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 disabled:from-obsidian-800 disabled:to-obsidian-800 disabled:text-slate-500 text-obsidian-950 text-xs font-bold rounded-xl shadow-lg shadow-emerald-500/10 transition-all active:scale-95 cursor-pointer disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-obsidian-950" />
                <span>Aligning & Analyzing Clauses...</span>
              </>
            ) : (
              <>
                <GitCompare className="w-4 h-4 text-obsidian-950" />
                <span>Run Version Comparison</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Comparison Results Area */}
      {comparison && (
        <div className="space-y-4">
          {/* Summary Metric Header */}
          <div className="bg-gradient-to-br from-obsidian-900 to-obsidian-950 border border-obsidian-800 rounded-2xl p-5 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <h4 className="text-base font-bold text-white tracking-tight">
                  Comparison Summary & Risk Audit
                </h4>
              </div>
              <p className="text-xs text-slate-300 mt-1.5 max-w-2xl leading-relaxed">
                {comparison.summary}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <span className="px-3 py-1.5 bg-rose-500/15 border border-rose-500/30 rounded-xl text-xs font-bold text-rose-300 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                {comparison.items.filter((i) => i.significance === "critical").length} Critical
              </span>
              <span className="px-3 py-1.5 bg-amber-500/15 border border-amber-500/30 rounded-xl text-xs font-bold text-amber-300 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                {comparison.items.filter((i) => i.is_numeric_change).length} Numeric Shifts
              </span>
              <span className="px-3 py-1.5 bg-cyan-500/15 border border-cyan-500/30 rounded-xl text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5" />
                {comparison.items.length} Total Clauses Analyzed
              </span>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-obsidian-900/60 p-3.5 border border-obsidian-800 rounded-xl text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 text-slate-400 font-semibold mr-1">
                <Filter className="w-3.5 h-3.5 text-cyan-400" />
                <span>Significance:</span>
              </div>
              {(["all", "critical", "high", "medium", "low"] as const).map((sig) => (
                <button
                  key={sig}
                  onClick={() => setFilterSignificance(sig)}
                  className={`px-3 py-1 rounded-lg capitalize font-medium text-xs transition-all ${
                    filterSignificance === sig
                      ? "bg-emerald-500 text-obsidian-950 font-bold shadow-md shadow-emerald-500/20"
                      : "bg-obsidian-800 text-slate-300 hover:bg-obsidian-700 hover:text-white"
                  }`}
                >
                  {sig}
                </button>
              ))}
            </div>

            <button
              onClick={() => setFilterNumericOnly(!filterNumericOnly)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-medium text-xs transition-all ${
                filterNumericOnly
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                  : "bg-obsidian-800 text-slate-300 hover:bg-obsidian-700"
              }`}
            >
              <DollarSign className="w-3.5 h-3.5 text-amber-400" />
              <span>Numeric Changes Only</span>
            </button>
          </div>

          {/* Clauses Differences List */}
          <div className="space-y-4">
            {filteredItems.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-xs bg-obsidian-900/40 rounded-2xl border border-obsidian-800">
                No clause changes matching active filters.
              </div>
            ) : (
              filteredItems.map((item) => (
                <div
                  key={item.id}
                  className="bg-obsidian-900/80 border border-obsidian-800 hover:border-obsidian-700 rounded-2xl p-5 shadow-xl space-y-4 transition-all"
                >
                  {/* Item Header */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-obsidian-800/80 pb-3">
                    <h5 className="font-bold text-sm text-white flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                      {item.clause_name}
                    </h5>

                    <div className="flex items-center gap-2">
                      {/* Change Type Badge */}
                      <span
                        className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${
                          item.change_type === "added"
                            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                            : item.change_type === "removed"
                            ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                            : "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                        }`}
                      >
                        {item.change_type === "added" && <PlusCircle className="w-3 h-3" />}
                        {item.change_type === "removed" && <MinusCircle className="w-3 h-3" />}
                        {item.change_type === "modified" && <Edit3 className="w-3 h-3" />}
                        <span>{item.change_type}</span>
                      </span>

                      {/* Significance Badge */}
                      <span
                        className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                          item.significance === "critical"
                            ? "bg-rose-500 text-obsidian-950 font-black shadow-sm shadow-rose-500/30"
                            : item.significance === "high"
                            ? "bg-amber-500 text-obsidian-950 font-bold"
                            : item.significance === "medium"
                            ? "bg-sky-500/20 text-sky-300 border border-sky-500/30"
                            : "bg-slate-800 text-slate-400"
                        }`}
                      >
                        {item.significance}
                      </span>

                      {/* Numeric shift callout */}
                      {item.is_numeric_change && (
                        <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          Numeric Shift
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Plain Language Substantive Legal Explanation */}
                  <div className="text-xs text-slate-200 font-medium leading-relaxed bg-obsidian-950/80 p-3.5 rounded-xl border border-obsidian-800">
                    <span className="font-bold text-emerald-400 block mb-1">
                      Substantive Legal Analysis:
                    </span>
                    {item.explanation}
                  </div>

                  {/* Side-by-side Text Comparison */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    {/* Original Baseline */}
                    <div className="p-4 bg-rose-950/15 border border-rose-900/40 rounded-xl space-y-2">
                      <div className="flex items-center justify-between text-[11px] font-semibold text-rose-300">
                        <span className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                          Original Baseline {item.base_page ? `(Page ${item.base_page})` : ""}
                        </span>
                        {item.base_citation && (
                          <button
                            onClick={() => onNavigateCitation(item.base_citation!)}
                            className="text-[10px] text-rose-400 hover:text-rose-200 underline flex items-center gap-0.5 transition-colors"
                          >
                            <span>Inspect Source</span>
                            <ArrowUpRight className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                      <p className="text-slate-300 font-mono text-[11px] leading-relaxed line-clamp-6">
                        {item.original_text || "— Clause was not present in baseline contract —"}
                      </p>
                    </div>

                    {/* Revised Target */}
                    <div className="p-4 bg-emerald-950/15 border border-emerald-900/40 rounded-xl space-y-2">
                      <div className="flex items-center justify-between text-[11px] font-semibold text-emerald-300">
                        <span className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          Revised Target {item.target_page ? `(Page ${item.target_page})` : ""}
                        </span>
                        {item.target_citation && (
                          <button
                            onClick={() => onNavigateCitation(item.target_citation!)}
                            className="text-[10px] text-emerald-400 hover:text-emerald-200 underline flex items-center gap-0.5 transition-colors"
                          >
                            <span>Inspect Source</span>
                            <ArrowUpRight className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                      <p className="text-slate-300 font-mono text-[11px] leading-relaxed line-clamp-6">
                        {item.revised_text || "— Clause removed in revised contract —"}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
