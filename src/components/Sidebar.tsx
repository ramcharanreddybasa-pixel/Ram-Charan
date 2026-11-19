import { useMemo, useState } from "react";
import {
  Clock,
  FileText,
  FolderOpen,
  Plus,
  Search,
  Settings,
  Trash2,
  X,
} from "lucide-react";
import type { PaperRecord } from "../types/paper";
import { formatRelativeDate } from "../lib/pdf";

interface SidebarProps {
  papers: PaperRecord[];
  activePaperId: string | null;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onSelectPaper: (paperId: string) => void;
  onDeletePaper: (paperId: string) => void;
  onNewUpload: () => void;
  onOpenSettings: () => void;
}

export function Sidebar({
  papers,
  activePaperId,
  mobileOpen,
  onCloseMobile,
  onSelectPaper,
  onDeletePaper,
  onNewUpload,
  onOpenSettings,
}: SidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const recentPapers = useMemo(() => {
    return [...papers]
      .sort((a, b) => b.lastOpenedAt - a.lastOpenedAt)
      .slice(0, 3);
  }, [papers]);

  const filteredLibrary = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return papers;
    return papers.filter((p) => {
      const title = p.analysis.title.toLowerCase();
      const file = p.fileName.toLowerCase();
      const field = p.analysis.field.toLowerCase();
      const authors = p.analysis.authors.join(" ").toLowerCase();
      return title.includes(q) || file.includes(q) || field.includes(q) || authors.includes(q);
    });
  }, [papers, searchQuery]);

  const sidebarContent = (
    <div className="flex flex-col h-full bg-[#FFFFFF] border-r border-[#E7E2DA]">
      {/* Mobile Drawer Header */}
      <div className="lg:hidden flex items-center justify-between px-4 h-16 border-b border-[#E7E2DA] shrink-0">
        <span className="font-display text-base font-semibold text-[#1C1926]">
          Research Library
        </span>
        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="Close sidebar"
          className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-[#524C61] hover:bg-[#F4F1EC]"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Primary New Paper Action + Search */}
      <div className="p-4 space-y-3 border-b border-[#E7E2DA] shrink-0">
        <button
          type="button"
          onClick={() => {
            onNewUpload();
            onCloseMobile();
          }}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#F5F3FF] text-[#4C1D95] border border-[#DDD6FE] hover:bg-[#EDE9FE] transition-colors text-sm font-semibold focus-visible:outline-2 focus-visible:outline-[#4C1D95]"
        >
          <Plus className="w-4 h-4 shrink-0" />
          <span className="whitespace-nowrap">Add Research Paper</span>
        </button>

        <div className="relative">
          <Search className="w-4 h-4 text-[#797288] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter library..."
            aria-label="Filter document library"
            className="w-full pl-9 pr-3 py-2 text-sm bg-[#FAF8F5] border border-[#E7E2DA] rounded-lg text-[#1C1926] placeholder:text-[#797288] focus:outline-none focus:border-[#4C1D95] focus:bg-white transition-colors"
          />
        </div>
      </div>

      {/* Scrollable Sections: Recent Papers + Document Library */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {/* Recent Papers */}
        {recentPapers.length > 0 && !searchQuery.trim() && (
          <section aria-label="Recent papers">
            <div className="flex items-center gap-2 px-2 mb-2 text-xs font-semibold text-[#797288]">
              <Clock className="w-3.5 h-3.5" />
              <span>Recent Papers</span>
            </div>
            <ul className="space-y-1">
              {recentPapers.map((paper) => {
                const isActive = paper.id === activePaperId;
                return (
                  <li key={`recent-${paper.id}`}>
                    <button
                      type="button"
                      onClick={() => {
                        onSelectPaper(paper.id);
                        onCloseMobile();
                      }}
                      className={`w-full text-left px-2.5 py-2 rounded-lg transition-colors flex items-start gap-2.5 ${
                        isActive
                          ? "bg-[#EDE9FE] text-[#4C1D95]"
                          : "text-[#1C1926] hover:bg-[#FAF8F5]"
                      }`}
                    >
                      <FileText
                        className={`w-4 h-4 mt-0.5 shrink-0 ${
                          isActive ? "text-[#4C1D95]" : "text-[#797288]"
                        }`}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold truncate leading-snug">
                          {paper.analysis.title || paper.fileName}
                        </p>
                        <p className="text-[11px] text-[#797288] mt-0.5 tabular-nums truncate">
                          {paper.pageCount} pp · {formatRelativeDate(paper.lastOpenedAt)}
                        </p>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* Document Library */}
        <section aria-label="Document library">
          <div className="flex items-center justify-between px-2 mb-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#797288]">
              <FolderOpen className="w-3.5 h-3.5" />
              <span>Document Library</span>
            </div>
            <span className="text-xs font-mono text-[#797288] tabular-nums">
              {filteredLibrary.length}
            </span>
          </div>

          {filteredLibrary.length === 0 ? (
            <div className="px-3 py-6 text-center rounded-xl bg-[#FAF8F5] border border-[#E7E2DA]">
              <p className="text-xs font-medium text-[#524C61]">
                {papers.length === 0 ? "Your library is empty" : "No matching papers"}
              </p>
              <p className="text-[11px] text-[#797288] mt-1 leading-relaxed">
                {papers.length === 0
                  ? "Upload a PDF research paper to start analyzing and chatting."
                  : "Try a different title, author, or discipline keyword."}
              </p>
            </div>
          ) : (
            <ul className="space-y-1">
              {filteredLibrary.map((paper) => {
                const isActive = paper.id === activePaperId;
                const isConfirming = confirmDeleteId === paper.id;

                return (
                  <li
                    key={paper.id}
                    className={`group rounded-lg transition-colors ${
                      isActive ? "bg-[#EDE9FE]" : "hover:bg-[#FAF8F5]"
                    }`}
                  >
                    <div className="flex items-start gap-2 px-2.5 py-2">
                      <button
                        type="button"
                        onClick={() => {
                          onSelectPaper(paper.id);
                          onCloseMobile();
                        }}
                        className="flex-1 min-w-0 text-left focus-visible:outline-2 focus-visible:outline-[#4C1D95] rounded"
                      >
                        <p
                          className={`text-xs font-semibold line-clamp-2 leading-snug ${
                            isActive ? "text-[#4C1D95]" : "text-[#1C1926]"
                          }`}
                        >
                          {paper.analysis.title || paper.fileName}
                        </p>
                        <p className="text-[11px] text-[#797288] mt-1 tabular-nums truncate">
                          {paper.analysis.field || "Research Paper"} · {paper.pageCount} pp
                        </p>
                      </button>

                      {isConfirming ? (
                        <div className="flex items-center gap-1 shrink-0 pt-0.5">
                          <button
                            type="button"
                            onClick={() => {
                              onDeletePaper(paper.id);
                              setConfirmDeleteId(null);
                            }}
                            className="px-2 py-1 text-[11px] font-semibold rounded bg-[#E86A58] text-white hover:bg-[#D45746] transition-colors whitespace-nowrap"
                          >
                            Remove
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="p-1 text-[#797288] hover:text-[#1C1926]"
                            aria-label="Cancel removal"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmDeleteId(paper.id);
                          }}
                          aria-label={`Remove ${paper.analysis.title || paper.fileName}`}
                          className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1.5 rounded-md text-[#797288] hover:text-[#E86A58] hover:bg-white/70 transition-all shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      {/* Bottom Settings Control */}
      <div className="p-3 border-t border-[#E7E2DA] shrink-0">
        <button
          type="button"
          onClick={() => {
            onOpenSettings();
            onCloseMobile();
          }}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-[#524C61] hover:bg-[#FAF8F5] hover:text-[#1C1926] transition-colors focus-visible:outline-2 focus-visible:outline-[#4C1D95]"
        >
          <Settings className="w-4 h-4 shrink-0" />
          <span className="whitespace-nowrap">Workspace Settings</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Static Sidebar */}
      <aside
        aria-label="Library sidebar"
        className="hidden lg:block w-[268px] shrink-0 h-[calc(100vh-4rem)] sticky top-16"
      >
        {sidebarContent}
      </aside>

      {/* Mobile Slide-Over Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-[#1C1926]/30 backdrop-blur-[1px]"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <aside className="relative z-10 w-[290px] max-w-[85vw] h-full shadow-xl">
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
}
