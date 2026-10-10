"use client";

import React, { useState, useRef, useEffect } from "react";
import { DocumentItem, Citation, AgentRunState } from "../lib/types";
import { streamResearch } from "../lib/api";
import {
  Sparkles,
  Play,
  Square,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  FileText,
  Layers,
  Loader2,
  Terminal,
  ArrowUpRight,
  CheckCircle2
} from "lucide-react";

interface ResearchAgentViewProps {
  documents: DocumentItem[];
  selectedDocIds: string[];
  onNavigateCitation: (citation: Citation) => void;
}

export const ResearchAgentView: React.FC<ResearchAgentViewProps> = ({
  documents,
  selectedDocIds,
  onNavigateCitation,
}) => {
  const [query, setQuery] = useState<string>("");
  const [maxRounds, setMaxRounds] = useState<number>(6);
  const [agentState, setAgentState] = useState<AgentRunState>({
    query: "",
    status: "idle",
    currentRound: 0,
    toolCalls: [],
    citations: [],
    finalAnswer: "",
  });
  const [expandedToolIndex, setExpandedToolIndex] = useState<number | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const timelineEndRef = useRef<HTMLDivElement>(null);

  const activeDocIds = selectedDocIds.length > 0 ? selectedDocIds : documents.map((d) => d.id);

  const sampleResearchQueries = [
    "Investigate all liability limits, carve-outs, and consequential damages disclaimers across the contract.",
    "Examine the payment milestones, invoicing terms, and any accompanying early termination penalty fees.",
    "Audit whether this contract permits unilateral assignment or change of control without prior written consent.",
    "Evaluate all indemnification obligations and cross-reference against the limitation of liability cap."
  ];

  const handleStartResearch = async () => {
    if (!query.trim() || agentState.status === "running") return;
    if (activeDocIds.length === 0) return;

    abortControllerRef.current = new AbortController();

    setAgentState({
      query: query.trim(),
      status: "running",
      statusMessage: "Initializing agent tool suite...",
      currentRound: 0,
      toolCalls: [],
      citations: [],
      finalAnswer: "",
    });

    try {
      await streamResearch(
        query.trim(),
        activeDocIds,
        maxRounds,
        {
          onStatus: (message, round) => {
            setAgentState((prev) => ({
              ...prev,
              statusMessage: message,
              currentRound: round,
            }));
          },
          onToolCall: (tc) => {
            setAgentState((prev) => ({
              ...prev,
              toolCalls: [...prev.toolCalls, tc],
            }));
          },
          onToolResult: (toolName, summary, data) => {
            setAgentState((prev) => {
              const updated = [...prev.toolCalls];
              if (updated.length > 0) {
                const last = updated[updated.length - 1];
                if (last.tool_name === toolName) {
                  last.result_summary = summary;
                  last.raw_result = data;
                }
              }
              return { ...prev, toolCalls: updated };
            });
          },
          onCitations: (cites) => {
            setAgentState((prev) => ({
              ...prev,
              citations: cites,
            }));
          },
          onDone: (finalAnswer, citations, toolCalls) => {
            setAgentState((prev) => ({
              ...prev,
              status: "completed",
              statusMessage: "Autonomous research concluded successfully.",
              finalAnswer,
              citations: citations || prev.citations,
              toolCalls: toolCalls && toolCalls.length > 0 ? toolCalls : prev.toolCalls,
            }));
          },
          onError: (err) => {
            setAgentState((prev) => ({
              ...prev,
              status: "failed",
              statusMessage: `Agent execution encountered an error: ${err}`,
            }));
          },
        },
        abortControllerRef.current.signal
      );
    } catch (err: any) {
      if (err.name !== "AbortError") {
        setAgentState((prev) => ({
          ...prev,
          status: "failed",
          statusMessage: err.message || "Research failed",
        }));
      }
    }
  };

  const handleStopResearch = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setAgentState((prev) => ({
      ...prev,
      status: "stopped",
      statusMessage: "Research stopped by user.",
    }));
  };

  useEffect(() => {
    timelineEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [agentState.toolCalls, agentState.statusMessage]);

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 text-slate-800 overflow-y-auto p-6 space-y-6">
      {/* Banner Context */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
          <div className="space-y-1 max-w-2xl">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700">
              <Sparkles className="w-3 h-3 text-emerald-600" />
              <span>Autonomous Agentic Contract Research</span>
            </span>
            <h3 className="text-base font-bold text-slate-900 tracking-tight">
              Model-Driven Multi-Round Tool Calling
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              The AI model iteratively decides which contract inspection tools to invoke (<code>search_document</code>, <code>get_section</code>, <code>list_clauses</code>, <code>get_document_overview</code>) before synthesizing a verifiable legal conclusion.
            </p>
          </div>
          <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600 font-mono shrink-0">
            <Layers className="w-3.5 h-3.5 text-slate-500" />
            <span>Scope: {activeDocIds.length} Contract(s)</span>
          </div>
        </div>
      </div>

      {/* Query Formulation Input Box */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Legal Research Directive
          </label>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={agentState.status === "running"}
            placeholder="Specify the legal question or clause analysis objective..."
            className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-slate-400 focus:bg-white font-medium text-slate-900 placeholder-slate-400 disabled:opacity-50 transition-colors shadow-2xs"
          />
        </div>

        {/* Suggested Queries */}
        <div className="space-y-1.5">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider font-mono">
            Sample Directives
          </span>
          <div className="flex flex-wrap gap-1.5">
            {sampleResearchQueries.map((sq, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setQuery(sq)}
                className="text-left text-[11px] px-2.5 py-1 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-md font-medium transition-colors border border-slate-200 cursor-pointer"
              >
                "{sq.slice(0, 52)}..."
              </button>
            ))}
          </div>
        </div>

        {/* Controls: Max Rounds & Launch Button */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-slate-100">
          <div className="flex items-center gap-3 text-xs text-slate-600">
            <span className="font-semibold">Max Execution Rounds:</span>
            <div className="flex items-center gap-1">
              {[2, 4, 6].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setMaxRounds(num)}
                  disabled={agentState.status === "running"}
                  className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors cursor-pointer ${
                    maxRounds === num
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {num} Rounds
                </button>
              ))}
            </div>
            <span className="text-[11px] text-slate-400 font-mono">
              (Safety limit: 6)
            </span>
          </div>

          <div className="flex items-center gap-2">
            {agentState.status === "running" ? (
              <button
                type="button"
                onClick={handleStopResearch}
                className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>Cancel Research</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStartResearch}
                disabled={!query.trim() || documents.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer disabled:cursor-not-allowed"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Launch Autonomous Research</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Real-Time Agent Execution Console & Tool Timeline */}
      {agentState.status !== "idle" && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 text-white shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-emerald-400" />
                <h4 className="text-xs font-bold font-mono uppercase tracking-wider text-slate-200">
                  Agent Execution Console
                </h4>
              </div>

              <div className="flex items-center gap-2 font-mono">
                {agentState.status === "running" ? (
                  <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-200 border border-slate-700">
                    <Loader2 className="w-3 h-3 animate-spin text-emerald-400" />
                    <span>Round {agentState.currentRound} Active</span>
                  </span>
                ) : (
                  <span
                    className={`px-2.5 py-0.5 rounded text-[10px] font-semibold uppercase ${
                      agentState.status === "completed"
                        ? "bg-emerald-900/60 text-emerald-300 border border-emerald-700"
                        : "bg-rose-900/60 text-rose-300 border border-rose-700"
                    }`}
                  >
                    {agentState.status}
                  </span>
                )}
              </div>
            </div>

            {/* Status Message */}
            {agentState.statusMessage && (
              <div className="text-xs font-mono text-slate-300 bg-slate-950/80 p-3 rounded-lg border border-slate-800 flex items-center gap-2">
                <span className="text-emerald-400 font-bold">&gt;</span>
                <span>{agentState.statusMessage}</span>
              </div>
            )}

            {/* Model Tool Invocations Timeline */}
            <div className="space-y-2 pt-1">
              <span className="text-[10px] font-mono uppercase text-slate-500 font-bold tracking-wider">
                Model Tool Invocations ({agentState.toolCalls.length})
              </span>

              {agentState.toolCalls.length === 0 ? (
                <div className="text-xs font-mono text-slate-500 italic p-3 bg-slate-950/40 rounded-lg border border-slate-800">
                  Awaiting model directives...
                </div>
              ) : (
                agentState.toolCalls.map((tc, idx) => {
                  const isExpanded = expandedToolIndex === idx;

                  return (
                    <div
                      key={idx}
                      className="bg-slate-950/90 border border-slate-800 rounded-lg p-3 space-y-2 font-mono text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] font-bold">
                            Round {tc.round_number}
                          </span>
                          <span className="text-emerald-400 font-bold">
                            {tc.tool_name}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => setExpandedToolIndex(isExpanded ? null : idx)}
                          className="text-slate-400 hover:text-white flex items-center gap-1 text-[10px] cursor-pointer"
                        >
                          <span>{isExpanded ? "Collapse" : "Inspect Payload"}</span>
                          {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>
                      </div>

                      {/* Arguments snippet */}
                      <div className="text-slate-400 text-[11px]">
                        <span className="text-slate-500">Params: </span>
                        <code>{JSON.stringify(tc.arguments)}</code>
                      </div>

                      {/* Result summary */}
                      {tc.result_summary && (
                        <div className="text-emerald-300 text-[11px] pt-1 border-t border-slate-800">
                          <span className="text-slate-500">Output: </span>
                          <span>{tc.result_summary}</span>
                        </div>
                      )}

                      {/* Expandable full tool result */}
                      {isExpanded && tc.raw_result && (
                        <div className="mt-2 p-2.5 bg-slate-900 rounded border border-slate-800 text-[10px] text-slate-300 overflow-x-auto max-h-48 overflow-y-auto">
                          <pre>{JSON.stringify(tc.raw_result, null, 2)}</pre>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
            <div ref={timelineEndRef} />
          </div>

          {/* Final Synthesized Legal Answer Card */}
          {agentState.finalAnswer && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-600" />
                  <h4 className="text-sm font-bold text-slate-900 tracking-tight">
                    Synthesized Legal Research Findings
                  </h4>
                </div>
                <span className="text-xs text-slate-400 font-mono">
                  Verified Quotations
                </span>
              </div>

              <div className="text-sm leading-relaxed text-slate-800 whitespace-pre-wrap font-serif">
                {agentState.finalAnswer}
              </div>

              {/* Verified Supporting Citations */}
              {agentState.citations && agentState.citations.length > 0 && (
                <div className="pt-4 border-t border-slate-100 space-y-2">
                  <h5 className="text-xs font-bold text-slate-700 flex items-center gap-1.5 font-mono">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Verified Authoritative Quotations ({agentState.citations.length})</span>
                  </h5>

                  <div className="grid grid-cols-1 gap-2">
                    {agentState.citations.map((cite, cIdx) => (
                      <div
                        key={cIdx}
                        onClick={() => onNavigateCitation(cite)}
                        className="p-3 bg-emerald-50/50 hover:bg-emerald-50 border border-emerald-200 rounded-lg text-xs cursor-pointer transition-colors"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-slate-800 truncate max-w-sm flex items-center gap-1.5">
                            <FileText className="w-3.5 h-3.5 text-slate-400" />
                            <span>{cite.document_title} • Page {cite.page_number || 1}</span>
                          </span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                            100% Verbatim Match
                          </span>
                        </div>
                        <p className="italic text-slate-800 font-serif line-clamp-3">
                          "{cite.quote}"
                        </p>
                        <div className="mt-1.5 flex items-center justify-end text-[10px] text-emerald-700 font-mono">
                          <span className="flex items-center gap-0.5 hover:underline">
                            <span>Inspect Source</span>
                            <ArrowUpRight className="w-3 h-3" />
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
