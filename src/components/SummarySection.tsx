import { useState } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  BookOpen,
  Check,
  Copy,
  FlaskConical,
  Flag,
  HelpCircle,
  MessageSquare,
  RefreshCw,
  Target,
} from "lucide-react";
import type { PaperRecord, QuestionFocus } from "../types/paper";
import { formatFileSize } from "../lib/pdf";

interface SummarySectionProps {
  paper: PaperRecord;
  isGeneratingQuestions: boolean;
  onAskQuestionInChat: (question: string) => void;
  onRegenerateQuestions: (focus: QuestionFocus) => void;
  onOpenWorkspace: () => void;
}

export function SummarySection({
  paper,
  isGeneratingQuestions,
  onAskQuestionInChat,
  onRegenerateQuestions,
  onOpenWorkspace,
}: SummarySectionProps) {
  const [questionFocus, setQuestionFocus] = useState<QuestionFocus>("comprehension");
  const [copiedSummary, setCopiedSummary] = useState(false);

  const { analysis } = paper;

  const handleCopyBrief = async () => {
    const markdown = [
      `# ${analysis.title || paper.fileName}`,
      analysis.authors.length ? `Authors: ${analysis.authors.join(", ")}` : "",
      "",
      "## Executive Summary",
      analysis.executiveSummary,
      "",
      "## Research Objectives",
      analysis.objectives.summary,
      ...analysis.objectives.keyPoints.map((p) => `- ${p}`),
      "",
      "## Methodology",
      analysis.methodology.summary,
      ...analysis.methodology.keyPoints.map((p) => `- ${p}`),
      "",
      "## Key Findings & Results",
      analysis.results.summary,
      ...analysis.results.keyPoints.map((p) => `- ${p}`),
      "",
      "## Limitations",
      analysis.limitations.summary,
      ...analysis.limitations.keyPoints.map((p) => `- ${p}`),
      "",
      "## Conclusion",
      analysis.conclusion.summary,
      ...analysis.conclusion.keyPoints.map((p) => `- ${p}`),
    ]
      .filter((line) => line !== undefined)
      .join("\n");

    try {
      await navigator.clipboard.writeText(markdown);
      setCopiedSummary(true);
      setTimeout(() => setCopiedSummary(false), 2000);
    } catch {
      // Ignore clipboard permission errors
    }
  };

  const sectionCards = [
    {
      id: "objectives",
      title: "Research Objectives",
      icon: Target,
      accentClass: "text-[#4C1D95] bg-[#EDE9FE]",
      data: analysis.objectives,
      askPrompt: "Explain the primary research objectives and hypotheses of this paper in detail.",
    },
    {
      id: "methodology",
      title: "Methodology",
      icon: FlaskConical,
      accentClass: "text-[#4C1D95] bg-[#EDE9FE]",
      data: analysis.methodology,
      askPrompt: "Walk me step-by-step through the methodology, data, and experimental setup used in this paper.",
    },
    {
      id: "results",
      title: "Key Findings & Results",
      icon: BarChart3,
      accentClass: "text-[#4C1D95] bg-[#EDE9FE]",
      data: analysis.results,
      askPrompt: "What are the most important quantitative findings and evidence reported in the results?",
    },
    {
      id: "limitations",
      title: "Limitations",
      icon: AlertTriangle,
      accentClass: "text-[#E86A58] bg-[#FFF1EE]",
      data: analysis.limitations,
      askPrompt: "What limitations, constraints, or caveats do the authors acknowledge in this paper?",
    },
    {
      id: "conclusion",
      title: "Conclusion",
      icon: Flag,
      accentClass: "text-[#4C1D95] bg-[#EDE9FE]",
      data: analysis.conclusion,
      askPrompt: "Summarize the authors' main conclusions and any proposed future research directions.",
    },
  ];

  const focusOptions: Array<{ value: QuestionFocus; label: string }> = [
    { value: "comprehension", label: "Comprehension" },
    { value: "methodology", label: "Methodology" },
    { value: "critical", label: "Critical Review" },
    { value: "exam", label: "Exam Prep" },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-7 space-y-8">
      {/* Paper Title & Executive Summary Header */}
      <section className="bg-[#FFFFFF] rounded-2xl border border-[#E7E2DA] p-6 sm:p-8 shadow-[0_2px_10px_rgba(28,25,38,0.03)] space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div className="space-y-2 max-w-3xl">
            <p className="text-xs text-[#797288] flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="font-semibold text-[#4C1D95]">
                {analysis.field || "Academic Paper"}
              </span>
              {analysis.venue && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{analysis.venue}</span>
                </>
              )}
              {analysis.publicationYear && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums">{analysis.publicationYear}</span>
                </>
              )}
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">{paper.pageCount} pages</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">{formatFileSize(paper.fileSize)}</span>
            </p>

            <h1 className="font-display text-2xl sm:text-3xl font-semibold text-[#1C1926] leading-snug text-balance">
              {analysis.title || paper.fileName}
            </h1>

            {analysis.authors.length > 0 && (
              <p className="text-sm text-[#524C61]">
                {analysis.authors.join(", ")}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handleCopyBrief}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold text-[#524C61] bg-[#FAF8F5] border border-[#E7E2DA] hover:text-[#1C1926] hover:border-[#D4CEC4] transition-colors whitespace-nowrap"
            >
              {copiedSummary ? (
                <>
                  <Check className="w-3.5 h-3.5 text-[#4C1D95]" />
                  <span>Copied Brief</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Notes</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onOpenWorkspace}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-[#4C1D95] text-white hover:bg-[#3B157A] transition-colors whitespace-nowrap"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Open PDF &amp; Chat</span>
            </button>
          </div>
        </div>

        <div className="pt-4 border-t border-[#F0ECE5] space-y-1.5">
          <h2 className="text-xs font-semibold text-[#797288]">Executive Summary</h2>
          <p className="text-[15px] text-[#1C1926] leading-relaxed max-w-4xl">
            {analysis.executiveSummary}
          </p>
        </div>
      </section>

      {/* Separate Structured Summary Cards: Objectives, Methodology, Findings, Limitations, Conclusion */}
      <section aria-label="Structured paper breakdown" className="space-y-4">
        <h2 className="font-display text-xl font-semibold text-[#1C1926]">
          Structured Paper Breakdown
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {sectionCards.map((card, index) => {
            const Icon = card.icon;
            const isFullSpan = index === sectionCards.length - 1;
            return (
              <article
                key={card.id}
                className={`bg-[#FFFFFF] rounded-2xl border border-[#E7E2DA] p-6 shadow-[0_1px_3px_rgba(28,25,38,0.03)] flex flex-col justify-between gap-4 ${
                  isFullSpan ? "md:col-span-2" : ""
                }`}
              >
                <div className="space-y-3.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span
                        className={`w-9 h-9 rounded-xl inline-flex items-center justify-center shrink-0 ${card.accentClass}`}
                      >
                        <Icon className="w-4.5 h-4.5" />
                      </span>
                      <h3 className="font-display text-lg font-semibold text-[#1C1926]">
                        {card.title}
                      </h3>
                    </div>

                    <button
                      type="button"
                      onClick={() => onAskQuestionInChat(card.askPrompt)}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-[#4C1D95] hover:text-[#3B157A] transition-colors whitespace-nowrap shrink-0"
                    >
                      <span>Explore in Chat</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <p className="text-sm text-[#1C1926] leading-relaxed">
                    {card.data?.summary || "Not explicitly stated in the uploaded document."}
                  </p>

                  {Array.isArray(card.data?.keyPoints) && card.data.keyPoints.length > 0 && (
                    <ul className="space-y-2 pt-1">
                      {card.data.keyPoints.map((point, idx) => (
                        <li
                          key={`${card.id}-pt-${idx}`}
                          className="flex items-start gap-2.5 text-sm text-[#524C61] leading-relaxed"
                        >
                          <span
                            className="w-1.5 h-1.5 rounded-full bg-[#4C1D95]/60 mt-2 shrink-0"
                            aria-hidden="true"
                          />
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* Important Study & Research Questions */}
      <section aria-label="Important questions" className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <HelpCircle className="w-5 h-5 text-[#E86A58]" />
            <h2 className="font-display text-xl font-semibold text-[#1C1926]">
              Important Questions to Explore
            </h2>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div
              role="group"
              aria-label="Question focus filter"
              className="inline-flex items-center gap-1 p-1 rounded-xl bg-[#F4F1EC] border border-[#E7E2DA]"
            >
              {focusOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setQuestionFocus(opt.value)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                    questionFocus === opt.value
                      ? "bg-[#FFFFFF] text-[#4C1D95] shadow-xs"
                      : "text-[#524C61] hover:text-[#1C1926]"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              disabled={isGeneratingQuestions}
              onClick={() => onRegenerateQuestions(questionFocus)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#F5F3FF] text-[#4C1D95] border border-[#DDD6FE] hover:bg-[#EDE9FE] disabled:opacity-50 transition-colors whitespace-nowrap"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isGeneratingQuestions ? "animate-spin" : ""}`}
              />
              <span>{isGeneratingQuestions ? "Generating..." : "New Set"}</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {analysis.importantQuestions.map((q, idx) => (
            <button
              key={`summary-q-${idx}-${q.question.slice(0, 16)}`}
              type="button"
              onClick={() => onAskQuestionInChat(q.question)}
              className="text-left bg-[#FFFFFF] rounded-xl border border-[#E7E2DA] p-5 hover:border-[#4C1D95] hover:bg-[#FCFBFD] transition-colors group flex flex-col justify-between gap-3"
            >
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-[#E86A58]">{q.category}</p>
                <p className="text-sm font-semibold text-[#1C1926] group-hover:text-[#4C1D95] leading-snug transition-colors">
                  {q.question}
                </p>
                <p className="text-xs text-[#524C61] leading-relaxed">{q.rationale}</p>
              </div>
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#4C1D95]">
                <span>Ask AI Assistant</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* Key Terminology Extracted From Paper */}
      {analysis.keyTerms && analysis.keyTerms.length > 0 && (
        <section aria-label="Key terminology" className="space-y-4">
          <div className="flex items-center gap-2.5">
            <BookOpen className="w-5 h-5 text-[#4C1D95]" />
            <h2 className="font-display text-xl font-semibold text-[#1C1926]">
              Key Concepts &amp; Terminology
            </h2>
          </div>

          <dl className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {analysis.keyTerms.map((item, idx) => (
              <div
                key={`term-${idx}`}
                className="bg-[#FFFFFF] rounded-xl border border-[#E7E2DA] p-4 space-y-1.5"
              >
                <dt className="text-sm font-semibold text-[#1C1926]">{item.term}</dt>
                <dd className="text-xs text-[#524C61] leading-relaxed">{item.definition}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
    </div>
  );
}
