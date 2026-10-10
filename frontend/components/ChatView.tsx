"use client";

import React, { useState, useRef, useEffect } from "react";
import { Message, Citation } from "../lib/types";
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
  ArrowUpRight,
  Layers,
  Mic,
  MicOff
} from "lucide-react";
import { isArabicText } from "../lib/utils";

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
  allDocumentsCount?: number;
  queryScope?: "current" | "all";
  onScopeChange?: (scope: "current" | "all") => void;
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
  allDocumentsCount = 1,
  queryScope = "current",
  onScopeChange,
}) => {
  const [inputQuery, setInputQuery] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Voice Input State (Speech Recognition API)
  const [isListening, setIsListening] = useState(false);
  const [speechLang, setSpeechLang] = useState<"en-US" | "ar-SA">("en-US");
  const [speechSupported, setSpeechSupported] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        setSpeechSupported(true);
      }
    }
  }, []);

  const toggleVoiceInput = () => {
    if (typeof window === "undefined") return;
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Voice input is supported in Google Chrome, Microsoft Edge, and Safari browsers.");
      return;
    }

    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = speechLang;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        let transcript = "";
        for (let i = 0; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        if (transcript) {
          setInputQuery(transcript);
        }
      };

      recognition.onerror = (event: any) => {
        console.warn("Speech recognition error:", event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error("Speech recognition startup error:", err);
      setIsListening(false);
    }
  };

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
            {messages.map((msg) => {
              const isArabicMsg = isArabicText(msg.content);
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${
                    msg.role === "user" ? "items-end" : "items-start"
                  }`}
                >
                  {/* Message Bubble */}
                  <div
                    dir={isArabicMsg ? "rtl" : "ltr"}
                    className={`max-w-3xl rounded-xl p-4 sm:p-5 text-sm leading-relaxed ${
                      isArabicMsg ? "text-right font-sans" : ""
                    } ${
                      msg.role === "user"
                        ? "bg-slate-900 text-white font-medium rounded-br-xs shadow-xs"
                        : "bg-white text-slate-800 border border-slate-200 rounded-bl-xs shadow-xs"
                    }`}
                  >
                    {msg.content.startsWith("⚠️") ? (
                      <div className="text-xs text-rose-800 flex items-start gap-2 font-medium bg-rose-50 p-3 rounded-lg border border-rose-200">
                        <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                        <span>{msg.content.replace(/^⚠️\s*/, "")}</span>
                      </div>
                    ) : (
                      <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>
                    )}

                    {msg.is_interrupted && !msg.content.startsWith("⚠️") && (
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
                          {msg.citations.map((cite, cIdx) => {
                            const isArabicQuote = isArabicText(cite.quote);
                            return (
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
                                      <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                                      <span>100% Verbatim Match</span>
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800 flex items-center gap-1">
                                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                                      <span>Unverified Quote</span>
                                    </span>
                                  )}
                                </div>

                                <p
                                  dir={isArabicQuote ? "rtl" : "ltr"}
                                  className={`text-slate-800 italic font-serif leading-relaxed line-clamp-3 ${
                                    isArabicQuote ? "text-right" : ""
                                  }`}
                                >
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
                                    <ArrowUpRight className="w-3.5 h-3.5" />
                                  </span>
                                </div>
                              </div>
                            );
                          })}
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
              );
            })}

            {/* Currently Streaming Assistant Bubble */}
            {isStreaming && (
              <div className="flex flex-col items-start">
                <div
                  dir={isArabicText(streamingToken) ? "rtl" : "ltr"}
                  className={`max-w-3xl rounded-xl p-5 text-sm leading-relaxed bg-white text-slate-800 border border-slate-200 shadow-xs rounded-bl-xs ${
                    isArabicText(streamingToken) ? "text-right font-sans" : ""
                  }`}
                >
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
                  <span>Streaming from Gemini 3.5 Flash...</span>
                </span>
              </div>
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Box Footer */}
      <div className="p-4 bg-white border-t border-slate-200">
        {/* Scope Selector: Single Contract vs All Contracts */}
        {allDocumentsCount > 1 && (
          <div className="flex items-center justify-between mb-2.5 max-w-4xl mx-auto px-1">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="font-semibold text-[11px] text-slate-400 uppercase tracking-wider">
                Target:
              </span>
              <div className="inline-flex rounded-lg bg-slate-100 p-0.5 border border-slate-200 text-xs">
                <button
                  type="button"
                  onClick={() => onScopeChange?.("current")}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer ${
                    queryScope === "current"
                      ? "bg-white text-slate-900 font-semibold shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                  title={`Query only ${documentTitle || "active contract"}`}
                >
                  <FileText className="w-3 h-3 text-slate-500" />
                  <span className="truncate max-w-[150px] sm:max-w-[200px]">
                    {documentTitle || "Current Document"}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => onScopeChange?.("all")}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer ${
                    queryScope === "all"
                      ? "bg-emerald-600 text-white font-semibold shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                  title={`Query across all ${allDocumentsCount} uploaded documents in library`}
                >
                  <Layers className="w-3 h-3" />
                  <span>All Documents ({allDocumentsCount})</span>
                </button>
              </div>
            </div>

            {queryScope === "all" && (
              <span className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded font-medium hidden sm:inline-flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Cross-examining all {allDocumentsCount} documents</span>
              </span>
            )}
          </div>
        )}

        {/* Voice Input Listening Pulse Banner */}
        {isListening && (
          <div className="mb-2 max-w-4xl mx-auto flex items-center justify-between px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 animate-pulse">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 animate-ping" />
              <span className="font-semibold">
                {speechLang === "ar-SA"
                  ? "🎙️ استمع إلى سؤالك (تحدث الآن)..."
                  : "🎙️ Listening to your question (Speak now)..."}
              </span>
            </div>
            <button
              type="button"
              onClick={toggleVoiceInput}
              className="text-[11px] font-bold text-emerald-900 bg-emerald-200/70 hover:bg-emerald-300 px-2 py-0.5 rounded cursor-pointer transition-colors"
            >
              {speechLang === "ar-SA" ? "إيقاف" : "Stop"}
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="relative flex items-center gap-2 max-w-4xl mx-auto">
          {/* Speech Language Switcher */}
          <div className="inline-flex rounded-lg bg-slate-100 p-0.5 border border-slate-200 text-xs shrink-0">
            <button
              type="button"
              onClick={() => setSpeechLang("en-US")}
              className={`px-2 py-1 rounded text-[11px] font-semibold transition-all cursor-pointer ${
                speechLang === "en-US"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
              title="Voice input in English"
            >
              EN
            </button>
            <button
              type="button"
              onClick={() => setSpeechLang("ar-SA")}
              className={`px-2 py-1 rounded text-[11px] font-semibold transition-all cursor-pointer ${
                speechLang === "ar-SA"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
              title="Voice input in Arabic (العربية)"
            >
              العربية
            </button>
          </div>

          {/* Voice Input Mic Button */}
          <button
            type="button"
            onClick={toggleVoiceInput}
            className={`p-2.5 rounded-lg border text-xs font-medium transition-all cursor-pointer flex items-center justify-center shrink-0 ${
              isListening
                ? "bg-rose-500 border-rose-600 text-white animate-pulse shadow-md"
                : "bg-slate-50 hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 border-slate-200 hover:border-emerald-300"
            }`}
            title={
              isListening
                ? "Click to stop listening"
                : `Click to speak your question (${speechLang === "ar-SA" ? "العربية" : "English"})`
            }
          >
            {isListening ? (
              <MicOff className="w-4 h-4 text-white" />
            ) : (
              <Mic className="w-4 h-4 text-slate-600 group-hover:text-emerald-700" />
            )}
          </button>

          <input
            type="text"
            dir={isArabicText(inputQuery) ? "rtl" : "ltr"}
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            placeholder={
              speechLang === "ar-SA"
                ? "اسأل أي سؤال عن العقد أو اضغط على الميكروفون للتحدث..."
                : queryScope === "all"
                ? `Ask anything across all ${allDocumentsCount} documents (or speak via mic)...`
                : isMultiDoc
                ? "Ask a question comparing selected contracts (or speak via mic)..."
                : `Ask anything about ${documentTitle || "this document"} (or speak via mic)...`
            }
            disabled={isStreaming}
            className={`flex-1 px-4 py-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-slate-400 focus:bg-white text-slate-900 placeholder-slate-400 disabled:opacity-50 transition-all font-sans shadow-2xs ${
              isArabicText(inputQuery) ? "text-right" : ""
            }`}
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
