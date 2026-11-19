export interface AnalysisSection {
  summary: string;
  keyPoints: string[];
}

export interface KeyTerm {
  term: string;
  definition: string;
}

export interface ImportantQuestion {
  question: string;
  category: string;
  rationale: string;
}

export interface PaperAnalysis {
  title: string;
  authors: string[];
  publicationYear: string;
  venue: string;
  field: string;
  executiveSummary: string;
  objectives: AnalysisSection;
  methodology: AnalysisSection;
  results: AnalysisSection;
  limitations: AnalysisSection;
  conclusion: AnalysisSection;
  keyTerms: KeyTerm[];
  importantQuestions: ImportantQuestion[];
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
  notFoundInDocument?: boolean;
  isStreaming?: boolean;
  error?: string;
}

export interface PaperRecord {
  id: string;
  fileName: string;
  fileSize: number;
  pageCount: number;
  wordCount: number;
  uploadedAt: number;
  lastOpenedAt: number;
  extractedText: string;
  analysis: PaperAnalysis;
  chatHistory: ChatMessage[];
}

export interface WorkspaceSettings {
  responseDepth: "concise" | "balanced" | "detailed";
  includeCitations: boolean;
  defaultZoom: number;
  autoOpenSummary: boolean;
}

export interface UserProfile {
  name: string;
  role: string;
  institution: string;
}

export type AppView = "dashboard" | "workspace" | "summary";

export type QuestionFocus = "comprehension" | "methodology" | "critical" | "exam";
