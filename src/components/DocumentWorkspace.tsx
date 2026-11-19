import { useState } from "react";
import { ArrowLeft, FileText, LayoutGrid, MessageSquare } from "lucide-react";
import type { PaperRecord, QuestionFocus } from "../types/paper";
import { PdfViewer } from "./PdfViewer";
import { AiChatPanel } from "./AiChatPanel";

interface DocumentWorkspaceProps {
  paper: PaperRecord;
  pdfBlob: Blob | null;
  defaultZoom: number;
  isStreaming: boolean;
  isGeneratingQuestions: boolean;
  onSendMessage: (question: string) => void;
  onStopStreaming: () => void;
  onClearChat: () => void;
  onRegenerateQuestions: (focus: QuestionFocus) => void;
  onSwitchToSummary: () => void;
  onBackToDashboard: () => void;
}

export function DocumentWorkspace({
  paper,
  pdfBlob,
  defaultZoom,
  isStreaming,
  isGeneratingQuestions,
  onSendMessage,
  onStopStreaming,
  onClearChat,
  onRegenerateQuestions,
  onSwitchToSummary,
  onBackToDashboard,
}: DocumentWorkspaceProps) {
  const [mobilePane, setMobilePane] = useState<"pdf" | "chat">("chat");
  const [jumpToPageRequest, setJumpToPageRequest] = useState<{
    page: number;
    nonce: number;
  } | null>(null);

  const handleJumpToPage = (page: number) => {
    setJumpToPageRequest({ page, nonce: Date.now() });
    setMobilePane("pdf");
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] overflow-hidden">
      {/* Contextual Workspace Sub-Header */}
      <div className="px-4 lg:px-6 py-3 bg-[#FAF8F5] border-b border-[#E7E2DA] flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onBackToDashboard}
            aria-label="Back to dashboard"
            className="w-8 h-8 rounded-lg inline-flex items-center justify-center text-[#524C61] hover:bg-[#FFFFFF] hover:text-[#1C1926] border border-transparent hover:border-[#E7E2DA] transition-colors shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div className="min-w-0">
            <h1
              title={paper.analysis.title || paper.fileName}
              className="font-display text-base sm:text-lg font-semibold text-[#1C1926] truncate leading-tight"
            >
              {paper.analysis.title || paper.fileName}
            </h1>
            <p className="text-xs text-[#797288] truncate mt-0.5 tabular-nums">
              {paper.analysis.field || "Research Paper"}
              {paper.analysis.publicationYear ? ` · ${paper.analysis.publicationYear}` : ""}
              {` · ${paper.pageCount} pages`}
              {paper.wordCount > 0 ? ` · ~${paper.wordCount.toLocaleString()} words` : ""}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Mobile Pane Switcher */}
          <div className="flex lg:hidden items-center gap-1 p-1 rounded-xl bg-[#F4F1EC] border border-[#E7E2DA]">
            <button
              type="button"
              onClick={() => setMobilePane("pdf")}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                mobilePane === "pdf"
                  ? "bg-[#FFFFFF] text-[#4C1D95] shadow-xs"
                  : "text-[#524C61]"
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>PDF</span>
            </button>
            <button
              type="button"
              onClick={() => setMobilePane("chat")}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                mobilePane === "chat"
                  ? "bg-[#FFFFFF] text-[#4C1D95] shadow-xs"
                  : "text-[#524C61]"
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>AI Chat</span>
            </button>
          </div>

          {/* Summary View Switch Button */}
          <button
            type="button"
            onClick={onSwitchToSummary}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#F5F3FF] text-[#4C1D95] border border-[#DDD6FE] hover:bg-[#EDE9FE] transition-colors whitespace-nowrap shrink-0"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Summary Cards</span>
            <span className="sm:hidden">Summary</span>
          </button>
        </div>
      </div>

      {/* Main Split Panes: Left PDF Preview + Right AI Chat */}
      <div className="flex-1 min-h-0 p-3 sm:p-4 lg:p-5 grid grid-cols-1 lg:grid-cols-12 gap-4 overflow-hidden">
        {/* Left Pane: PDF Preview */}
        <section
          aria-label="PDF document preview"
          className={`lg:col-span-7 min-h-0 h-full ${
            mobilePane === "pdf" ? "block" : "hidden lg:block"
          }`}
        >
          <PdfViewer
            paperId={paper.id}
            fileName={paper.fileName}
            pdfBlob={pdfBlob}
            extractedText={paper.extractedText}
            initialZoom={defaultZoom}
            jumpToPageRequest={jumpToPageRequest}
          />
        </section>

        {/* Right Pane: AI Research Chat */}
        <section
          aria-label="AI research assistant chat"
          className={`lg:col-span-5 min-h-0 h-full ${
            mobilePane === "chat" ? "block" : "hidden lg:block"
          }`}
        >
          <AiChatPanel
            paper={paper}
            isStreaming={isStreaming}
            isGeneratingQuestions={isGeneratingQuestions}
            onSendMessage={onSendMessage}
            onStopStreaming={onStopStreaming}
            onClearChat={onClearChat}
            onRegenerateQuestions={onRegenerateQuestions}
            onJumpToPage={handleJumpToPage}
          />
        </section>
      </div>
    </div>
  );
}
