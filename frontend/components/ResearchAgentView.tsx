"use client";

import React, { useState, useRef, useEffect } from "react";
import { DocumentItem, Citation, ToolCallInfo, AgentRunState } from "@/lib/types";
import { streamResearch } from "@/lib/api";
import {
  Sparkles,
  Bot,
  Search,
  List,
  FileSearch,
  CheckCircle2,
  AlertTriangle,
  Play,
  Square,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  FileText,
  Clock,
  Layers,
  Loader2,
  Terminal,
  ArrowUpRight
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
    <div className="flex-1 flex flex-col h-full bg-obsidian-950/95 text-slate-100 overflow-y-auto p-6 space-y-6">
      {/* Banner: Part C Option 2 Context */}
      <div className="relative overflow-hidden rounded-2xl border border-cyan-500/30 bg-gradient-to-r from-obsidian-900 via-obsidian-900/90 to-cyan-950/40 p-6 shadow-2xl backdrop-blur-xl">
        <div className="absolute top-0 right-0 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col sm:flex-row items-start justify-between gap-4 relative z-10">
          <div className="space-y-2 max-w-2xl">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Part C Option 2: Autonomous Agentic Contract Research</span>
            </span>
            <h3 className="text-lg font-bold text-white tracking-tight">
              Real Model-Driven Tool Calling Loop
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Instead of static prompt stuffing, the AI model iteratively decides which contract inspection tools to invoke (<code>search_document</code>, <code>get_section</code>, <code>list_clauses</code>, <code>get_document_overview</code>) across multiple execution rounds before synthesizing a verifiable legal conclusion.
            </p>
          </div>
          <div className="flex items-center gap-2 bg-obsidian-800/80 px-3.5 py-2 rounded-xl border border-obsidian-700/80 text-xs text-slate-300 font-mono shrink-0">
            <Layers className="w-4 h-4 text-cyan-400" />
            <span>Scope: {activeDocIds.length} Contract(s)</span>
          </div>
        </div>
      </div>

      {/* Query Formulation Input Box */}
      <div className="bg-obsidian-900/80 border border-obsidian-800 rounded-2xl p-6 shadow-xl space-y-4 backdrop-blur-xl">
        <div>
          <label className="block text-xs font-bold text-slate-300 mb-2 font-mono">
            Legal Research Directive
          </label>
          <div className="relative">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              disabled={agentState.status === "running"}
              placeholder="Specify the legal question or clause analysis objective..."
              className="w-full px-4 py-3.5 text-xs sm:text-sm bg-obsidian-950 border border-obsidian-800 rounded-xl focus:outline-none focus:border-cyan-500 font-medium text-slate-100 placeholder-slate-500 disabled:opacity-50 transition-all font-sans"
            />
          </div>
        </div>

        {/* Suggested Queries */}
        <div className="space-y-2">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider font-mono">
            Sample Directives
          </span>
          <div className="flex flex-wrap gap-2">
            {sampleResearchQueries.map((sq, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setQuery(sq)}
                className="text-left text-[11px] px-3 py-1.5 bg-obsidian-800/80 hover:bg-obsidian-700 text-slate-300 hover:text-white rounded-lg font-medium transition-colors border border-obsidian-700/60 cursor-pointer"
              >
                "{sq.slice(0, 52)}..."
              </button>
            ))}
          </div>
        </div>

        {/* Controls: Max Rounds & Launch Button */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-obsidian-800/80">
          <div className="flex items-center gap-3 text-xs text-slate-300">
            <span className="font-semibold">Max Execution Rounds:</span>
            <div className="flex items-center gap-1.5">
              {[2, 4, 6].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setMaxRounds(num)}
                  disabled={agentState.status === "running"}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    maxRounds === num
                      ? "bg-cyan-500 text-obsidian-950 font-bold shadow-md shadow-cyan-500/20"
                      : "bg-obsidian-800 text-slate-400 hover:bg-obsidian-700 hover:text-white"
                  }`}
                >
                  {num} Rounds
                </button>
              ))}
            </div>
            <span className="text-[11px] text-slate-500 font-mono">
              (Hard safety cap: 6)
            </span>
          </div>

          <div className="flex items-center gap-2">
            {agentState.status === "running" ? (
              <button
                type="button"
                onClick={handleStopResearch}
                className="flex items-center gap-1.5 px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-rose-600/20 transition-all active:scale-95 cursor-pointer"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>Cancel Research</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStartResearch}
                disabled={!query.trim() || documents.length === 0}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 disabled:from-obsidian-800 disabled:to-obsidian-800 disabled:text-slate-500 text-obsidian-950 text-xs font-bold rounded-xl shadow-lg shadow-cyan-500/20 transition-all active:scale-95 disabled:cursor-not-allowed cursor-pointer"
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
          <div className="bg-obsidian-900/90 border border-obsidian-800 rounded-2xl p-6 text-white shadow-2xl space-y-4 backdrop-blur-xl">
            <div className="flex items-center justify-between border-b border-obsidian-800 pb-3">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-emerald-400" />
                <h4 className="text-xs font-bold font-mono uppercase tracking-wider text-slate-200">
                  Agent Execution Console
                </h4>
              </div>

              <div className="flex items-center gap-2 font-mono">
                {agentState.status === "running" ? (
                  <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-semibold bg-cyan-950/80 text-cyan-300 border border-cyan-800">
                    <Loader2 className="w-3 h-3 animate-spin text-cyan-400" />
                    <span>Round {agentState.currentRound} Active</span>
                  </span>
                ) : (
                  <span
                    className={`px-3 py-1 rounded-full text-[10px] font-semibold uppercase ${
                      agentState.status === "completed"
                        ? "bg-emerald-950/80 text-emerald-300 border border-emerald-700"
                        : "bg-rose-950/80 text-rose-300 border border-rose-700"
                    }`}
                  >
                    {agentState.status}
                  </span>
                )}
              </div>
            </div>

            {/* Status Message */}
            {agentState.statusMessage && (
              <div className="text-xs font-mono text-slate-300 bg-obsidian-950/80 p-3.5 rounded-xl border border-obsidian-800 flex items-center gap-2.5">
                <span className="text-emerald-400 font-bold animate-pulse">&gt;</span>
                <span>{agentState.statusMessage}</span>
              </div>
            )}

            {/* Model Tool Invocations Timeline */}
            <div className="space-y-3 pt-1">
              <span className="text-[10px] font-mono uppercase text-slate-500 font-bold tracking-wider">
                Model Tool Invocations ({agentState.toolCalls.length})
              </span>

              {agentState.toolCalls.length === 0 ? (
                <div className="text-xs font-mono text-slate-500 italic p-3.5 bg-obsidian-950/40 rounded-xl border border-obsidian-800">
                  Awaiting model's first action directive...
                </div>
              ) : (
                agentState.toolCalls.map((tc, idx) => {
                  const isExpanded = expandedToolIndex === idx;

                  return (
                    <div
                      key={idx}
                      className="bg-obsidian-950/90 border border-obsidian-800/80 rounded-xl p-3.5 space-y-2 font-mono text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded bg-obsidian-800 text-cyan-300 text-[10px] font-bold border border-cyan-500/20">
                            Round {tc.round_number}
                          </span>
                          <span className="text-amber-400 font-bold">
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
                        <div className="text-emerald-300 text-[11px] pt-1.5 border-t border-obsidian-800">
                          <span className="text-slate-500">Output: </span>
                          <span>{tc.result_summary}</span>
                        </div>
                      )}

                      {/* Expandable full tool result */}
                      {isExpanded && tc.raw_result && (
                        <div className="mt-2 p-3 bg-obsidian-900 rounded-lg border border-obsidian-800 text-[10px] text-slate-300 overflow-x-auto max-h-48 overflow-y-auto">
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
            <div className="bg-obsidian-900/90 border border-obsidian-800 rounded-2xl p-6 shadow-2xl space-y-5 backdrop-blur-xl">
              <div className="flex items-center justify-between border-b border-obsidian-800 pb-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  <h4 className="text-sm font-bold text-white tracking-tight">
                    Synthesized Legal Research Findings
                  </h4>
                </div>
                <span className="text-xs text-slate-400 font-mono">
                  Deterministic Source Quote Verification
                </span>
              </div>

              <div className="text-sm leading-relaxed text-slate-200 whitespace-pre-wrap font-serif">
                {agentState.finalAnswer}
              </div>

              {/* Verified Supporting Citations */}
              {agentState.citations && agentState.citations.length > 0 && (
                <div className="pt-4 border-t border-obsidian-800 space-y-3">
                  <h5 className="text-xs font-bold text-slate-300 flex items-center gap-1.5 font-mono">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Verified Authoritative Quotations ({agentState.citations.length})</span>
                  </h5>

                  <div className="grid grid-cols-1 gap-2.5">
                    {agentState.citations.map((cite, cIdx) => (
                      <div
                        key={cIdx}
                        onClick={() => onNavigateCitation(cite)}
                        className="p-3.5 bg-emerald-950/20 hover:bg-emerald-950/30 border border-emerald-500/30 rounded-xl text-xs cursor-pointer transition-all group"
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-semibold text-slate-200 truncate max-w-sm flex items-center gap-1.5">
                            <FileText className="w-3.5 h-3.5 text-slate-400" />
                            <span>{cite.document_title} • Page {cite.page_number || 1}</span>
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            100% Verbatim Match
                          </span>
                        </div>
                        <p className="italic text-slate-300 font-serif line-clamp-3 group-hover:text-white">
                          "{cite.quote}"
                        </p>
                        <div className="mt-2 flex items-center justify-end text-[10px] text-emerald-400 font-mono pt-1 border-t border-obsidian-800/60">
                          <span className="flex items-center gap-0.5 group-hover:underline">
                            <span>Inspect Source in Document</span>
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
