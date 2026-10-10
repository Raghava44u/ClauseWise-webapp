"use client";

import React, { useState } from "react";
import { DocumentItem, ComparisonResponse, ComparisonItem, Citation } from "@/lib/types";
import { compareDocuments } from "@/lib/api";
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
  Edit3
} from "lucide-react";

interface ComparisonViewProps {
  documents: DocumentItem[];
  onNavigateCitation: (citation: Citation) => void;
}

export const ComparisonView: React.FC<ComparisonViewProps> = ({
  documents,
  onNavigateCitation,
}) => {
  const [baseDocId, setBaseDocId] = useState<string>(documents[0]?.id || "");
  const [targetDocId, setTargetDocId] = useState<string>(documents[1]?.id || documents[0]?.id || "");
  const [loading, setLoading] = useState<boolean>(false);
  const [comparison, setComparison] = useState<ComparisonResponse | null>(null);
  const [filterSignificance, setFilterSignificance] = useState<string>("all");
  const [filterNumericOnly, setFilterNumericOnly] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleCompare = async () => {
    if (!baseDocId || !targetDocId) return;
    if (baseDocId === targetDocId) {
      setError("Please select two distinct contracts to compare.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await compareDocuments(baseDocId, targetDocId);
      setComparison(res);
    } catch (err: any) {
      setError(err.message || "Failed to compare contracts");
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = comparison?.items.filter((item) => {
    if (filterNumericOnly && !item.is_numeric_change) return false;
    if (filterSignificance !== "all" && item.significance !== filterSignificance) return false;
    return true;
  }) || [];

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 overflow-y-auto p-6 space-y-6">
      {/* Contract Version Selector Panel */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-3">
          <GitCompare className="w-4 h-4 text-navy-700" />
          <span>Clause-Level Contract Version Comparison</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Baseline Contract (Original)
            </label>
            <select
              value={baseDocId}
              onChange={(e) => setBaseDocId(e.target.value)}
              className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-navy-600 font-medium text-slate-800"
            >
              {documents.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.filename} ({d.page_count || 1} pages)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Revised Contract (Target)
            </label>
            <select
              value={targetDocId}
              onChange={(e) => setTargetDocId(e.target.value)}
              className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-navy-600 font-medium text-slate-800"
            >
              {documents.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.filename} ({d.page_count || 1} pages)
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && (
          <div className="mt-3 p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center gap-2">
            <AlertOctagon className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="mt-4 flex justify-end">
          <button
            onClick={handleCompare}
            disabled={loading || documents.length < 2}
            className="flex items-center gap-2 px-4 py-2 bg-navy-800 hover:bg-navy-900 disabled:bg-slate-200 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
          >
            {loading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Aligning & Analyzing Clauses...</span>
              </>
            ) : (
              <>
                <GitCompare className="w-3.5 h-3.5 text-sky-400" />
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
          <div className="bg-navy-900 text-white rounded-xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h4 className="text-base font-bold tracking-tight">
                Comparison Summary
              </h4>
              <p className="text-xs text-slate-300 mt-1 max-w-2xl">
                {comparison.summary}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="px-3 py-1.5 bg-rose-500/20 border border-rose-400/30 rounded-lg text-xs font-semibold text-rose-300">
                {comparison.items.filter((i) => i.significance === "critical").length} Critical
              </span>
              <span className="px-3 py-1.5 bg-amber-500/20 border border-amber-400/30 rounded-lg text-xs font-semibold text-amber-300">
                {comparison.items.filter((i) => i.is_numeric_change).length} Numeric Shifts
              </span>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 bg-white p-3 border border-slate-200 rounded-lg text-xs">
            <div className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <span className="font-semibold text-slate-600">Filter by Significance:</span>
              {(["all", "critical", "high", "medium", "low"] as const).map((sig) => (
                <button
                  key={sig}
                  onClick={() => setFilterSignificance(sig)}
                  className={`px-2.5 py-1 rounded capitalize font-medium transition-colors ${
                    filterSignificance === sig
                      ? "bg-navy-800 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {sig}
                </button>
              ))}
            </div>

            <button
              onClick={() => setFilterNumericOnly(!filterNumericOnly)}
              className={`flex items-center gap-1 px-3 py-1 rounded font-medium transition-colors ${
                filterNumericOnly
                  ? "bg-amber-100 text-amber-900 border border-amber-300"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              <DollarSign className="w-3.5 h-3.5 text-amber-600" />
              <span>Numeric Changes Only</span>
            </button>
          </div>

          {/* Clauses Differences List */}
          <div className="space-y-4">
            {filteredItems.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-xs bg-white rounded-xl border border-slate-200">
                No clause changes matching active filters.
              </div>
            ) : (
              filteredItems.map((item) => (
                <div
                  key={item.id}
                  className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3"
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
                  <p className="text-xs text-slate-700 font-medium leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-200">
                    <span className="font-bold text-navy-900 block mb-0.5">
                      Substantive Explanation:
                    </span>
                    {item.explanation}
                  </p>

                  {/* Side-by-side Text Comparison */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    {/* Original Baseline */}
                    <div className="p-3 bg-rose-50/40 border border-rose-200 rounded-lg space-y-1">
                      <div className="flex items-center justify-between text-[11px] font-semibold text-rose-800">
                        <span>Original Language {item.base_page ? `(Page ${item.base_page})` : ""}</span>
                        {item.base_citation && (
                          <button
                            onClick={() => onNavigateCitation(item.base_citation!)}
                            className="text-[10px] text-rose-700 underline hover:text-rose-900"
                          >
                            Inspect Source
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
                        <span>Revised Language {item.target_page ? `(Page ${item.target_page})` : ""}</span>
                        {item.target_citation && (
                          <button
                            onClick={() => onNavigateCitation(item.target_citation!)}
                            className="text-[10px] text-emerald-700 underline hover:text-emerald-900"
                          >
                            Inspect Source
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
