import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import type {
  AppView,
  ChatMessage,
  PaperRecord,
  QuestionFocus,
  UserProfile,
  WorkspaceSettings,
} from "./types/paper";
import {
  clearAllPapers,
  deletePaperRecord,
  loadAllPapers,
  loadPaperBlob,
  loadProfile,
  loadSettings,
  savePaperRecord,
  saveProfile,
  saveSettings,
} from "./lib/storage";
import { extractPdfContent } from "./lib/pdf";
import {
  analyzePaperPdf,
  deletePaperFromServer,
  generateFocusedQuestions,
  streamPaperChat,
} from "./lib/api";
import { TopNav } from "./components/TopNav";
import { Sidebar } from "./components/Sidebar";
import { DashboardView } from "./components/DashboardView";
import type { ProcessingStage } from "./components/DashboardView";
import { DocumentWorkspace } from "./components/DocumentWorkspace";
import { SummarySection } from "./components/SummarySection";
import { SettingsModal } from "./components/SettingsModal";

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;

function generateId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID().replace(/-/g, "");
  }
  return `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export default function App() {
  const [papers, setPapers] = useState<PaperRecord[]>([]);
  const [activePaperId, setActivePaperId] = useState<string | null>(null);
  const [activePdfBlob, setActivePdfBlob] = useState<Blob | null>(null);
  const [activeView, setActiveView] = useState<AppView>("dashboard");

  const [settings, setSettings] = useState<WorkspaceSettings>(() => loadSettings());
  const [userProfile, setUserProfile] = useState<UserProfile>(() => loadProfile());

  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [processingStage, setProcessingStage] = useState<ProcessingStage>("idle");
  const [processingFileName, setProcessingFileName] = useState("");
  const [processingPageCount, setProcessingPageCount] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [isStreaming, setIsStreaming] = useState(false);
  const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);
  const globalFileInputRef = useRef<HTMLInputElement>(null);
  const papersRef = useRef<PaperRecord[]>(papers);
  papersRef.current = papers;

  // Hydrate saved papers from IndexedDB on initial mount
  useEffect(() => {
    let active = true;
    loadAllPapers()
      .then((loaded) => {
        if (active) setPapers(loaded);
      })
      .catch(() => {
        // IndexedDB unavailable in restricted environments
      });
    return () => {
      active = false;
    };
  }, []);

  const activePaper = useMemo(() => {
    return papers.find((p) => p.id === activePaperId) ?? null;
  }, [papers, activePaperId]);

  // Load PDF binary blob whenever activePaperId changes
  useEffect(() => {
    let cancelled = false;
    if (!activePaperId) {
      setActivePdfBlob(null);
      return;
    }

    loadPaperBlob(activePaperId)
      .then((blob) => {
        if (!cancelled) setActivePdfBlob(blob);
      })
      .catch(() => {
        if (!cancelled) setActivePdfBlob(null);
      });

    return () => {
      cancelled = true;
    };
  }, [activePaperId]);

  const updatePaperInState = useCallback(
    (paperId: string, updater: (prev: PaperRecord) => PaperRecord, persist = true) => {
      setPapers((current) => {
        const updated = current.map((p) => (p.id === paperId ? updater(p) : p));
        if (persist) {
          const target = updated.find((p) => p.id === paperId);
          if (target) {
            savePaperRecord(target).catch(() => {});
          }
        }
        return updated;
      });
    },
    []
  );

  const handleOpenPaper = useCallback(
    (paperId: string, targetView: "workspace" | "summary" = "workspace") => {
      if (isStreaming) {
        abortControllerRef.current?.abort();
        setIsStreaming(false);
      }
      setActivePaperId(paperId);
      setActiveView(targetView);
      updatePaperInState(paperId, (p) => ({ ...p, lastOpenedAt: Date.now() }), true);
    },
    [isStreaming, updatePaperInState]
  );

  const handleFileUpload = useCallback(
    async (file: File) => {
      setUploadError(null);

      const isPdfMime = file.type === "application/pdf";
      const isPdfExt = file.name.toLowerCase().endsWith(".pdf");
      if (!isPdfMime && !isPdfExt) {
        setUploadError("Please upload a valid PDF document (.pdf format).");
        setActiveView("dashboard");
        return;
      }

      if (file.size === 0) {
        setUploadError("The selected PDF file appears to be empty.");
        setActiveView("dashboard");
        return;
      }

      if (file.size > MAX_FILE_SIZE_BYTES) {
        setUploadError(
          "This PDF exceeds the 25 MB limit. Please choose a smaller academic paper."
        );
        setActiveView("dashboard");
        return;
      }

      if (isStreaming) {
        abortControllerRef.current?.abort();
        setIsStreaming(false);
      }

      setActiveView("dashboard");
      setProcessingFileName(file.name);
      setProcessingPageCount(0);
      setProcessingStage("extracting");

      const paperId = generateId();

      try {
        // Step 1: Parse PDF structure and extract page-indexed text locally
        let pageCount = 1;
        let wordCount = 0;
        let extractedText = "";

        try {
          const extracted = await extractPdfContent(file);
          pageCount = extracted.pageCount;
          wordCount = extracted.wordCount;
          extractedText = extracted.extractedText;
          setProcessingPageCount(pageCount);
        } catch {
          // Even if client-side text extraction fails (e.g. encrypted font maps),
          // Gemini natively reads the raw PDF binary on the server!
          pageCount = 1;
          wordCount = 0;
          extractedText = "";
        }

        // Step 2: Send PDF to Express backend for genuine Gemini AI structured analysis
        setProcessingStage("analyzing");
        const result = await analyzePaperPdf({
          file,
          paperId,
          extractedText,
          pageCount,
        });

        // Step 3: Persist record + PDF blob in IndexedDB and open workspace
        setProcessingStage("finalizing");
        const now = Date.now();
        const newRecord: PaperRecord = {
          id: result.paperId || paperId,
          fileName: file.name,
          fileSize: file.size,
          pageCount,
          wordCount,
          uploadedAt: now,
          lastOpenedAt: now,
          extractedText,
          analysis: result.analysis,
          chatHistory: [],
        };

        await savePaperRecord(newRecord, file);

        setPapers((prev) => [newRecord, ...prev.filter((p) => p.id !== newRecord.id)]);
        setActivePaperId(newRecord.id);
        setActivePdfBlob(file);
        setActiveView(settings.autoOpenSummary ? "summary" : "workspace");
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "An unexpected error occurred while processing the PDF.";
        setUploadError(message);
      } finally {
        setProcessingStage("idle");
        setProcessingFileName("");
        setProcessingPageCount(0);
      }
    },
    [isStreaming, settings.autoOpenSummary]
  );

  const handleGlobalFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
    e.target.value = "";
  };

  const handleSendMessage = useCallback(
    async (question: string) => {
      const currentPaper = papersRef.current.find((p) => p.id === activePaperId);
      if (!currentPaper || isStreaming) return;

      const trimmed = question.trim();
      if (!trimmed) return;

      const userMessage: ChatMessage = {
        id: generateId(),
        role: "user",
        content: trimmed,
        createdAt: Date.now(),
      };

      const assistantId = generateId();
      const assistantPlaceholder: ChatMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
        createdAt: Date.now(),
        isStreaming: true,
      };

      const priorHistory = currentPaper.chatHistory;

      updatePaperInState(
        currentPaper.id,
        (p) => ({
          ...p,
          lastOpenedAt: Date.now(),
          chatHistory: [...p.chatHistory, userMessage, assistantPlaceholder],
        }),
        false
      );

      const controller = new AbortController();
      abortControllerRef.current = controller;
      setIsStreaming(true);

      let latestBlob = activePdfBlob;
      if (!latestBlob) {
        latestBlob = await loadPaperBlob(currentPaper.id).catch(() => null);
      }

      try {
        let fullText = "";
        await streamPaperChat({
          paperId: currentPaper.id,
          question: trimmed,
          history: priorHistory,
          extractedText: currentPaper.extractedText,
          settings,
          pdfBlob: latestBlob,
          fileName: currentPaper.fileName,
          signal: controller.signal,
          onToken: (delta) => {
            fullText += delta;
            updatePaperInState(
              currentPaper.id,
              (p) => ({
                ...p,
                chatHistory: p.chatHistory.map((m) =>
                  m.id === assistantId ? { ...m, content: fullText } : m
                ),
              }),
              false
            );
          },
        });

        const isNotFound = fullText
          .trim()
          .toLowerCase()
          .startsWith("**not found in the uploaded document") ||
          fullText.trim().toLowerCase().startsWith("not found in the uploaded document");

        updatePaperInState(
          currentPaper.id,
          (p) => ({
            ...p,
            chatHistory: p.chatHistory.map((m) =>
              m.id === assistantId
                ? {
                    ...m,
                    content:
                      fullText ||
                      "Not found in the uploaded document. Please try rephrasing your question.",
                    isStreaming: false,
                    notFoundInDocument: isNotFound,
                  }
                : m
            ),
          }),
          true
        );
      } catch (err) {
        const isAbort = err instanceof Error && err.name === "AbortError";
        const errorMsg =
          err instanceof Error ? err.message : "Failed to receive an answer from Gemini AI.";

        updatePaperInState(
          currentPaper.id,
          (p) => ({
            ...p,
            chatHistory: p.chatHistory.map((m) =>
              m.id === assistantId
                ? {
                    ...m,
                    isStreaming: false,
                    error: isAbort ? undefined : errorMsg,
                    content: isAbort
                      ? m.content || "_Response generation stopped._"
                      : m.content,
                  }
                : m
            ),
          }),
          true
        );
      } finally {
        setIsStreaming(false);
        abortControllerRef.current = null;
      }
    },
    [activePaperId, activePdfBlob, isStreaming, settings, updatePaperInState]
  );

  const handleStopStreaming = useCallback(() => {
    abortControllerRef.current?.abort();
    setIsStreaming(false);
  }, []);

  const handleClearChat = useCallback(() => {
    if (!activePaperId || isStreaming) return;
    updatePaperInState(activePaperId, (p) => ({ ...p, chatHistory: [] }), true);
  }, [activePaperId, isStreaming, updatePaperInState]);

  const handleRegenerateQuestions = useCallback(
    async (focus: QuestionFocus) => {
      const currentPaper = papersRef.current.find((p) => p.id === activePaperId);
      if (!currentPaper || isGeneratingQuestions) return;

      setIsGeneratingQuestions(true);
      try {
        let blob = activePdfBlob;
        if (!blob) {
          blob = await loadPaperBlob(currentPaper.id).catch(() => null);
        }
        const nextQuestions = await generateFocusedQuestions({
          paperId: currentPaper.id,
          focus,
          extractedText: currentPaper.extractedText,
          pdfBlob: blob,
          fileName: currentPaper.fileName,
        });
        if (nextQuestions.length > 0) {
          updatePaperInState(
            currentPaper.id,
            (p) => ({
              ...p,
              analysis: {
                ...p.analysis,
                importantQuestions: nextQuestions,
              },
            }),
            true
          );
        }
      } catch (err) {
        setUploadError(
          err instanceof Error ? err.message : "Unable to generate new questions right now."
        );
      } finally {
        setIsGeneratingQuestions(false);
      }
    },
    [activePaperId, activePdfBlob, isGeneratingQuestions, updatePaperInState]
  );

  const handleAskFromSummary = useCallback(
    (question: string) => {
      setActiveView("workspace");
      // Defer slightly so workspace mounts cleanly before streaming starts
      setTimeout(() => {
        handleSendMessage(question);
      }, 60);
    },
    [handleSendMessage]
  );

  const handleDeletePaper = useCallback(
    async (paperId: string) => {
      if (paperId === activePaperId && isStreaming) {
        abortControllerRef.current?.abort();
        setIsStreaming(false);
      }

      await deletePaperRecord(paperId).catch(() => {});
      deletePaperFromServer(paperId).catch(() => {});

      setPapers((prev) => prev.filter((p) => p.id !== paperId));
      if (activePaperId === paperId) {
        setActivePaperId(null);
        setActivePdfBlob(null);
        setActiveView("dashboard");
      }
    },
    [activePaperId, isStreaming]
  );

  const handleClearLibrary = useCallback(async () => {
    if (isStreaming) {
      abortControllerRef.current?.abort();
      setIsStreaming(false);
    }
    const existingIds = papersRef.current.map((p) => p.id);
    await clearAllPapers().catch(() => {});
    existingIds.forEach((id) => deletePaperFromServer(id).catch(() => {}));
    setPapers([]);
    setActivePaperId(null);
    setActivePdfBlob(null);
    setActiveView("dashboard");
  }, [isStreaming]);

  const handleSaveSettings = (next: WorkspaceSettings) => {
    setSettings(next);
    saveSettings(next);
  };

  const handleSaveProfile = (next: UserProfile) => {
    setUserProfile(next);
    saveProfile(next);
  };

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#1C1926] flex flex-col">
      {/* Hidden Global PDF Picker for TopNav Upload Button */}
      <input
        ref={globalFileInputRef}
        type="file"
        accept="application/pdf,.pdf"
        onChange={handleGlobalFileChange}
        className="hidden"
        aria-hidden="true"
      />

      {/* Top Navigation */}
      <TopNav
        activeView={activeView}
        activePaper={activePaper}
        userProfile={userProfile}
        onNavigate={(view) => setActiveView(view)}
        onOpenMobileSidebar={() => setMobileSidebarOpen(true)}
        onTriggerUpload={() => globalFileInputRef.current?.click()}
        onOpenSettings={() => setSettingsOpen(true)}
        isProcessing={processingStage !== "idle"}
      />

      {/* Body Layout: Left Sidebar + Main Content Viewport */}
      <div className="flex flex-1 min-h-0">
        <Sidebar
          papers={papers}
          activePaperId={activePaperId}
          mobileOpen={mobileSidebarOpen}
          onCloseMobile={() => setMobileSidebarOpen(false)}
          onSelectPaper={(id) => handleOpenPaper(id, "workspace")}
          onDeletePaper={handleDeletePaper}
          onNewUpload={() => {
            setActiveView("dashboard");
            if (processingStage === "idle") {
              globalFileInputRef.current?.click();
            }
          }}
          onOpenSettings={() => setSettingsOpen(true)}
        />

        <main className="flex-1 min-w-0">
          {activeView === "workspace" && activePaper ? (
            <DocumentWorkspace
              paper={activePaper}
              pdfBlob={activePdfBlob}
              defaultZoom={settings.defaultZoom}
              isStreaming={isStreaming}
              isGeneratingQuestions={isGeneratingQuestions}
              onSendMessage={handleSendMessage}
              onStopStreaming={handleStopStreaming}
              onClearChat={handleClearChat}
              onRegenerateQuestions={handleRegenerateQuestions}
              onSwitchToSummary={() => setActiveView("summary")}
              onBackToDashboard={() => setActiveView("dashboard")}
            />
          ) : activeView === "summary" && activePaper ? (
            <SummarySection
              paper={activePaper}
              isGeneratingQuestions={isGeneratingQuestions}
              onAskQuestionInChat={handleAskFromSummary}
              onRegenerateQuestions={handleRegenerateQuestions}
              onOpenWorkspace={() => setActiveView("workspace")}
            />
          ) : (
            <DashboardView
              userProfile={userProfile}
              papers={papers}
              processingStage={processingStage}
              processingFileName={processingFileName}
              processingPageCount={processingPageCount}
              uploadError={uploadError}
              onDismissError={() => setUploadError(null)}
              onFileSelected={handleFileUpload}
              onOpenPaper={handleOpenPaper}
            />
          )}
        </main>
      </div>

      {/* Workspace Settings & Profile Modal */}
      <SettingsModal
        open={settingsOpen}
        settings={settings}
        userProfile={userProfile}
        papers={papers}
        onClose={() => setSettingsOpen(false)}
        onSaveSettings={handleSaveSettings}
        onSaveProfile={handleSaveProfile}
        onClearLibrary={handleClearLibrary}
      />
    </div>
  );
}
