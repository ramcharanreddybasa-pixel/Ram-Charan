import { useEffect, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  AlertCircle,
  AlertTriangle,
  ArrowUp,
  BookOpenCheck,
  Check,
  Copy,
  RefreshCw,
  RotateCcw,
  Square,
} from "lucide-react";
import type {
  ChatMessage,
  ImportantQuestion,
  PaperRecord,
  QuestionFocus,
} from "../types/paper";

interface AiChatPanelProps {
  paper: PaperRecord;
  isStreaming: boolean;
  isGeneratingQuestions: boolean;
  onSendMessage: (question: string) => void;
  onStopStreaming: () => void;
  onClearChat: () => void;
  onRegenerateQuestions: (focus: QuestionFocus) => void;
  onJumpToPage: (page: number) => void;
}

function extractCitedPages(text: string, maxPage: number): number[] {
  const matches = new Set<number>();
  const regex = /\b(?:p\.|pp\.|page)\s*(\d{1,4})/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const num = parseInt(match[1], 10);
    if (num >= 1 && num <= maxPage) {
      matches.add(num);
    }
  }
  return Array.from(matches).sort((a, b) => a - b).slice(0, 6);
}

function detectNotFound(content: string): boolean {
  const normalized = content.trim().toLowerCase();
  return (
    normalized.startsWith("**not found in the uploaded document") ||
    normalized.startsWith("not found in the uploaded document")
  );
}

export function AiChatPanel({
  paper,
  isStreaming,
  isGeneratingQuestions,
  onSendMessage,
  onStopStreaming,
  onClearChat,
  onRegenerateQuestions,
  onJumpToPage,
}: AiChatPanelProps) {
  const [input, setInput] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedFocus, setSelectedFocus] = useState<QuestionFocus>("comprehension");
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const messages = paper.chatHistory;
  const suggestedQuestions: ImportantQuestion[] = paper.analysis.importantQuestions || [];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, messages[messages.length - 1]?.content]);

  const handleSubmit = (e?: FormEvent) => {
    e?.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    onSendMessage(trimmed);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleCopy = async (msg: ChatMessage) => {
    try {
      await navigator.clipboard.writeText(msg.content);
      setCopiedId(msg.id);
      setTimeout(() => setCopiedId((curr) => (curr === msg.id ? null : curr)), 1800);
    } catch {
      // Clipboard write unavailable
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#FFFFFF] rounded-2xl border border-[#E7E2DA] overflow-hidden">
      {/* Chat Panel Header */}
      <div className="px-4 py-3 border-b border-[#E7E2DA] flex items-center justify-between gap-3 shrink-0 bg-[#FFFFFF]">
        <div className="min-w-0">
          <h2 className="font-display text-base font-semibold text-[#1C1926] truncate">
            Research Assistant Chat
          </h2>
          <p className="text-xs text-[#797288] truncate">
            Answers grounded strictly in this uploaded PDF
          </p>
        </div>

        {messages.length > 0 && (
          <button
            type="button"
            onClick={onClearChat}
            disabled={isStreaming}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#524C61] hover:bg-[#FAF8F5] hover:text-[#1C1926] disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        )}
      </div>

      {/* Scrollable Transcript Area */}
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-5 bg-[#FAF8F5]/60">
        {messages.length === 0 ? (
          <div className="space-y-5">
            {/* Grounded Welcome Note */}
            <div className="bg-[#FFFFFF] rounded-xl border border-[#E7E2DA] p-4 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#4C1D95]">
                <BookOpenCheck className="w-4 h-4 shrink-0" />
                <span>Document Grounding Active</span>
              </div>
              <p className="text-sm text-[#524C61] leading-relaxed">
                Ask anything about <span className="font-medium text-[#1C1926]">{paper.analysis.title || paper.fileName}</span>—methods,
                datasets, equations, tables, or limitations. If a detail is not present in the
                paper, I will state that clearly instead of guessing.
              </p>
            </div>

            {/* Suggested Important Questions */}
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <h3 className="text-xs font-semibold text-[#524C61]">
                  Important Questions From This Paper
                </h3>
                <div className="flex items-center gap-1.5">
                  <select
                    value={selectedFocus}
                    onChange={(e) => setSelectedFocus(e.target.value as QuestionFocus)}
                    aria-label="Select question focus"
                    className="text-xs bg-white border border-[#E7E2DA] rounded-lg px-2 py-1 text-[#524C61] focus:outline-none focus:border-[#4C1D95]"
                  >
                    <option value="comprehension">Comprehension</option>
                    <option value="methodology">Methodology</option>
                    <option value="critical">Critical Review</option>
                    <option value="exam">Exam Prep</option>
                  </select>
                  <button
                    type="button"
                    disabled={isGeneratingQuestions}
                    onClick={() => onRegenerateQuestions(selectedFocus)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-[#F5F3FF] text-[#4C1D95] border border-[#DDD6FE] hover:bg-[#EDE9FE] disabled:opacity-50 transition-colors whitespace-nowrap"
                  >
                    <RefreshCw
                      className={`w-3 h-3 ${isGeneratingQuestions ? "animate-spin" : ""}`}
                    />
                    <span>Refresh</span>
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                {suggestedQuestions.slice(0, 5).map((item, idx) => (
                  <button
                    key={`q-${idx}-${item.question.slice(0, 20)}`}
                    type="button"
                    disabled={isStreaming}
                    onClick={() => onSendMessage(item.question)}
                    className="w-full text-left p-3.5 rounded-xl bg-[#FFFFFF] border border-[#E7E2DA] hover:border-[#4C1D95] hover:bg-[#FCFBFD] transition-colors group"
                  >
                    <p className="text-xs text-[#E86A58] font-medium mb-1">
                      {item.category}
                    </p>
                    <p className="text-sm font-medium text-[#1C1926] group-hover:text-[#4C1D95] leading-snug transition-colors">
                      {item.question}
                    </p>
                    {item.rationale && (
                      <p className="text-xs text-[#797288] mt-1 leading-relaxed">
                        {item.rationale}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg) => {
              if (msg.role === "user") {
                return (
                  <div key={msg.id} className="flex justify-end">
                    <div className="max-w-[85%] rounded-2xl rounded-br-md bg-[#EDE9FE] text-[#1C1926] px-4 py-3 text-sm leading-relaxed">
                      {msg.content}
                    </div>
                  </div>
                );
              }

              const isNotFound = msg.notFoundInDocument || detectNotFound(msg.content);
              const citedPages = extractCitedPages(msg.content, paper.pageCount);

              return (
                <div key={msg.id} className="flex justify-start">
                  <div className="w-full max-w-[95%] bg-[#FFFFFF] rounded-2xl rounded-bl-md border border-[#E7E2DA] p-4 shadow-[0_1px_2px_rgba(28,25,38,0.03)] space-y-3">
                    {/* Explicit Not-Found Grounding Notice (Icon + Text, never color alone) */}
                    {isNotFound && !msg.error && (
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#FFF1EE] border border-[#F5C2B8] text-xs font-semibold text-[#8E2A1E]">
                        <AlertTriangle className="w-4 h-4 text-[#E86A58] shrink-0" />
                        <span>Outside document scope — not stated in this PDF</span>
                      </div>
                    )}

                    {/* Error Message */}
                    {msg.error ? (
                      <div className="flex items-start gap-2.5 text-sm text-[#8E2A1E]">
                        <AlertCircle className="w-4 h-4 text-[#E86A58] shrink-0 mt-0.5" />
                        <div className="space-y-2">
                          <p className="font-medium">Unable to generate answer</p>
                          <p className="text-xs leading-relaxed">{msg.error}</p>
                        </div>
                      </div>
                    ) : msg.content ? (
                      <div className="academic-prose">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-sm text-[#797288] py-1">
                        <span className="w-4 h-4 rounded-full border-2 border-[#DDD6FE] border-t-[#4C1D95] animate-spin" />
                        <span>Reading document passages...</span>
                      </div>
                    )}

                    {/* Citations Quick-Jump & Copy Utility Bar */}
                    {!msg.isStreaming && msg.content && !msg.error && (
                      <div className="pt-2.5 border-t border-[#F0ECE5] flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {citedPages.length > 0 && (
                            <>
                              <span className="text-[11px] text-[#797288]">Jump to:</span>
                              {citedPages.map((pg) => (
                                <button
                                  key={`${msg.id}-p-${pg}`}
                                  type="button"
                                  onClick={() => onJumpToPage(pg)}
                                  className="px-2 py-0.5 rounded-md text-[11px] font-mono tabular-nums font-medium bg-[#F5F3FF] text-[#4C1D95] border border-[#DDD6FE] hover:bg-[#EDE9FE] transition-colors"
                                >
                                  p. {pg}
                                </button>
                              ))}
                            </>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => handleCopy(msg)}
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-[#797288] hover:text-[#1C1926] transition-colors"
                        >
                          {copiedId === msg.id ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-[#4C1D95]" />
                              <span className="text-[#4C1D95]">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Quick Follow-Up Prompts after conversation begins */}
            {!isStreaming && suggestedQuestions.length > 0 && messages.length <= 4 && (
              <div className="pt-2 space-y-2">
                <p className="text-[11px] font-semibold text-[#797288]">
                  Suggested follow-up questions
                </p>
                <div className="flex flex-wrap gap-2">
                  {suggestedQuestions.slice(0, 3).map((item, i) => (
                    <button
                      key={`followup-${i}`}
                      type="button"
                      onClick={() => onSendMessage(item.question)}
                      className="text-left text-xs text-[#4C1D95] bg-[#FFFFFF] border border-[#DDD6FE] hover:bg-[#F5F3FF] rounded-lg px-3 py-1.5 transition-colors line-clamp-1 max-w-full"
                    >
                      {item.question}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Composer Input Bar */}
      <form
        onSubmit={handleSubmit}
        className="p-3 bg-[#FFFFFF] border-t border-[#E7E2DA] shrink-0"
      >
        <div className="flex items-end gap-2 rounded-xl border border-[#DDD6FE] bg-[#FAF8F5] focus-within:bg-[#FFFFFF] focus-within:border-[#4C1D95] transition-colors p-2">
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = `${Math.min(e.target.scrollHeight, 128)}px`;
            }}
            onKeyDown={handleKeyDown}
            disabled={isStreaming}
            placeholder="Ask a question about this paper..."
            aria-label="Ask a question about the uploaded research paper"
            className="flex-1 resize-none bg-transparent text-sm text-[#1C1926] placeholder:text-[#797288] focus:outline-none px-2 py-1.5 leading-relaxed max-h-32"
          />

          {isStreaming ? (
            <button
              type="button"
              onClick={onStopStreaming}
              aria-label="Stop generating response"
              className="w-9 h-9 rounded-lg bg-[#E86A58] text-white hover:bg-[#D45746] inline-flex items-center justify-center shrink-0 transition-colors"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              aria-label="Send question"
              className="w-9 h-9 rounded-lg bg-[#4C1D95] text-white hover:bg-[#3B157A] disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center justify-center shrink-0 transition-colors"
            >
              <ArrowUp className="w-4 h-4" />
            </button>
          )}
        </div>
        <p className="text-[11px] text-[#797288] mt-1.5 px-1">
          Press Enter to ask · Shift + Enter for a new line
        </p>
      </form>
    </div>
  );
}
