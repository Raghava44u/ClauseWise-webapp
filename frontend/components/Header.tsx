"use client";

import React from "react";
import { DocumentItem } from "@/lib/types";
import {
  MessageSquareText,
  FileText,
  GitCompare,
  Sparkles,
  FileCheck2,
  Layers,
  Cpu
} from "lucide-react";

export type ActiveTab = "chat" | "viewer" | "compare" | "research";

interface HeaderProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  activeDoc: DocumentItem | null;
  multiSelectCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onTabChange,
  activeDoc,
  multiSelectCount,
}) => {
  return (
    <header className="h-14 border-b border-slate-800/80 bg-obsidian-950/90 backdrop-blur-xl flex items-center justify-between px-6 shrink-0 z-20 text-slate-200">
      {/* Contract Title & Context Info */}
      <div className="flex items-center space-x-3 min-w-0">
        {multiSelectCount > 1 ? (
          <div className="flex items-center gap-2.5">
            <span className="p-1.5 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded-lg">
              <Layers className="w-4 h-4" />
            </span>
            <div>
              <h2 className="text-sm font-bold text-white leading-none">
                Cross-Document Analysis
              </h2>
              <p className="text-[11px] text-cyan-300/80 mt-0.5">
                {multiSelectCount} contracts selected for comparative cross-examination
              </p>
            </div>
          </div>
        ) : activeDoc ? (
          <div className="flex items-center gap-2.5 min-w-0">
            <span
              className={`p-1.5 rounded-lg border ${
                activeDoc.file_type === "pdf"
                  ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                  : "bg-blue-500/10 text-blue-400 border-blue-500/20"
              }`}
            >
              <FileText className="w-4 h-4" />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-white truncate max-w-md">
                  {activeDoc.filename}
                </h2>
                {activeDoc.status === "ready" && (
                  <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-md text-[10px] font-bold flex items-center gap-1">
                    <FileCheck2 className="w-3 h-3 text-emerald-400" />
                    <span>Indexed</span>
                  </span>
                )}
                {activeDoc.ocr_applied && (
                  <span className="px-1.5 py-0.5 bg-purple-500/10 text-purple-300 border border-purple-500/20 rounded text-[9px] font-bold">
                    PaddleOCR
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {activeDoc.page_count ? `${activeDoc.page_count} Pages • ` : ""}
                Deterministic Quotation Verification Engine Active
              </p>
            </div>
          </div>
        ) : (
          <div className="text-sm font-medium text-slate-500">
            Select or upload a contract from the library to begin analysis
          </div>
        )}
      </div>

      {/* Navigation Tabs */}
      <nav className="flex items-center gap-1.5 bg-slate-900/90 p-1 rounded-xl border border-slate-800 text-xs font-semibold">
        <button
          onClick={() => onTabChange("chat")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
            activeTab === "chat"
              ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold shadow-[0_0_15px_rgba(16,185,129,0.25)]"
              : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/50"
          }`}
        >
          <MessageSquareText className="w-3.5 h-3.5" />
          <span>Chat</span>
        </button>

        <button
          onClick={() => onTabChange("viewer")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
            activeTab === "viewer"
              ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold shadow-[0_0_15px_rgba(16,185,129,0.25)]"
              : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/50"
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Document Viewer</span>
        </button>

        <button
          onClick={() => onTabChange("compare")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
            activeTab === "compare"
              ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold shadow-[0_0_15px_rgba(16,185,129,0.25)]"
              : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/50"
          }`}
        >
          <GitCompare className="w-3.5 h-3.5" />
          <span>Compare Versions</span>
        </button>

        <button
          onClick={() => onTabChange("research")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
            activeTab === "research"
              ? "bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 text-white font-bold shadow-[0_0_15px_rgba(245,158,11,0.3)]"
              : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/50"
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
          <span>Agent Research (Part C)</span>
        </button>
      </nav>
    </header>
  );
};
