import type {
  ChatMessage,
  ImportantQuestion,
  PaperAnalysis,
  QuestionFocus,
  WorkspaceSettings,
} from "../types/paper";

export interface AnalyzePaperResponse {
  paperId: string;
  sourceMode: "pdf" | "text";
  analysis: PaperAnalysis;
}

export async function analyzePaperPdf(params: {
  file: File;
  paperId: string;
  extractedText: string;
  pageCount: number;
}): Promise<AnalyzePaperResponse> {
  const formData = new FormData();
  formData.append("file", params.file);
  formData.append("paperId", params.paperId);
  formData.append("extractedText", params.extractedText);
  formData.append("pageCount", String(params.pageCount));
  formData.append("fileName", params.file.name);

  const response = await fetch("/api/papers/analyze", {
    method: "POST",
    body: formData,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `Document analysis failed (HTTP ${response.status}).`);
  }
  return data as AnalyzePaperResponse;
}

export async function syncPaperContext(params: {
  paperId: string;
  blob: Blob | null;
  fileName: string;
  extractedText: string;
}): Promise<void> {
  const formData = new FormData();
  formData.append("paperId", params.paperId);
  formData.append("extractedText", params.extractedText);
  if (params.blob) {
    formData.append("file", params.blob, params.fileName);
  }
  const response = await fetch("/api/papers/sync", {
    method: "POST",
    body: formData,
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || "Unable to sync document context with the server.");
  }
}

export async function streamPaperChat(params: {
  paperId: string;
  question: string;
  history: ChatMessage[];
  extractedText: string;
  settings: WorkspaceSettings;
  pdfBlob: Blob | null;
  fileName: string;
  onToken: (delta: string) => void;
  signal?: AbortSignal;
}): Promise<string> {
  const payload = {
    paperId: params.paperId,
    question: params.question,
    history: params.history
      .filter((m) => !m.error && m.content.trim().length > 0)
      .map((m) => ({ role: m.role, content: m.content })),
    extractedText: params.extractedText,
    responseDepth: params.settings.responseDepth,
    includeCitations: params.settings.includeCitations,
  };

  let response = await fetch("/api/papers/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: params.signal,
  });

  // If server restarted and lost temp PDF cache, transparently re-sync from IndexedDB and retry
  if (response.status === 404) {
    const errBody = await response.json().catch(() => ({}));
    if (errBody.code === "PAPER_CONTEXT_MISSING" && (params.pdfBlob || params.extractedText)) {
      await syncPaperContext({
        paperId: params.paperId,
        blob: params.pdfBlob,
        fileName: params.fileName,
        extractedText: params.extractedText,
      });
      response = await fetch("/api/papers/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: params.signal,
      });
    } else {
      throw new Error(errBody.error || "Paper context could not be found.");
    }
  }

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || `Chat request failed (HTTP ${response.status}).`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("Streaming response was not available from the server.");
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let accumulated = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";

    for (const rawEvent of events) {
      const line = rawEvent
        .split("\n")
        .find((l) => l.startsWith("data: "));
      if (!line) continue;

      const jsonStr = line.slice(6).trim();
      if (!jsonStr) continue;

      const parsed = JSON.parse(jsonStr) as { text?: string; done?: boolean; error?: string };
      if (parsed.error) {
        throw new Error(parsed.error);
      }
      if (parsed.text) {
        accumulated += parsed.text;
        params.onToken(parsed.text);
      }
    }
  }

  return accumulated;
}

export async function generateFocusedQuestions(params: {
  paperId: string;
  focus: QuestionFocus;
  extractedText: string;
  pdfBlob: Blob | null;
  fileName: string;
}): Promise<ImportantQuestion[]> {
  let response = await fetch("/api/papers/questions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      paperId: params.paperId,
      focus: params.focus,
      extractedText: params.extractedText,
    }),
  });

  if (response.status === 404) {
    const errBody = await response.json().catch(() => ({}));
    if (errBody.code === "PAPER_CONTEXT_MISSING" && (params.pdfBlob || params.extractedText)) {
      await syncPaperContext({
        paperId: params.paperId,
        blob: params.pdfBlob,
        fileName: params.fileName,
        extractedText: params.extractedText,
      });
      response = await fetch("/api/papers/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paperId: params.paperId,
          focus: params.focus,
          extractedText: params.extractedText,
        }),
      });
    }
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "Unable to generate questions for this paper.");
  }
  return Array.isArray(data.questions) ? (data.questions as ImportantQuestion[]) : [];
}

export async function deletePaperFromServer(paperId: string): Promise<void> {
  await fetch(`/api/papers/${encodeURIComponent(paperId)}`, {
    method: "DELETE",
  }).catch(() => {
    // Server cache cleanup is best-effort
  });
}
