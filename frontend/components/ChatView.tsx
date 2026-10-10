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
  suggestedQuestions?: string[];
  loadingQuestions?: boolean;
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
  suggestedQuestions = [],
  loadingQuestions = false,
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

  // Dynamic questions specific to this uploaded document
  const displayQuestions = suggestedQuestions.length > 0
    ? suggestedQuestions
    : [
        `What are the core provisions, obligations, and scope outlined in ${documentTitle || "this document"}?`,
        `What specific conditions, timelines, or performance terms are established?`,
        `What liabilities, indemnities, or compliance standards apply under this document?`,
        `What dispute resolution, governing law, or termination clauses are specified?`
      ];

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 text-slate-800 relative overflow-hidden">
      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.length === 0 && !isStreaming ? (
          <div className="h-full flex flex-col items-center justify-center text-center max-w-lg mx-auto py-12">
            <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-800 mb-4 shadow-2xs">
              <Sparkles className="w-6 h-6 text-emerald-600" />
            </div>
            <h3 className="text-base font-bold text-slate-900 tracking-tight">
              Contract Intelligence Chat
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm leading-relaxed">
              Ask questions about <span className="font-semibold text-slate-800">{isMultiDoc ? "selected contracts" : documentTitle || "this contract"}</span>. Every answer is backed by programmatically verified verbatim source quotations.
            </p>

            <div className="mt-8 w-full space-y-2">
              <div className="flex items-center justify-between px-1">
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider font-mono flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3 text-emerald-600" />
                  <span>Tailored Inquiries for {documentTitle || "Contract"}</span>
                </p>
                <span className="text-[9px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  Dynamic Questions
                </span>
              </div>

              {loadingQuestions ? (
                <div className="p-5 bg-white border border-slate-200 rounded-xl flex items-center justify-center gap-2.5 text-xs text-slate-500 shadow-2xs">
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                  <span>Analyzing document to generate tailored questions...</span>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2">
                  {displayQuestions.map((prompt, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        onSendMessage(prompt);
                      }}
                      className="text-left text-xs p-3 bg-white hover:bg-emerald-50/40 hover:border-emerald-300 border border-slate-200 rounded-lg text-slate-700 font-medium transition-all shadow-2xs group flex items-start justify-between gap-3 cursor-pointer"
                      title="Click to submit inquiry"
                    >
                      <span className="group-hover:text-slate-900 leading-relaxed font-sans">
                        "{prompt}"
                      </span>
                      <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-600 shrink-0 mt-0.5 transition-colors" />
                    </button>
                  ))}
                </div>
              )}
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
                  className={`max-w-3xl rounded-xl p-4 sm:p-5 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-slate-900 text-white font-medium rounded-br-xs shadow-xs"
                      : "bg-white text-slate-800 border border-slate-200 rounded-bl-xs shadow-xs"
                  }`}
                >
                  <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>

                  {msg.is_interrupted && (
                    <div className="mt-3 text-xs text-amber-800 flex items-center gap-1.5 font-medium bg-amber-50 p-2 rounded-lg border border-amber-200">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                      <span>Generation stopped by user. Partial analysis preserved.</span>
                    </div>
                  )}

                  {/* Verified Citations List */}
                  {msg.citations && msg.citations.length > 0 && (
                    <div className="mt-4 pt-3.5 border-t border-slate-100 space-y-2">
                      <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                        <span className="flex items-center gap-1.5 text-emerald-700">
                          <ShieldCheck className="w-4 h-4 text-emerald-600" />
                          <span>Supporting Source Citations ({msg.citations.length})</span>
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          Click quote to view passage
                        </span>
                      </div>

                      <div className="grid grid-cols-1 gap-2 mt-2">
                        {msg.citations.map((cite, cIdx) => (
                          <div
                            key={cIdx}
                            onClick={() => onCitationClick(cite)}
                            className={`p-3 rounded-lg border text-xs cursor-pointer transition-all ${
                              cite.verified
                                ? "bg-emerald-50/50 border-emerald-200 hover:bg-emerald-50 hover:border-emerald-300"
                                : "bg-amber-50/50 border-amber-200 hover:bg-amber-50"
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="font-semibold text-slate-700 flex items-center gap-1.5 truncate max-w-xs">
                                <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <span className="truncate">{cite.document_title}</span>
                                {cite.page_number && (
                                  <span className="text-[10px] text-slate-500 font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200">
                                    P.{cite.page_number}
                                  </span>
                                )}
                              </span>
                              {cite.verified ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800 flex items-center gap-1">
                                  <CheckCircle className="w-3 h-3 text-emerald-600" />
                                  <span>100% Verbatim Match</span>
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800 flex items-center gap-1">
                                  <AlertTriangle className="w-3 h-3 text-amber-600" />
                                  <span>Unverified Quote</span>
                                </span>
                              )}
                            </div>

                            <p className="text-slate-800 italic font-serif leading-relaxed line-clamp-3">
                              "{cite.quote}"
                            </p>

                            <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500 font-mono pt-1 border-t border-emerald-100">
                              <span>
                                {cite.start_offset !== undefined && cite.end_offset !== undefined
                                  ? `Offsets: [${cite.start_offset} — ${cite.end_offset}]`
                                  : "Exact Source Matched"}
                              </span>
                              <span className="flex items-center gap-0.5 text-emerald-700 hover:underline">
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

                <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-1.5 px-1 font-mono">
                  {msg.role === "user" ? (
                    <>
                      <User className="w-3 h-3 text-slate-400" />
                      <span>Counsel</span>
                    </>
                  ) : (
                    <>
                      <Bot className="w-3 h-3 text-emerald-600" />
                      <span>ClauseWise AI</span>
                    </>
                  )}
                </div>
              </div>
            ))}

            {/* Currently Streaming Assistant Bubble */}
            {isStreaming && (
              <div className="flex flex-col items-start">
                <div className="max-w-3xl rounded-xl p-5 text-sm leading-relaxed bg-white text-slate-800 border border-slate-200 shadow-xs rounded-bl-xs">
                  {streamingStatus && (
                    <div className="mb-3 text-xs text-slate-700 flex items-center gap-2 font-medium bg-slate-50 p-2 rounded-lg border border-slate-200">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                      <span>{streamingStatus}</span>
                    </div>
                  )}

                  <div className="whitespace-pre-wrap leading-relaxed">{streamingToken}</div>

                  {streamingCitations.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-slate-100 space-y-2">
                      <div className="text-xs font-semibold text-slate-500 flex items-center gap-2">
                        <Loader2 className="w-3 h-3 animate-spin text-emerald-600" />
                        <span>Verifying {streamingCitations.length} quotations in document...</span>
                      </div>
                    </div>
                  )}
                </div>
                <span className="text-[10px] text-emerald-700 mt-1.5 px-1 flex items-center gap-1 font-mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-ping" />
                  <span>Streaming from Gemini 2.5 Flash...</span>
                </span>
              </div>
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Box Footer */}
      <div className="p-4 bg-white border-t border-slate-200">
        <form onSubmit={handleSubmit} className="relative flex items-center gap-2 max-w-4xl mx-auto">
          <input
            type="text"
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            placeholder={
              isMultiDoc
                ? "Ask a question comparing selected contracts..."
                : "Ask anything about this contract (e.g. liabilities, indemnity, payment terms)..."
            }
            disabled={isStreaming}
            className="flex-1 px-4 py-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-slate-400 focus:bg-white text-slate-900 placeholder-slate-400 disabled:opacity-50 transition-all font-sans shadow-2xs"
          />

          {isStreaming ? (
            <button
              type="button"
              onClick={onStopGeneration}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>Stop</span>
            </button>
          ) : (
            <button
              type="submit"
              disabled={!inputQuery.trim()}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer disabled:cursor-not-allowed"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Send</span>
            </button>
          )}
        </form>
      </div>
    </div>
  );
};
