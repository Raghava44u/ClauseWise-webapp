"use client";

import React, { useState, useEffect } from "react";
import { DocumentItem, ComparisonResponse, Citation } from "@/lib/types";
import { compareDocuments, createAmendmentDemo } from "@/lib/api";
import {
  GitCompare,
  AlertOctagon,
  Filter,
  DollarSign,
  Loader2,
  PlusCircle,
  MinusCircle,
  Edit3,
  Sparkles,
  Upload,
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
      if (!baseDocId || !documents.some((d) => d.id === baseDocId)) {
        setBaseDocId(documents[0].id);
      }
      if (!targetDocId || targetDocId === baseDocId || !documents.some((d) => d.id === targetDocId)) {
        const other = documents.find((d) => d.id !== (baseDocId || documents[0].id));
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
    <div className="flex-1 flex flex-col h-full bg-slate-50 overflow-y-auto p-6 space-y-6 text-slate-800">
      {/* Guidance Banner if less than 2 documents are present */}
      {documents.length < 2 && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-1 max-w-2xl">
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px] font-semibold">
              <Sparkles className="w-3 h-3 text-emerald-600" />
              <span>Contract Comparison Engine</span>
            </div>
            <h3 className="text-sm font-bold text-slate-900">
              Comparison Requires Two Contract Versions
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              You currently have <span className="font-semibold text-slate-800">{documents.length} document</span> in your library. Contract comparison performs automated clause-by-clause alignment between an <span className="font-medium text-slate-700">Original Baseline</span> and a <span className="font-medium text-slate-700">Revised / Amended Target</span> contract, detecting numerical shifts (indemnity caps, payment terms), risk changes, and deletions.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-2 shrink-0">
            {documents.length === 1 && (
              <button
                onClick={handleGenerateAmendedDemo}
                disabled={generatingDemo}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                {generatingDemo ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Generating Revision...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Generate Sample Revised Version (1-Click)</span>
                  </>
                )}
              </button>
            )}

            {onOpenUploadModal && (
              <button
                onClick={onOpenUploadModal}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-medium transition-colors cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5 text-slate-500" />
                <span>Upload 2nd Contract</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Contract Version Selector Panel */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <GitCompare className="w-4 h-4 text-slate-700" />
            <span>Clause-Level Contract Version Comparison</span>
          </h3>
          <span className="text-[11px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
            {documents.length} Contracts in Library
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Baseline Contract Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 block">
              Baseline Contract (Original)
            </label>
            <select
              value={baseDocId}
              onChange={(e) => setBaseDocId(e.target.value)}
              disabled={documents.length === 0}
              className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-slate-400 text-slate-800 font-medium cursor-pointer"
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
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 block">
              Revised Contract (Target / Redline)
            </label>
            <select
              value={targetDocId}
              onChange={(e) => setTargetDocId(e.target.value)}
              disabled={documents.length < 2}
              className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-slate-400 text-slate-800 font-medium cursor-pointer disabled:opacity-50"
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
          <div className="mt-3 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center gap-2">
            <AlertOctagon className="w-4 h-4 shrink-0 text-rose-500" />
            <span>{error}</span>
          </div>
        )}

        <div className="mt-4 flex items-center justify-between pt-3 border-t border-slate-100">
          <p className="text-[11px] text-slate-500">
            Aligns clauses, detects monetary shifts, and flags critical legal changes.
          </p>

          <button
            onClick={() => handleCompare()}
            disabled={loading || documents.length < 2 || baseDocId === targetDocId}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Aligning & Analyzing Clauses...</span>
              </>
            ) : (
              <>
                <GitCompare className="w-3.5 h-3.5" />
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
          <div className="bg-slate-900 text-white rounded-xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h4 className="text-sm font-bold tracking-tight">
                Comparison Summary & Risk Audit
              </h4>
              <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                {comparison.summary}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <span className="px-2.5 py-1 bg-rose-500/20 border border-rose-400/30 rounded-md text-xs font-semibold text-rose-300">
                {comparison.items.filter((i) => i.significance === "critical").length} Critical
              </span>
              <span className="px-2.5 py-1 bg-amber-500/20 border border-amber-400/30 rounded-md text-xs font-semibold text-amber-300">
                {comparison.items.filter((i) => i.is_numeric_change).length} Numeric Shifts
              </span>
              <span className="px-2.5 py-1 bg-slate-800 border border-slate-700 rounded-md text-xs font-semibold text-slate-300">
                {comparison.items.length} Total Clauses Analyzed
              </span>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 border border-slate-200 rounded-lg text-xs shadow-2xs">
            <div className="flex flex-wrap items-center gap-1.5">
              <div className="flex items-center gap-1 text-slate-500 font-semibold mr-1">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <span>Significance:</span>
              </div>
              {(["all", "critical", "high", "medium", "low"] as const).map((sig) => (
                <button
                  key={sig}
                  onClick={() => setFilterSignificance(sig)}
                  className={`px-2.5 py-1 rounded text-xs capitalize font-medium transition-colors cursor-pointer ${
                    filterSignificance === sig
                      ? "bg-slate-900 text-white font-semibold"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {sig}
                </button>
              ))}
            </div>

            <button
              onClick={() => setFilterNumericOnly(!filterNumericOnly)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
                filterNumericOnly
                  ? "bg-amber-100 text-amber-900 border border-amber-300 font-semibold"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              <DollarSign className="w-3.5 h-3.5 text-amber-600" />
              <span>Numeric Changes Only</span>
            </button>
          </div>

          {/* Clauses Differences List */}
          <div className="space-y-3">
            {filteredItems.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-xs bg-white rounded-xl border border-slate-200">
                No clause changes matching active filters.
              </div>
            ) : (
              filteredItems.map((item) => (
                <div
                  key={item.id}
                  className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-3"
                >
                  {/* Item Header */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                    <h5 className="font-bold text-sm text-slate-900">
                      {item.clause_name}
                    </h5>

                    <div className="flex items-center gap-1.5">
                      {/* Change Type Badge */}
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${
                          item.change_type === "added"
                            ? "bg-emerald-100 text-emerald-800"
                            : item.change_type === "removed"
                            ? "bg-rose-100 text-rose-800"
                            : "bg-blue-100 text-blue-800"
                        }`}
                      >
                        {item.change_type === "added" && <PlusCircle className="w-3 h-3" />}
                        {item.change_type === "removed" && <MinusCircle className="w-3 h-3" />}
                        {item.change_type === "modified" && <Edit3 className="w-3 h-3" />}
                        <span>{item.change_type}</span>
                      </span>

                      {/* Significance Badge */}
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          item.significance === "critical"
                            ? "bg-rose-600 text-white"
                            : item.significance === "high"
                            ? "bg-amber-500 text-white"
                            : item.significance === "medium"
                            ? "bg-sky-100 text-sky-800"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {item.significance}
                      </span>

                      {/* Numeric shift callout */}
                      {item.is_numeric_change && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                          Numeric Shift
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Plain Language Substantive Legal Explanation */}
                  <div className="text-xs text-slate-700 font-medium leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-200">
                    <span className="font-bold text-slate-900 block mb-0.5">
                      Substantive Legal Analysis:
                    </span>
                    {item.explanation}
                  </div>

                  {/* Side-by-side Text Comparison */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    {/* Original Baseline */}
                    <div className="p-3 bg-rose-50/40 border border-rose-200 rounded-lg space-y-1">
                      <div className="flex items-center justify-between text-[11px] font-semibold text-rose-800">
                        <span>Original Baseline {item.base_page ? `(Page ${item.base_page})` : ""}</span>
                        {item.base_citation && (
                          <button
                            onClick={() => onNavigateCitation(item.base_citation!)}
                            className="text-[10px] text-rose-700 underline hover:text-rose-900 flex items-center gap-0.5 cursor-pointer"
                          >
                            <span>Inspect Source</span>
                            <ArrowUpRight className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                      <p className="text-slate-800 font-serif leading-relaxed line-clamp-6">
                        {item.original_text || "— Clause was not present in baseline contract —"}
                      </p>
                    </div>

                    {/* Revised Target */}
                    <div className="p-3 bg-emerald-50/40 border border-emerald-200 rounded-lg space-y-1">
                      <div className="flex items-center justify-between text-[11px] font-semibold text-emerald-800">
                        <span>Revised Target {item.target_page ? `(Page ${item.target_page})` : ""}</span>
                        {item.target_citation && (
                          <button
                            onClick={() => onNavigateCitation(item.target_citation!)}
                            className="text-[10px] text-emerald-700 underline hover:text-emerald-900 flex items-center gap-0.5 cursor-pointer"
                          >
                            <span>Inspect Source</span>
                            <ArrowUpRight className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                      <p className="text-slate-800 font-serif leading-relaxed line-clamp-6">
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
