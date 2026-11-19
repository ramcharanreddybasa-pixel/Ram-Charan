import { useRef, useState } from "react";
import type { DragEvent, ChangeEvent } from "react";
import { motion } from "motion/react";
import {
  AlertCircle,
  ArrowRight,
  BookMarked,
  CheckCircle2,
  FileText,
  FileUp,
  HelpCircle,
  MessageSquareText,
  X,
} from "lucide-react";
import type { PaperRecord, UserProfile } from "../types/paper";
import { formatFileSize, formatRelativeDate } from "../lib/pdf";

export type ProcessingStage = "idle" | "extracting" | "analyzing" | "finalizing";

interface DashboardViewProps {
  userProfile: UserProfile;
  papers: PaperRecord[];
  processingStage: ProcessingStage;
  processingFileName: string;
  processingPageCount: number;
  uploadError: string | null;
  onDismissError: () => void;
  onFileSelected: (file: File) => void;
  onOpenPaper: (paperId: string, initialView?: "workspace" | "summary") => void;
}

function getTimeGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function DashboardView({
  userProfile,
  papers,
  processingStage,
  processingFileName,
  processingPageCount,
  uploadError,
  onDismissError,
  onFileSelected,
  onOpenPaper,
}: DashboardViewProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const isProcessing = processingStage !== "idle";
  const firstName = userProfile.name.trim() || "Researcher";

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!isProcessing) setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (isProcessing) return;
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) {
      onFileSelected(dropped);
    }
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const chosen = e.target.files?.[0];
    if (chosen) {
      onFileSelected(chosen);
    }
    e.target.value = "";
  };

  const stageSteps: Array<{ key: ProcessingStage; label: string; detail: string }> = [
    {
      key: "extracting",
      label: "Reading PDF structure",
      detail: processingPageCount > 0 ? `${processingPageCount} pages indexed` : "Parsing pages and layout",
    },
    {
      key: "analyzing",
      label: "Synthesizing paper sections",
      detail: "Extracting objectives, methodology, findings, limitations & conclusions",
    },
    {
      key: "finalizing",
      label: "Preparing study questions",
      detail: "Building grounded Q&A workspace",
    },
  ];

  const activeStepIndex =
    processingStage === "extracting"
      ? 0
      : processingStage === "analyzing"
      ? 1
      : processingStage === "finalizing"
      ? 2
      : -1;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-10 py-8 lg:py-12 space-y-10">
      {/* Welcome Header */}
      <section className="space-y-3">
        <p className="text-sm font-medium text-[#4C1D95]">
          {getTimeGreeting()}, {firstName}
        </p>
        <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-[#1C1926] text-balance max-w-2xl leading-[1.15]">
          Read deeper into any academic paper in minutes.
        </h1>
        <p className="text-base text-[#524C61] max-w-2xl leading-relaxed">
          Upload a research paper in PDF format to inspect its full text alongside a grounded AI
          assistant, structured section summaries, and tailored study questions.
        </p>
      </section>

      {/* Error Alert Banner */}
      {uploadError && (
        <div
          role="alert"
          className="flex items-start gap-3 p-4 rounded-xl bg-[#FFF1EE] border border-[#F5C2B8] text-[#8E2A1E]"
        >
          <AlertCircle className="w-5 h-5 text-[#E86A58] shrink-0 mt-0.5" />
          <div className="flex-1 text-sm leading-relaxed">
            <p className="font-semibold text-[#6E1F15]">Unable to process document</p>
            <p className="mt-0.5 text-[#8E2A1E]">{uploadError}</p>
          </div>
          <button
            type="button"
            onClick={onDismissError}
            aria-label="Dismiss error"
            className="p-1 rounded-md text-[#8E2A1E] hover:bg-[#F5C2B8]/40 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Single Dominant Focal Anchor: Large PDF Upload Area or Processing Animation */}
      <section aria-label="Upload research paper">
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf,.pdf"
          onChange={handleInputChange}
          className="hidden"
          aria-hidden="true"
        />

        {isProcessing ? (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="bg-[#FFFFFF] rounded-2xl border border-[#DDD6FE] shadow-[0_4px_20px_rgba(76,29,149,0.06)] p-6 sm:p-10"
          >
            <div className="max-w-xl mx-auto text-center space-y-6">
              {/* Clean Academic Orbital Loader */}
              <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 2.2, ease: "linear" }}
                  className="absolute inset-0 rounded-full border-2 border-[#EDE9FE] border-t-[#4C1D95] border-r-[#E86A58]"
                />
                <motion.div
                  animate={{ scale: [0.95, 1.05, 0.95] }}
                  transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
                  className="w-10 h-10 rounded-full bg-[#F5F3FF] flex items-center justify-center text-[#4C1D95]"
                >
                  <FileText className="w-5 h-5" />
                </motion.div>
              </div>

              <div className="space-y-1.5">
                <h2 className="font-display text-xl sm:text-2xl font-semibold text-[#1C1926]">
                  Analyzing your research paper
                </h2>
                <p className="text-sm text-[#524C61] truncate max-w-md mx-auto">
                  {processingFileName}
                </p>
              </div>

              {/* Clean Progress Steps */}
              <ol className="text-left space-y-3 pt-2">
                {stageSteps.map((step, index) => {
                  const isDone = index < activeStepIndex;
                  const isCurrent = index === activeStepIndex;
                  return (
                    <li
                      key={step.key}
                      className={`flex items-start gap-3 p-3 rounded-xl border transition-colors ${
                        isCurrent
                          ? "bg-[#F5F3FF] border-[#DDD6FE]"
                          : isDone
                          ? "bg-[#FAF8F5] border-[#E7E2DA]"
                          : "bg-white border-transparent opacity-55"
                      }`}
                    >
                      <span className="mt-0.5 shrink-0">
                        {isDone ? (
                          <CheckCircle2 className="w-4 h-4 text-[#4C1D95]" />
                        ) : isCurrent ? (
                          <motion.span
                            animate={{ opacity: [0.4, 1, 0.4] }}
                            transition={{ repeat: Infinity, duration: 1.2 }}
                            className="block w-4 h-4 rounded-full border-2 border-[#4C1D95] bg-[#EDE9FE]"
                          />
                        ) : (
                          <span className="block w-4 h-4 rounded-full border border-[#D4CEC4]" />
                        )}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[#1C1926]">{step.label}</p>
                        <p className="text-xs text-[#524C61] mt-0.5">{step.detail}</p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          </motion.div>
        ) : (
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            aria-label="Upload a PDF research paper by clicking or dragging and dropping"
            className={`group relative rounded-2xl border-2 border-dashed transition-all duration-200 cursor-pointer px-6 py-12 sm:py-16 text-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4C1D95] ${
              isDragging
                ? "border-[#4C1D95] bg-[#F5F3FF] shadow-[0_8px_28px_rgba(76,29,149,0.08)]"
                : "border-[#D4CBE6] bg-[#FFFFFF] hover:border-[#4C1D95] hover:bg-[#FCFBFD] shadow-[0_2px_10px_rgba(28,25,38,0.03)]"
            }`}
          >
            <div className="max-w-lg mx-auto space-y-5">
              <div
                className={`w-14 h-14 mx-auto rounded-2xl flex items-center justify-center transition-transform duration-200 group-hover:-translate-y-0.5 ${
                  isDragging
                    ? "bg-[#4C1D95] text-white"
                    : "bg-[#EDE9FE] text-[#4C1D95]"
                }`}
              >
                <FileUp className="w-7 h-7" strokeWidth={1.9} />
              </div>

              <div className="space-y-2">
                <h2 className="font-display text-2xl font-semibold text-[#1C1926]">
                  {isDragging ? "Drop your PDF paper here" : "Upload a research paper"}
                </h2>
                <p className="text-sm text-[#524C61] leading-relaxed">
                  Drag and drop your PDF file here, or select one from your computer to extract
                  summaries, methods, findings, and ask grounded questions.
                </p>
              </div>

              <div className="pt-1">
                <span className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#4C1D95] text-white text-sm font-medium group-hover:bg-[#3B157A] transition-colors">
                  <FileUp className="w-4 h-4" />
                  <span>Choose PDF Document</span>
                </span>
              </div>

              <p className="text-xs text-[#797288] pt-1">
                PDF format · Up to 25 MB · Strictly grounded answers with source verification
              </p>
            </div>
          </div>
        )}
      </section>

      {/* Bottom Area: Recent Papers if available, else 3-Step Scholarly Workflow */}
      {papers.length > 0 ? (
        <section aria-label="Continue reading" className="space-y-4">
          <div className="flex items-baseline justify-between gap-4 border-b border-[#E7E2DA] pb-3">
            <h2 className="font-display text-xl font-semibold text-[#1C1926]">
              Continue Reading
            </h2>
            <span className="text-xs text-[#797288] tabular-nums">
              {papers.length} {papers.length === 1 ? "paper" : "papers"} in library
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {papers.slice(0, 4).map((paper) => (
              <article
                key={paper.id}
                className="bg-[#FFFFFF] rounded-xl border border-[#E7E2DA] p-5 flex flex-col justify-between gap-4 hover:border-[#C8BFE0] transition-colors shadow-[0_1px_3px_rgba(28,25,38,0.03)]"
              >
                <div className="space-y-2">
                  <p className="text-xs text-[#797288] truncate">
                    {paper.analysis.field || "Academic Paper"}
                    {paper.analysis.publicationYear ? ` · ${paper.analysis.publicationYear}` : ""}
                    {" · "}
                    <span className="tabular-nums">{paper.pageCount} pages</span>
                  </p>

                  <h3 className="font-display text-lg font-semibold text-[#1C1926] leading-snug line-clamp-2">
                    {paper.analysis.title || paper.fileName}
                  </h3>

                  {paper.analysis.authors.length > 0 && (
                    <p className="text-xs text-[#524C61] truncate">
                      {paper.analysis.authors.slice(0, 3).join(", ")}
                      {paper.analysis.authors.length > 3 ? " et al." : ""}
                    </p>
                  )}

                  <p className="text-sm text-[#524C61] line-clamp-2 leading-relaxed pt-1">
                    {paper.analysis.executiveSummary}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-[#F0ECE5] gap-3">
                  <span className="text-xs text-[#797288] tabular-nums">
                    {formatFileSize(paper.fileSize)} · {formatRelativeDate(paper.lastOpenedAt)}
                  </span>

                  <div className="flex items-center gap-3 shrink-0">
                    <button
                      type="button"
                      onClick={() => onOpenPaper(paper.id, "summary")}
                      className="text-xs font-semibold text-[#524C61] hover:text-[#4C1D95] transition-colors whitespace-nowrap"
                    >
                      Summary
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenPaper(paper.id, "workspace")}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-[#4C1D95] hover:text-[#3B157A] transition-colors whitespace-nowrap"
                    >
                      <span>Open Workspace</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : (
        <section aria-label="How ResearchMate AI works" className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-2">
          <div className="bg-[#FFFFFF] rounded-xl border border-[#E7E2DA] p-5 space-y-2.5">
            <BookMarked className="w-5 h-5 text-[#4C1D95]" />
            <h3 className="font-display text-base font-semibold text-[#1C1926]">
              01. Structured Breakdown
            </h3>
            <p className="text-sm text-[#524C61] leading-relaxed">
              Automatically separates research objectives, methodology, empirical findings,
              limitations, and conclusions into scannable academic cards.
            </p>
          </div>

          <div className="bg-[#FFFFFF] rounded-xl border border-[#E7E2DA] p-5 space-y-2.5">
            <MessageSquareText className="w-5 h-5 text-[#4C1D95]" />
            <h3 className="font-display text-base font-semibold text-[#1C1926]">
              02. Document-Grounded Chat
            </h3>
            <p className="text-sm text-[#524C61] leading-relaxed">
              Ask detailed questions side-by-side with the PDF. Every answer cites the document
              and transparently flags when information is absent.
            </p>
          </div>

          <div className="bg-[#FFFFFF] rounded-xl border border-[#E7E2DA] p-5 space-y-2.5">
            <HelpCircle className="w-5 h-5 text-[#E86A58]" />
            <h3 className="font-display text-base font-semibold text-[#1C1926]">
              03. Tailored Study Questions
            </h3>
            <p className="text-sm text-[#524C61] leading-relaxed">
              Generates critical reading, methodology, and seminar questions unique to your paper
              so you can test comprehension quickly.
            </p>
          </div>
        </section>
      )}
    </div>
  );
}
