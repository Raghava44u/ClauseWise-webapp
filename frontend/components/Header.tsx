"use client";

import React from "react";
import { DocumentItem } from "../lib/types";
import {
  MessageSquareText,
  FileText,
  GitCompare,
  Sparkles,
  FileCheck2,
  Layers
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
    <header className="h-14 border-b border-slate-200 bg-white flex flex-nowrap items-center justify-between px-3 sm:px-6 shrink-0 z-20 overflow-hidden">
      {/* Contract Title & Context Info */}
      <div className="flex items-center space-x-2.5 min-w-0 mr-2">
        {multiSelectCount > 1 ? (
          <div className="flex items-center gap-2 min-w-0">
            <span className="p-1.5 bg-slate-100 text-slate-700 border border-slate-200 rounded-lg shrink-0">
              <Layers className="w-4 h-4" />
            </span>
            <div className="min-w-0">
              <h2 className="text-xs sm:text-sm font-semibold text-slate-900 leading-none truncate">
                Cross-Document Analysis
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5 truncate hidden sm:block">
                {multiSelectCount} contracts selected
              </p>
            </div>
          </div>
        ) : activeDoc ? (
          <div className="flex items-center gap-2 min-w-0">
            <span className="p-1.5 rounded-lg bg-slate-100 border border-slate-200 text-slate-700 shrink-0">
              <FileText className="w-4 h-4" />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h2 className="text-xs sm:text-sm font-semibold text-slate-900 truncate max-w-[120px] sm:max-w-[200px] md:max-w-xs lg:max-w-md">
                  {activeDoc.filename}
                </h2>
                {activeDoc.status === "ready" && (
                  <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-[9px] font-semibold hidden md:inline-flex items-center gap-0.5 shrink-0">
                    <FileCheck2 className="w-2.5 h-2.5 text-emerald-600" />
                    <span>Indexed</span>
                  </span>
                )}
                {activeDoc.ocr_applied && (
                  <span className="px-1 py-0.5 bg-slate-100 text-slate-700 border border-slate-200 rounded text-[9px] font-medium hidden lg:inline-flex shrink-0">
                    PaddleOCR
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5 truncate hidden sm:block">
                {activeDoc.page_count ? `${activeDoc.page_count} Pages • ` : ""}
                Quotation Verification Active
              </p>
            </div>
          </div>
        ) : (
          <div className="text-xs sm:text-sm font-medium text-slate-500 truncate">
            Select or upload a contract to begin
          </div>
        )}
      </div>

      {/* Navigation Tabs */}
      <nav className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs shrink-0">
        <button
          onClick={() => onTabChange("chat")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-all ${
            activeTab === "chat"
              ? "bg-white text-slate-900 font-semibold shadow-xs"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
          }`}
        >
          <MessageSquareText className="w-3.5 h-3.5" />
          <span>Chat</span>
        </button>

        {/* Document Viewer Tab with Rotating Rainbow Border when Processed */}
        {activeDoc?.status === "ready" ? (
          <div className="rainbow-rotating-wrapper" title="Document processed and ready for interactive viewing!">
            <button
              onClick={() => onTabChange("viewer")}
              className={`rainbow-rotating-inner cursor-pointer ${
                activeTab === "viewer"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "bg-slate-50 text-slate-800 hover:bg-white"
              }`}
            >
              <FileText className="w-3.5 h-3.5 text-emerald-600" />
              <span>Document Viewer</span>
              <span className="text-[9px] font-bold bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded-full uppercase tracking-wider ml-0.5 animate-pulse">
                Ready
              </span>
            </button>
          </div>
        ) : (
          <button
            onClick={() => onTabChange("viewer")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-all ${
              activeTab === "viewer"
                ? "bg-white text-slate-900 font-semibold shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Document Viewer</span>
          </button>
        )}

        <button
          onClick={() => onTabChange("compare")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-all ${
            activeTab === "compare"
              ? "bg-white text-slate-900 font-semibold shadow-xs"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
          }`}
        >
          <GitCompare className="w-3.5 h-3.5" />
          <span>Compare Versions</span>
        </button>

        <button
          onClick={() => onTabChange("research")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-all ${
            activeTab === "research"
              ? "bg-white text-slate-900 font-semibold shadow-xs"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-slate-700" />
          <span>Agent Research</span>
        </button>
      </nav>
    </header>
  );
};
