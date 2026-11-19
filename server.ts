import "dotenv/config";
import express from "express";
import type { Request, Response } from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { GoogleGenAI, Type } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const MODEL_NAME = "gemini-4-hydrogen";
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25 MB max PDF size
const MAX_INLINE_PDF_BYTES = 18 * 1024 * 1024; // 18 MB inlineData cap

const CACHE_DIR = path.join("/tmp", "researchmate_papers");
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

function getGenAIClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
    throw new Error(
      "GEMINI_API_KEY is not configured. Please check your API key in the Settings > Secrets panel."
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

function sanitizePaperId(rawId: unknown): string {
  const id = typeof rawId === "string" ? rawId.replace(/[^a-zA-Z0-9_-]/g, "") : "";
  return id.length >= 6 ? id.slice(0, 64) : crypto.randomUUID().replace(/-/g, "");
}

function getPdfCachePath(paperId: string): string {
  return path.join(CACHE_DIR, `${paperId}.pdf`);
}

function getTextCachePath(paperId: string): string {
  return path.join(CACHE_DIR, `${paperId}.txt`);
}

function isPdfBuffer(buf: Buffer): boolean {
  if (!buf || buf.length < 5) return false;
  // Standard PDF header starts with "%PDF-" (allowing minor leading whitespace/BOM)
  const head = buf.subarray(0, 1024).toString("latin1");
  return head.includes("%PDF-");
}

function formatApiError(err: unknown): { status: number; message: string; code: string } {
  const rawMessage = err instanceof Error ? err.message : String(err ?? "Unknown server error");
  const lower = rawMessage.toLowerCase();

  if (lower.includes("gemini_api_key is not configured") || lower.includes("api_key_invalid") || lower.includes("api key not valid")) {
    return {
      status: 400,
      code: "API_KEY_INVALID",
      message: "The Gemini API key appears missing or invalid. Please verify it in the Settings > Secrets panel.",
    };
  }
  if (lower.includes("permission_denied") || lower.includes("403")) {
    return {
      status: 403,
      code: "PERMISSION_DENIED",
      message: "Access to the Gemini API was denied. Please check your API key permissions in Settings > Secrets.",
    };
  }
  if (lower.includes("resource_exhausted") || lower.includes("429") || lower.includes("quota")) {
    return {
      status: 429,
      code: "RESOURCE_EXHAUSTED",
      message: "Gemini API rate limit or quota reached. Please wait a moment and try again, or check your billing tier in Settings > Secrets.",
    };
  }
  if (lower.includes("not_found") || lower.includes("404")) {
    return {
      status: 404,
      code: "MODEL_NOT_FOUND",
      message: "The configured Gemini model could not be reached. Please try again shortly.",
    };
  }
  return {
    status: 500,
    code: "AI_PROCESSING_ERROR",
    message: rawMessage || "Failed to process the document with Gemini AI.",
  };
}

async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message.toLowerCase() : "";
      const isTransient =
        msg.includes("503") ||
        msg.includes("unavailable") ||
        msg.includes("deadline") ||
        msg.includes("econnreset") ||
        msg.includes("429");
      if (!isTransient || attempt === maxAttempts) {
        throw err;
      }
      const delayMs = 600 * Math.pow(2, attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastErr;
}

interface DocumentPartResult {
  parts: Array<{ inlineData: { mimeType: string; data: string } } | { text: string }>;
  sourceMode: "pdf" | "text";
}

function buildDocumentParts(paperId: string, fallbackText?: string): DocumentPartResult | null {
  const pdfPath = getPdfCachePath(paperId);
  if (fs.existsSync(pdfPath)) {
    const stat = fs.statSync(pdfPath);
    if (stat.size > 0 && stat.size <= MAX_INLINE_PDF_BYTES) {
      const pdfBytes = fs.readFileSync(pdfPath);
      return {
        parts: [
          {
            inlineData: {
              mimeType: "application/pdf",
              data: pdfBytes.toString("base64"),
            },
          },
        ],
        sourceMode: "pdf",
      };
    }
  }

  let textContent = typeof fallbackText === "string" && fallbackText.trim().length > 0 ? fallbackText.trim() : "";
  if (!textContent) {
    const txtPath = getTextCachePath(paperId);
    if (fs.existsSync(txtPath)) {
      textContent = fs.readFileSync(txtPath, "utf-8").trim();
    }
  }

  if (textContent.length > 0) {
    // Keep within generous context bounds while preserving page markers
    const trimmed = textContent.length > 450_000 ? textContent.slice(0, 450_000) : textContent;
    return {
      parts: [
        {
          text: `UPLOADED RESEARCH PAPER CONTENT:\n\n${trimmed}`,
        },
      ],
      sourceMode: "text",
    };
  }

  return null;
}

const analysisSchema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Exact title of the research paper as stated in the document.",
    },
    authors: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Author names explicitly listed in the paper. Empty array if not stated.",
    },
    publicationYear: {
      type: Type.STRING,
      description: "Year of publication if explicitly stated, otherwise empty string.",
    },
    venue: {
      type: Type.STRING,
      description: "Journal, conference, arXiv category, or institution if stated, otherwise empty string.",
    },
    field: {
      type: Type.STRING,
      description: "Primary academic field or subject area of the paper (e.g., Machine Learning, Molecular Biology, Economics).",
    },
    executiveSummary: {
      type: Type.STRING,
      description: "A concise, scholarly 3-4 sentence overview strictly grounded in the document.",
    },
    objectives: {
      type: Type.OBJECT,
      properties: {
        summary: {
          type: Type.STRING,
          description: "Clear explanation of the research objectives, core problem, and hypotheses stated in the paper.",
        },
        keyPoints: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "3-4 concrete bullet points detailing specific aims or research questions from the paper.",
        },
      },
      required: ["summary", "keyPoints"],
    },
    methodology: {
      type: Type.OBJECT,
      properties: {
        summary: {
          type: Type.STRING,
          description: "Clear summary of the research methodology, study design, datasets, models, or experimental setup.",
        },
        keyPoints: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "3-4 concrete bullet points detailing methods, instruments, datasets, or analytical techniques used.",
        },
      },
      required: ["summary", "keyPoints"],
    },
    results: {
      type: Type.OBJECT,
      properties: {
        summary: {
          type: Type.STRING,
          description: "Clear summary of the primary empirical findings, measurements, or theoretical outcomes reported.",
        },
        keyPoints: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "3-4 specific findings including exact metrics, comparisons, or observations reported in the paper.",
        },
      },
      required: ["summary", "keyPoints"],
    },
    limitations: {
      type: Type.OBJECT,
      properties: {
        summary: {
          type: Type.STRING,
          description: "Limitations, constraints, or threats to validity discussed in the paper. If none are explicitly stated, write 'Not explicitly stated in the uploaded document.'",
        },
        keyPoints: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "Specific limitations explicitly noted by the authors, or an empty array if not discussed.",
        },
      },
      required: ["summary", "keyPoints"],
    },
    conclusion: {
      type: Type.OBJECT,
      properties: {
        summary: {
          type: Type.STRING,
          description: "The authors' main conclusions, broader implications, and future work directions.",
        },
        keyPoints: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "2-4 takeaways or future directions stated in the conclusion.",
        },
      },
      required: ["summary", "keyPoints"],
    },
    keyTerms: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          term: { type: Type.STRING },
          definition: {
            type: Type.STRING,
            description: "Concise definition based strictly on how the term is used or defined in this paper.",
          },
        },
        required: ["term", "definition"],
      },
      description: "Up to 6 important technical terms or concepts from the paper.",
    },
    importantQuestions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          question: { type: Type.STRING },
          category: {
            type: Type.STRING,
            description: "One of: Core Concept, Methodology, Results, Critical Analysis, Implications",
          },
          rationale: {
            type: Type.STRING,
            description: "One brief sentence explaining why this question helps a student understand the paper.",
          },
        },
        required: ["question", "category", "rationale"],
      },
      description: "6 thoughtful, paper-specific questions that a student or researcher should ask about this document.",
    },
  },
  required: [
    "title",
    "authors",
    "publicationYear",
    "venue",
    "field",
    "executiveSummary",
    "objectives",
    "methodology",
    "results",
    "limitations",
    "conclusion",
    "keyTerms",
    "importantQuestions",
  ],
};

const questionsSchema = {
  type: Type.OBJECT,
  properties: {
    questions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          question: { type: Type.STRING },
          category: { type: Type.STRING },
          rationale: { type: Type.STRING },
        },
        required: ["question", "category", "rationale"],
      },
    },
  },
  required: ["questions"],
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_UPLOAD_BYTES,
  },
});

async function startServer() {
  const app = express();
  app.use(express.json({ limit: "8mb" }));

  // Health check endpoint
  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  // Analyze uploaded PDF research paper
  app.post("/api/papers/analyze", (req: Request, res: Response) => {
    upload.single("file")(req, res, async (uploadErr: unknown) => {
      if (uploadErr) {
        const errMsg = uploadErr instanceof Error ? uploadErr.message : "File upload error";
        if (errMsg.toLowerCase().includes("file too large")) {
          res.status(413).json({
            error: "PDF file exceeds the 25 MB limit. Please upload a smaller research paper.",
            code: "FILE_TOO_LARGE",
          });
          return;
        }
        res.status(400).json({ error: errMsg, code: "UPLOAD_ERROR" });
        return;
      }

      try {
        const file = req.file;
        const extractedText = typeof req.body?.extractedText === "string" ? req.body.extractedText : "";
        const paperId = sanitizePaperId(req.body?.paperId);
        const originalName = file?.originalname || (typeof req.body?.fileName === "string" ? req.body.fileName : "research-paper.pdf");

        if (!file && !extractedText.trim()) {
          res.status(400).json({
            error: "No PDF file was received. Please upload a valid PDF document.",
            code: "NO_FILE",
          });
          return;
        }

        if (file) {
          if (!isPdfBuffer(file.buffer)) {
            res.status(400).json({
              error: "The uploaded file does not appear to be a valid PDF document.",
              code: "INVALID_PDF",
            });
            return;
          }
          fs.writeFileSync(getPdfCachePath(paperId), file.buffer);
        }

        if (extractedText.trim().length > 0) {
          fs.writeFileSync(getTextCachePath(paperId), extractedText, "utf-8");
        }

        const docParts = buildDocumentParts(paperId, extractedText);
        if (!docParts) {
          res.status(400).json({
            error: "Unable to read content from this PDF. It may be corrupted or empty.",
            code: "EMPTY_PDF",
          });
          return;
        }

        const ai = getGenAIClient();
        const analysisPrompt = `You are ResearchMate AI, a rigorous academic research paper analysis assistant.
Analyze the uploaded research paper (${originalName}) thoroughly and produce a structured JSON breakdown following the provided schema.

Strict Grounding Rules:
1. Extract ONLY information that is explicitly present in the uploaded document.
2. NEVER invent authors, publication years, venues, datasets, metrics, findings, or limitations.
3. If an item such as limitations, venue, or publicationYear is not explicitly stated in the paper, leave string metadata empty ("") or state "Not explicitly stated in the uploaded document." in section summaries.
4. Keep every summary clear, scholarly, well-structured, and genuinely useful for a university student or researcher studying this paper.
5. Make the 6 importantQuestions deeply specific to this exact paper's concepts, methods, evidence, and implications — avoid generic boilerplate questions.`;

        const response = await withRetry(() =>
          ai.models.generateContent({
            model: MODEL_NAME,
            contents: {
              parts: [...docParts.parts, { text: analysisPrompt }],
            },
            config: {
              systemInstruction:
                "You are a precise academic reading assistant. Every claim, statistic, author name, and methodological detail must come strictly from the provided research paper. Never fabricate or hallucinate details not present in the document.",
              responseMimeType: "application/json",
              responseSchema: analysisSchema,
            },
          })
        );

        const rawJson = (response.text ?? "").trim();
        if (!rawJson) {
          throw new Error("Gemini returned an empty response while analyzing this paper.");
        }

        const analysis = JSON.parse(rawJson);
        res.json({
          paperId,
          sourceMode: docParts.sourceMode,
          analysis,
        });
      } catch (err) {
        const formatted = formatApiError(err);
        res.status(formatted.status).json({
          error: formatted.message,
          code: formatted.code,
        });
      }
    });
  });

  // Re-sync a locally persisted PDF (from browser IndexedDB) to server cache if needed
  app.post("/api/papers/sync", (req: Request, res: Response) => {
    upload.single("file")(req, res, (uploadErr: unknown) => {
      if (uploadErr) {
        res.status(400).json({
          error: uploadErr instanceof Error ? uploadErr.message : "Sync upload failed",
        });
        return;
      }

      const paperId = sanitizePaperId(req.body?.paperId);
      const extractedText = typeof req.body?.extractedText === "string" ? req.body.extractedText : "";

      if (req.file && isPdfBuffer(req.file.buffer)) {
        fs.writeFileSync(getPdfCachePath(paperId), req.file.buffer);
      }
      if (extractedText.trim().length > 0) {
        fs.writeFileSync(getTextCachePath(paperId), extractedText, "utf-8");
      }

      res.json({ synced: true, paperId });
    });
  });

  // Grounded Q&A streaming chat endpoint (SSE)
  app.post("/api/papers/chat", async (req: Request, res: Response) => {
    try {
      const paperId = sanitizePaperId(req.body?.paperId);
      const question = typeof req.body?.question === "string" ? req.body.question.trim() : "";
      const history = Array.isArray(req.body?.history) ? req.body.history : [];
      const extractedText = typeof req.body?.extractedText === "string" ? req.body.extractedText : "";
      const responseDepth =
        req.body?.responseDepth === "concise" || req.body?.responseDepth === "detailed"
          ? req.body.responseDepth
          : "balanced";
      const includeCitations = req.body?.includeCitations !== false;

      if (!question) {
        res.status(400).json({ error: "Please enter a question about the paper." });
        return;
      }

      const docParts = buildDocumentParts(paperId, extractedText);
      if (!docParts) {
        res.status(404).json({
          error: "Paper context is not loaded on the server yet.",
          code: "PAPER_CONTEXT_MISSING",
        });
        return;
      }

      const ai = getGenAIClient();

      const depthGuidance =
        responseDepth === "concise"
          ? "Keep answers concise and direct (1 short paragraph or 3-5 tight bullet points)."
          : responseDepth === "detailed"
          ? "Provide thorough, scholarly explanations with structured subsections, exact numbers/equations when present, and nuanced context from the paper."
          : "Provide clear, well-structured answers (2-3 focused paragraphs or structured bullet points) tailored for students and researchers.";

      const citationGuidance = includeCitations
        ? "Whenever possible, cite the specific section, page number, table, or figure from the document in parentheses (e.g., (Section 3.1, p. 4) or (Table 2))."
        : "Keep prose clean without inline citation tags unless the user explicitly asks for page numbers.";

      const systemInstruction = `You are ResearchMate AI, an academic research paper assistant answering questions strictly about the uploaded PDF document.

NON-NEGOTIABLE GROUNDING RULES:
1. Ground EVERY fact, claim, metric, method, and quote strictly in the uploaded research paper.
2. NEVER fabricate information, fill gaps with outside assumptions, or pretend information exists in the paper when it does not.
3. If the user asks about something that is NOT present or cannot be answered from the uploaded document, you MUST start your answer clearly with:
   **Not found in the uploaded document.**
   Then briefly explain what is missing and, if helpful, mention related information that IS covered in the paper (without answering from outside memory).
4. ${depthGuidance}
5. ${citationGuidance}
6. Use clean Markdown formatting (bold key terms, concise bullet points, or compact tables when comparing results).`;

      // Build multi-turn conversation contents with the document anchored in the first user turn
      const contents: Array<{
        role: "user" | "model";
        parts: Array<{ inlineData: { mimeType: string; data: string } } | { text: string }>;
      }> = [];

      const recentHistory = history
        .filter(
          (m: unknown): m is { role: string; content: string } =>
            typeof m === "object" &&
            m !== null &&
            "role" in m &&
            "content" in m &&
            typeof (m as { content: unknown }).content === "string" &&
            (m as { content: string }).content.trim().length > 0
        )
        .slice(-10);

      contents.push({
        role: "user",
        parts: [
          ...docParts.parts,
          {
            text: "This is the uploaded research paper we are discussing. Please base all answers in this conversation strictly on this document.",
          },
        ],
      });
      contents.push({
        role: "model",
        parts: [
          {
            text: "Understood. I have read the uploaded research paper and will answer your questions strictly based on its contents, clearly stating when any requested information is not found in the document.",
          },
        ],
      });

      for (const msg of recentHistory) {
        contents.push({
          role: msg.role === "assistant" ? "model" : "user",
          parts: [{ text: msg.content }],
        });
      }

      contents.push({
        role: "user",
        parts: [{ text: question }],
      });

      res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders?.();

      const stream = await withRetry(() =>
        ai.models.generateContentStream({
          model: MODEL_NAME,
          contents,
          config: {
            systemInstruction,
          },
        })
      );

      for await (const chunk of stream) {
        const delta = chunk.text ?? "";
        if (delta) {
          res.write(`data: ${JSON.stringify({ text: delta })}\n\n`);
        }
      }

      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    } catch (err) {
      const formatted = formatApiError(err);
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ error: formatted.message, code: formatted.code })}\n\n`);
        res.end();
      } else {
        res.status(formatted.status).json({
          error: formatted.message,
          code: formatted.code,
        });
      }
    }
  });

  // Generate fresh focus-specific questions based on the uploaded paper
  app.post("/api/papers/questions", async (req: Request, res: Response) => {
    try {
      const paperId = sanitizePaperId(req.body?.paperId);
      const focus = typeof req.body?.focus === "string" ? req.body.focus : "comprehension";
      const extractedText = typeof req.body?.extractedText === "string" ? req.body.extractedText : "";

      const docParts = buildDocumentParts(paperId, extractedText);
      if (!docParts) {
        res.status(404).json({
          error: "Paper context is not loaded on the server yet.",
          code: "PAPER_CONTEXT_MISSING",
        });
        return;
      }

      const focusPrompts: Record<string, string> = {
        comprehension:
          "Generate 5 clear comprehension questions that help a student master the core arguments, definitions, and takeaways of this paper.",
        methodology:
          "Generate 5 deep methodology questions examining the experimental design, datasets, controls, assumptions, or analytical techniques used in this paper.",
        critical:
          "Generate 5 critical-review questions probing limitations, potential confounding factors, validity, generalizability, or open gaps in this paper.",
        exam:
          "Generate 5 rigorous seminar or graduate exam-style questions strictly answerable from the text, figures, and tables of this paper.",
      };

      const ai = getGenAIClient();
      const response = await withRetry(() =>
        ai.models.generateContent({
          model: MODEL_NAME,
          contents: {
            parts: [
              ...docParts.parts,
              {
                text: `${focusPrompts[focus] || focusPrompts.comprehension}\nEvery question must be specific to this exact uploaded document and grounded in its actual content.`,
              },
            ],
          },
          config: {
            systemInstruction:
              "Generate insightful, paper-specific academic study questions strictly grounded in the uploaded document.",
            responseMimeType: "application/json",
            responseSchema: questionsSchema,
          },
        })
      );

      const rawJson = (response.text ?? "{}").trim();
      const parsed = JSON.parse(rawJson);
      res.json({ questions: Array.isArray(parsed.questions) ? parsed.questions : [] });
    } catch (err) {
      const formatted = formatApiError(err);
      res.status(formatted.status).json({
        error: formatted.message,
        code: formatted.code,
      });
    }
  });

  // Delete cached paper files from server temp storage
  app.delete("/api/papers/:id", (req: Request, res: Response) => {
    const paperId = sanitizePaperId(req.params.id);
    for (const p of [getPdfCachePath(paperId), getTextCachePath(paperId)]) {
      if (fs.existsSync(p)) {
        try {
          fs.unlinkSync(p);
        } catch {
          // Ignore cleanup race errors
        }
      }
    }
    res.json({ deleted: true });
  });

  // Mount Vite middleware in development or serve built dist/ in production
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`ResearchMate AI server running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start ResearchMate AI server:", err);
  process.exit(1);
});
