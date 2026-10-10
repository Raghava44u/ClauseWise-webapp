"use client";

import React, { useState, useRef, useEffect } from "react";
import { Message, Citation } from "@/lib/types";
import {
  Send,
  Square,
  Sparkles,
  CheckCircle,
  AlertTriangle,
  FileText,
  ShieldCheck,
  ShieldAlert,
  Loader2,
  Bot,
  User,
  ArrowUpRight
} from "lucide-react";

interface ChatViewProps {
  messages: Message[];
  streamingToken: string;
  streamingCitations: Citation[];
  streamingStatus: string | null;
  isStreaming: boolean;
  onSendMessage: (query: string) => void;
  onStopGeneration: () => void;
  onCitationClick: (citation: Citation) => void;
  documentTitle?: string;
  isMultiDoc?: boolean;
}

export const ChatView: React.FC<ChatViewProps> = ({
  messages,
  streamingToken,
  streamingCitations,
  streamingStatus,
  isStreaming,
  onSendMessage,
  onStopGeneration,
  onCitationClick,
  documentTitle,
  isMultiDoc = false,
}) => {
  const [inputQuery, setInputQuery] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingToken, streamingStatus]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputQuery.trim() || isStreaming) return;
    onSendMessage(inputQuery.trim());
    setInputQuery("");
  };

  const samplePrompts = [
    "What is the limitation of liability cap?",
    "What are the payment and invoice settlement terms?",
    "What are the termination for convenience requirements?",
    "Is there an indemnification obligation or penalty clause?"
  ];

  return (
    <div className="flex-1 flex flex-col h-full bg-obsidian-950/95 text-slate-100 relative overflow-hidden">
      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.length === 0 && !isStreaming ? (
          <div className="h-full flex flex-col items-center justify-center text-center max-w-lg mx-auto py-12">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-4 shadow-xl">
              <Sparkles className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-bold text-white tracking-tight">
              Contract Intelligence Chat
            </h3>
            <p className="text-xs text-slate-400 mt-1.5 max-w-sm leading-relaxed">
              Ask questions about <span className="text-emerald-400 font-medium">{isMultiDoc ? "selected contracts" : documentTitle || "this contract"}</span>. Every response is deterministically backed by exact verbatim source quotations and character offsets.
            </p>

            <div className="mt-8 w-full space-y-2.5">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                Suggested Legal Inquiries
              </p>
              <div className="grid grid-cols-1 gap-2.5">
                {samplePrompts.map((prompt, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setInputQuery(prompt);
                    }}
                    className="text-left text-xs p-3 bg-obsidian-900/80 hover:bg-obsidian-850 border border-obsidian-800 hover:border-emerald-500/40 rounded-xl text-slate-300 hover:text-white font-medium transition-all shadow-md group cursor-pointer"
                  >
                    <span className="text-emerald-400 font-bold mr-1.5 group-hover:translate-x-0.5 inline-block transition-transform">→</span>
                    "{prompt}"
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${
                  msg.role === "user" ? "items-end" : "items-start"
                }`}
              >
                {/* Message Bubble */}
                <div
                  className={`max-w-3xl rounded-2xl p-4 sm:p-5 text-sm leading-relaxed shadow-xl ${
                    msg.role === "user"
                      ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-medium rounded-br-xs shadow-emerald-900/20"
                      : "bg-obsidian-900/90 text-slate-200 border border-obsidian-800 rounded-bl-xs backdrop-blur-xl"
                  }`}
                >
                  <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>

                  {msg.is_interrupted && (
                    <div className="mt-3 text-xs text-amber-300 flex items-center gap-1.5 font-medium bg-amber-950/30 p-2.5 rounded-xl border border-amber-800/50">
                      <AlertTriangle className="w-4 h-4 text-amber-400" />
                      <span>Generation stopped by user. Partial analysis preserved.</span>
                    </div>
                  )}

                  {/* Verified Citations List */}
                  {msg.citations && msg.citations.length > 0 && (
                    <div className="mt-4 pt-3.5 border-t border-obsidian-800 space-y-2.5">
                      <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
                        <span className="flex items-center gap-1.5 text-emerald-400">
                          <ShieldCheck className="w-4 h-4" />
                          <span>Supporting Source Citations ({msg.citations.length})</span>
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          Click quote to jump to passage
                        </span>
                      </div>

                      <div className="grid grid-cols-1 gap-2.5 mt-2">
                        {msg.citations.map((cite, cIdx) => (
                          <div
                            key={cIdx}
                            onClick={() => onCitationClick(cite)}
                            className={`p-3 rounded-xl border text-xs cursor-pointer transition-all hover:shadow-lg group ${
                              cite.verified
                                ? "bg-emerald-950/20 border-emerald-500/30 hover:border-emerald-500/60 hover:bg-emerald-950/30"
                                : "bg-amber-950/20 border-amber-500/30 hover:border-amber-500/60 hover:bg-amber-950/30"
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="font-semibold text-slate-300 flex items-center gap-1.5 truncate max-w-xs">
                                <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <span className="truncate">{cite.document_title}</span>
                                {cite.page_number && (
                                  <span className="text-[10px] text-slate-400 font-mono bg-obsidian-800 px-1.5 py-0.5 rounded">
                                    P.{cite.page_number}
                                  </span>
                                )}
                              </span>
                              {cite.verified ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                                  <CheckCircle className="w-3 h-3 text-emerald-400" />
                                  <span>100% Verbatim Match</span>
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                                  <AlertTriangle className="w-3 h-3 text-amber-400" />
                                  <span>Unverified Quote</span>
                                </span>
                              )}
                            </div>

                            <p className="text-slate-300 italic font-serif leading-relaxed line-clamp-3 group-hover:text-white">
                              "{cite.quote}"
                            </p>

                            <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500 font-mono pt-1 border-t border-obsidian-800/50">
                              <span>
                                {cite.start_offset !== undefined && cite.end_offset !== undefined
                                  ? `Offsets: [${cite.start_offset} — ${cite.end_offset}]`
                                  : "Exact Source Matched"}
                              </span>
                              <span className="flex items-center gap-0.5 text-emerald-400 group-hover:underline">
                                <span>Inspect in Document</span>
                                <ArrowUpRight className="w-3 h-3" />
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mt-1.5 px-1 font-mono">
                  {msg.role === "user" ? (
                    <>
                      <User className="w-3 h-3 text-slate-400" />
                      <span>Legal Counsel</span>
                    </>
                  ) : (
                    <>
                      <Bot className="w-3 h-3 text-emerald-400" />
                      <span>ClauseWise Intelligence</span>
                    </>
                  )}
                </div>
              </div>
            ))}

            {/* Currently Streaming Assistant Bubble */}
            {isStreaming && (
              <div className="flex flex-col items-start">
                <div className="max-w-3xl rounded-2xl p-5 text-sm leading-relaxed bg-obsidian-900/95 text-slate-200 border border-obsidian-800 shadow-2xl rounded-bl-xs">
                  {streamingStatus && (
                    <div className="mb-3 text-xs text-cyan-300 flex items-center gap-2 font-medium bg-cyan-950/40 p-2.5 rounded-xl border border-cyan-800/40">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                      <span>{streamingStatus}</span>
                    </div>
                  )}

                  <div className="whitespace-pre-wrap leading-relaxed">{streamingToken}</div>

                  {streamingCitations.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-obsidian-800 space-y-2">
                      <div className="text-xs font-semibold text-slate-400 flex items-center gap-2">
                        <Loader2 className="w-3 h-3 animate-spin text-emerald-400" />
                        <span>Verifying {streamingCitations.length} quotations in document...</span>
                      </div>
                    </div>
                  )}
                </div>
                <span className="text-[10px] text-emerald-400 mt-1.5 px-1 flex items-center gap-1 font-mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  <span>Streaming from Gemini 2.5 Flash...</span>
                </span>
              </div>
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Box Footer */}
      <div className="p-4 bg-obsidian-900/90 border-t border-obsidian-800 backdrop-blur-xl">
        <form onSubmit={handleSubmit} className="relative flex items-center gap-2.5 max-w-5xl mx-auto">
          <input
            type="text"
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            placeholder={
              isMultiDoc
                ? "Ask a question comparing selected contracts..."
                : "Ask anything about this contract (e.g. liabilities, indemnity, terms)..."
            }
            disabled={isStreaming}
            className="flex-1 px-4 py-3.5 text-xs sm:text-sm bg-obsidian-950 border border-obsidian-800 rounded-xl focus:outline-none focus:border-emerald-500 text-slate-100 placeholder-slate-500 disabled:opacity-50 transition-all font-sans"
          />

          {isStreaming ? (
            <button
              type="button"
              onClick={onStopGeneration}
              className="flex items-center gap-1.5 px-5 py-3.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-rose-600/20 transition-all active:scale-95 cursor-pointer"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>Stop</span>
            </button>
          ) : (
            <button
              type="submit"
              disabled={!inputQuery.trim()}
              className="flex items-center gap-2 px-5 py-3.5 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 disabled:from-obsidian-800 disabled:to-obsidian-800 disabled:text-slate-500 text-obsidian-950 text-xs font-bold rounded-xl shadow-lg shadow-emerald-500/10 transition-all active:scale-95 disabled:cursor-not-allowed cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Ask AI</span>
            </button>
          )}
        </form>
      </div>
    </div>
  );
};
