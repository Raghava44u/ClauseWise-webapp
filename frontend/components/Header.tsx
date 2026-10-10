"use client";

import React from "react";
import { DocumentItem } from "@/lib/types";
import {
  MessageSquareText,
  FileText,
  GitCompare,
  Compass,
  FileCheck2,
  Layers,
  Sparkles
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
    <header className="h-14 border-b border-slate-200 bg-white flex items-center justify-between px-6 shrink-0 z-10">
      {/* Contract Title & Context Info */}
      <div className="flex items-center space-x-3 min-w-0">
        {multiSelectCount > 1 ? (
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-sky-100 text-sky-800 rounded-md">
              <Layers className="w-4 h-4" />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-slate-900 leading-none">
                Cross-Document Analysis
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {multiSelectCount} contracts selected for joint inquiry
              </p>
            </div>
          </div>
        ) : activeDoc ? (
          <div className="flex items-center gap-2.5 min-w-0">
            <span
              className={`p-1.5 rounded-md ${
                activeDoc.file_type === "pdf"
                  ? "bg-rose-50 text-rose-700"
                  : "bg-blue-50 text-blue-700"
              }`}
            >
              <FileText className="w-4 h-4" />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-slate-900 truncate max-w-md">
                  {activeDoc.filename}
                </h2>
                {activeDoc.status === "ready" && (
                  <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-[10px] font-semibold flex items-center gap-1">
                    <FileCheck2 className="w-3 h-3" />
                    <span>Indexed</span>
                  </span>
                )}
                {activeDoc.ocr_applied && (
                  <span className="px-1.5 py-0.5 bg-purple-50 text-purple-700 border border-purple-200 rounded text-[10px] font-semibold">
                    PaddleOCR
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {activeDoc.page_count ? `${activeDoc.page_count} Pages • ` : ""}
                Deterministic Quote Verification Enabled
              </p>
            </div>
          </div>
        ) : (
          <div className="text-sm font-medium text-slate-400">
            Select or upload a contract to begin analysis
          </div>
        )}
      </div>

      {/* Navigation Tabs */}
      <nav className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs font-medium">
        <button
          onClick={() => onTabChange("chat")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all ${
            activeTab === "chat"
              ? "bg-white text-navy-950 font-semibold shadow-xs"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <MessageSquareText className="w-3.5 h-3.5 text-navy-700" />
          <span>Chat</span>
        </button>

        <button
          onClick={() => onTabChange("viewer")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all ${
            activeTab === "viewer"
              ? "bg-white text-navy-950 font-semibold shadow-xs"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <FileText className="w-3.5 h-3.5 text-navy-700" />
          <span>Document Viewer</span>
        </button>

        <button
          onClick={() => onTabChange("compare")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all ${
            activeTab === "compare"
              ? "bg-white text-navy-950 font-semibold shadow-xs"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <GitCompare className="w-3.5 h-3.5 text-navy-700" />
          <span>Compare Versions</span>
        </button>

        <button
          onClick={() => onTabChange("research")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all ${
            activeTab === "research"
              ? "bg-navy-900 text-white font-semibold shadow-xs"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>Agent Research (Part C)</span>
        </button>
      </nav>
    </header>
  );
};
