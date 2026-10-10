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
  CornerDownRight,
  ShieldCheck,
  ShieldAlert,
  Loader2,
  Info
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
    "What are the termination notice requirements?",
    "Is there an indemnification obligation?",
    "What is the governing law and jurisdiction?"
  ];

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 relative overflow-hidden">
      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.length === 0 && !isStreaming ? (
          <div className="h-full flex flex-col items-center justify-center text-center max-w-lg mx-auto py-12">
            <div className="w-12 h-12 rounded-xl bg-navy-100 flex items-center justify-center text-navy-800 mb-4 shadow-xs">
              <Sparkles className="w-6 h-6 text-navy-700" />
            </div>
            <h3 className="text-base font-semibold text-slate-800">
              Contract Intelligence Chat
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm">
              Ask questions about {isMultiDoc ? "selected contracts" : documentTitle || "this contract"}. Every response is backed by deterministically verified verbatim quotations.
            </p>

            <div className="mt-6 w-full space-y-2">
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Suggested Inquiries
              </p>
              <div className="grid grid-cols-1 gap-2">
                {samplePrompts.map((prompt, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setInputQuery(prompt);
                    }}
                    className="text-left text-xs p-2.5 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-700 font-medium transition-all shadow-2xs hover:border-slate-300"
                  >
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
                  className={`max-w-3xl rounded-xl p-4 text-sm leading-relaxed shadow-xs ${
                    msg.role === "user"
                      ? "bg-navy-800 text-white font-medium rounded-br-none"
                      : "bg-white text-slate-800 border border-slate-200 rounded-bl-none"
                  }`}
                >
                  <div className="whitespace-pre-wrap">{msg.content}</div>

                  {msg.is_interrupted && (
                    <div className="mt-2 text-xs text-amber-600 flex items-center gap-1 font-medium bg-amber-50 p-1.5 rounded border border-amber-200">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>Generation stopped by user. Partial answer retained.</span>
                    </div>
                  )}

                  {/* Verified Citations List */}
                  {msg.citations && msg.citations.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-slate-100 space-y-2">
                      <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                        <span className="flex items-center gap-1">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Supporting Source Citations ({msg.citations.length})</span>
                        </span>
                        <span className="text-[10px] text-slate-400">
                          Click quote to jump to document
                        </span>
                      </div>

                      <div className="grid grid-cols-1 gap-2 mt-2">
                        {msg.citations.map((cite, cIdx) => (
                          <div
                            key={cIdx}
                            onClick={() => onCitationClick(cite)}
                            className={`p-2.5 rounded-lg border text-xs cursor-pointer transition-all hover:shadow-xs group ${
                              cite.verified
                                ? "bg-emerald-50/40 border-emerald-200 hover:bg-emerald-50/80"
                                : "bg-amber-50/40 border-amber-200 hover:bg-amber-50/80"
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-semibold text-slate-700 flex items-center gap-1">
                                <FileText className="w-3 h-3 text-slate-400" />
                                <span className="truncate max-w-xs">{cite.document_title}</span>
                                {cite.page_number && (
                                  <span className="text-[11px] text-slate-500 font-normal">
                                    • Page {cite.page_number}
                                  </span>
                                )}
                              </span>
                              {cite.verified ? (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800 flex items-center gap-0.5">
                                  <CheckCircle className="w-3 h-3 text-emerald-600" />
                                  <span>Verified Match (100%)</span>
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800 flex items-center gap-0.5">
                                  <AlertTriangle className="w-3 h-3 text-amber-600" />
                                  <span>Unverified Quote</span>
                                </span>
                              )}
                            </div>

                            <p className="text-slate-800 italic line-clamp-3 group-hover:text-navy-900">
                              "{cite.quote}"
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <span className="text-[10px] text-slate-400 mt-1 px-1">
                  {msg.role === "user" ? "You" : "ClauseWise AI"}
                </span>
              </div>
            ))}

            {/* Currently Streaming Assistant Bubble */}
            {isStreaming && (
              <div className="flex flex-col items-start">
                <div className="max-w-3xl rounded-xl p-4 text-sm leading-relaxed bg-white text-slate-800 border border-slate-200 shadow-xs rounded-bl-none">
                  {streamingStatus && (
                    <div className="mb-2 text-xs text-navy-700 flex items-center gap-1.5 font-medium bg-navy-50/80 p-2 rounded border border-navy-100">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-navy-600" />
                      <span>{streamingStatus}</span>
                    </div>
                  )}

                  <div className="whitespace-pre-wrap">{streamingToken}</div>

                  {streamingCitations.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-slate-100 space-y-2">
                      <div className="text-xs font-semibold text-slate-500">
                        Verifying {streamingCitations.length} citations...
                      </div>
                    </div>
                  )}
                </div>
                <span className="text-[10px] text-slate-400 mt-1 px-1 flex items-center gap-1">
                  <Loader2 className="w-2.5 h-2.5 animate-spin" />
                  <span>Streaming from Grok...</span>
                </span>
              </div>
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Box Footer */}
      <div className="p-4 bg-white border-t border-slate-200">
        <form onSubmit={handleSubmit} className="relative flex items-center gap-2">
          <input
            type="text"
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            placeholder={
              isMultiDoc
                ? "Ask a question comparing selected contracts..."
                : "Ask anything about this contract (e.g. liability, termination, clauses)..."
            }
            disabled={isStreaming}
            className="flex-1 px-4 py-3 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-navy-600 text-slate-900 placeholder-slate-400 disabled:opacity-60"
          />

          {isStreaming ? (
            <button
              type="button"
              onClick={onStopGeneration}
              className="flex items-center gap-1.5 px-4 py-3 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>Stop</span>
            </button>
          ) : (
            <button
              type="submit"
              disabled={!inputQuery.trim()}
              className="flex items-center gap-1.5 px-4 py-3 bg-navy-800 hover:bg-navy-900 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors"
            >
              <Send className="w-3.5 h-3.5 text-sky-400" />
              <span>Send</span>
            </button>
          )}
        </form>
      </div>
    </div>
  );
};
