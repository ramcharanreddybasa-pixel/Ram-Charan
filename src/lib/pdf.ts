import * as pdfjsLib from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export interface ExtractedPdfResult {
  pageCount: number;
  wordCount: number;
  extractedText: string;
  pageTexts: string[];
}

export function createPdfLoadingTask(data: ArrayBuffer) {
  // Clone the buffer so PDF.js worker transfer doesn't detach caller's buffer
  const copy = new Uint8Array(data.slice(0));
  return pdfjsLib.getDocument({
    data: copy,
    useSystemFonts: true,
  });
}

export async function extractPdfContent(file: File): Promise<ExtractedPdfResult> {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = createPdfLoadingTask(arrayBuffer);
  const pdf = await loadingTask.promise;

  const pageCount = pdf.numPages;
  const pageTexts: string[] = [];
  let wordCount = 0;

  try {
    for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const lines: string[] = [];
      let currentLine = "";

      for (const item of textContent.items) {
        if ("str" in item) {
          currentLine += item.str;
          if ("hasEOL" in item && item.hasEOL) {
            lines.push(currentLine.trim());
            currentLine = "";
          } else if (item.str && !item.str.endsWith(" ")) {
            currentLine += " ";
          }
        }
      }
      if (currentLine.trim()) {
        lines.push(currentLine.trim());
      }

      const pageText = lines.filter(Boolean).join("\n").replace(/[ \t]{2,}/g, " ").trim();
      pageTexts.push(pageText);

      if (pageText) {
        wordCount += pageText.split(/\s+/).filter(Boolean).length;
      }
    }
  } finally {
    await loadingTask.destroy().catch(() => {});
  }

  const extractedText = pageTexts
    .map((text, idx) => `--- Page ${idx + 1} ---\n${text}`)
    .join("\n\n");

  return {
    pageCount,
    wordCount,
    extractedText,
    pageTexts,
  };
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}

export function formatRelativeDate(timestamp: number): string {
  const diffMs = Date.now() - timestamp;
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
