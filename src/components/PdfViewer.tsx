import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  FileWarning,
  Maximize2,
  Search,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { createPdfLoadingTask } from "../lib/pdf";

interface PdfViewerProps {
  paperId: string;
  fileName: string;
  pdfBlob: Blob | null;
  extractedText: string;
  initialZoom: number;
  jumpToPageRequest: { page: number; nonce: number } | null;
}

interface PdfPageCanvasProps {
  pdf: PDFDocumentProxy;
  pageNumber: number;
  scale: number;
  registerNode: (pageNumber: number, el: HTMLDivElement | null) => void;
}

function PdfPageCanvas({ pdf, pageNumber, scale, registerNode }: PdfPageCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isVisible, setIsVisible] = useState(pageNumber <= 3);
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({
    width: Math.round(612 * scale),
    height: Math.round(792 * scale),
  });

  useEffect(() => {
    const node = containerRef.current;
    registerNode(pageNumber, node);
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setIsVisible(true);
        }
      },
      { rootMargin: "600px 0px" }
    );
    observer.observe(node);

    return () => {
      observer.disconnect();
      registerNode(pageNumber, null);
    };
  }, [pageNumber, registerNode]);

  useEffect(() => {
    if (!isVisible) return;
    let cancelled = false;
    let renderTask: { cancel: () => void; promise: Promise<void> } | null = null;

    async function renderPage() {
      try {
        const page = await pdf.getPage(pageNumber);
        if (cancelled) return;

        const viewport = page.getViewport({ scale });
        const dpr = Math.min(window.devicePixelRatio || 1, 2);

        setDimensions({
          width: Math.floor(viewport.width),
          height: Math.floor(viewport.height),
        });

        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        renderTask = page.render({
          canvasContext: ctx,
          viewport,
          canvas,
        });
        await renderTask.promise;
      } catch (err) {
        if (!cancelled && !(err instanceof Error && err.name === "RenderingCancelledException")) {
          // Ignore cancelled renders during rapid zoom changes
        }
      }
    }

    renderPage();

    return () => {
      cancelled = true;
      if (renderTask) {
        try {
          renderTask.cancel();
        } catch {
          // Ignore cancellation errors
        }
      }
    };
  }, [pdf, pageNumber, scale, isVisible]);

  return (
    <div
      ref={containerRef}
      data-page={pageNumber}
      className="mx-auto bg-white rounded-md shadow-[0_2px_10px_rgba(28,25,38,0.08)] border border-[#E7E2DA] overflow-hidden relative"
      style={{ width: dimensions.width, minHeight: dimensions.height }}
    >
      <canvas ref={canvasRef} className="block" />
      <span className="absolute bottom-2 right-2.5 text-[10px] font-mono tabular-nums text-[#797288] bg-white/90 px-1.5 py-0.5 rounded border border-[#E7E2DA]">
        {pageNumber}
      </span>
    </div>
  );
}

export function PdfViewer({
  paperId,
  fileName,
  pdfBlob,
  extractedText,
  initialZoom,
  jumpToPageRequest,
}: PdfViewerProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const pageNodesRef = useRef<Map<number, HTMLDivElement>>(new Map());

  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInput, setPageInput] = useState("1");
  const [scale, setScale] = useState(initialZoom || 1.0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [matchCursor, setMatchCursor] = useState(0);

  // Sync default zoom preference when changed
  useEffect(() => {
    if (initialZoom >= 0.6 && initialZoom <= 2.2) {
      setScale(initialZoom);
    }
  }, [initialZoom]);

  // Load PDF document when blob changes
  useEffect(() => {
    let cancelled = false;
    let activeLoadingTask: ReturnType<typeof createPdfLoadingTask> | null = null;

    async function initPdf() {
      if (!pdfBlob) {
        setPdfDoc(null);
        setNumPages(0);
        setLoadError("PDF binary preview is unavailable in browser storage.");
        return;
      }

      setIsLoading(true);
      setLoadError(null);
      try {
        const buffer = await pdfBlob.arrayBuffer();
        const loadingTask = createPdfLoadingTask(buffer);
        activeLoadingTask = loadingTask;
        const doc = await loadingTask.promise;
        if (cancelled) {
          await loadingTask.destroy().catch(() => {});
          return;
        }
        setPdfDoc(doc);
        setNumPages(doc.numPages);
        setCurrentPage(1);
        setPageInput("1");

        // Auto-fit width sensibly on load
        const firstPage = await doc.getPage(1);
        const defaultVp = firstPage.getViewport({ scale: 1 });
        const containerW = scrollContainerRef.current?.clientWidth ?? 640;
        if (containerW > 200 && defaultVp.width > 0) {
          const fitScale = Math.min(Math.max((containerW - 48) / defaultVp.width, 0.7), 1.35);
          setScale(Number((fitScale * (initialZoom || 1)).toFixed(2)));
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(
            err instanceof Error ? err.message : "Could not render this PDF document."
          );
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    initPdf();

    return () => {
      cancelled = true;
      if (activeLoadingTask) {
        activeLoadingTask.destroy().catch(() => {});
      }
    };
  }, [paperId, pdfBlob]);

  const registerNode = useCallback((pageNumber: number, el: HTMLDivElement | null) => {
    if (el) {
      pageNodesRef.current.set(pageNumber, el);
    } else {
      pageNodesRef.current.delete(pageNumber);
    }
  }, []);

  const scrollToPage = useCallback(
    (page: number) => {
      const clamped = Math.max(1, Math.min(page, numPages || 1));
      setCurrentPage(clamped);
      setPageInput(String(clamped));
      const targetNode = pageNodesRef.current.get(clamped);
      if (targetNode) {
        targetNode.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    },
    [numPages]
  );

  // Respond to external page jump clicks (e.g., from AI citations)
  useEffect(() => {
    if (jumpToPageRequest && numPages > 0) {
      scrollToPage(jumpToPageRequest.page);
    }
  }, [jumpToPageRequest, numPages, scrollToPage]);

  // Track currently visible page while scrolling
  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container || numPages === 0) return;

    const containerTop = container.getBoundingClientRect().top;
    let closestPage = currentPage;
    let minDist = Infinity;

    pageNodesRef.current.forEach((node, pageNum) => {
      const dist = Math.abs(node.getBoundingClientRect().top - containerTop - 24);
      if (dist < minDist) {
        minDist = dist;
        closestPage = pageNum;
      }
    });

    if (closestPage !== currentPage) {
      setCurrentPage(closestPage);
      setPageInput(String(closestPage));
    }
  }, [currentPage, numPages]);

  // Page-level search over extracted text
  const matchingPages = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q || !extractedText) return [];
    const sections = extractedText.split(/--- Page (\d+) ---/);
    const hits: number[] = [];
    for (let i = 1; i < sections.length; i += 2) {
      const pageNum = Number(sections[i]);
      const content = (sections[i + 1] || "").toLowerCase();
      if (content.includes(q) && !Number.isNaN(pageNum)) {
        hits.push(pageNum);
      }
    }
    return hits;
  }, [searchTerm, extractedText]);

  const handleJumpMatch = (nextIndex: number) => {
    if (matchingPages.length === 0) return;
    const wrapped = ((nextIndex % matchingPages.length) + matchingPages.length) % matchingPages.length;
    setMatchCursor(wrapped);
    scrollToPage(matchingPages[wrapped]);
  };

  const handleFitWidth = async () => {
    if (!pdfDoc || !scrollContainerRef.current) return;
    const page = await pdfDoc.getPage(currentPage);
    const vp = page.getViewport({ scale: 1 });
    const available = scrollContainerRef.current.clientWidth - 48;
    if (available > 120 && vp.width > 0) {
      setScale(Number(Math.min(Math.max(available / vp.width, 0.55), 2.0).toFixed(2)));
    }
  };

  const handleDownload = () => {
    if (!pdfBlob) return;
    const url = URL.createObjectURL(pdfBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const pageNumbers = useMemo(() => {
    return Array.from({ length: numPages }, (_, i) => i + 1);
  }, [numPages]);

  return (
    <div className="flex flex-col h-full bg-[#F4F1EC] rounded-2xl border border-[#E7E2DA] overflow-hidden">
      {/* Compact Sticky PDF Toolbar */}
      <div className="bg-[#FFFFFF] border-b border-[#E7E2DA] px-3 py-2 flex items-center justify-between gap-2 flex-wrap shrink-0">
        {/* Page Navigation */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={currentPage <= 1 || numPages === 0}
            onClick={() => scrollToPage(currentPage - 1)}
            aria-label="Previous page"
            className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-[#524C61] hover:bg-[#FAF8F5] disabled:opacity-40 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              const parsed = parseInt(pageInput, 10);
              if (!Number.isNaN(parsed)) scrollToPage(parsed);
            }}
            className="flex items-center gap-1.5 text-xs font-mono tabular-nums text-[#524C61]"
          >
            <input
              type="text"
              inputMode="numeric"
              value={pageInput}
              onChange={(e) => setPageInput(e.target.value)}
              onBlur={() => setPageInput(String(currentPage))}
              aria-label="Current page number"
              className="w-10 text-center py-1 rounded border border-[#E7E2DA] bg-[#FAF8F5] text-[#1C1926] focus:outline-none focus:border-[#4C1D95]"
            />
            <span>/ {numPages || "—"}</span>
          </form>

          <button
            type="button"
            disabled={currentPage >= numPages || numPages === 0}
            onClick={() => scrollToPage(currentPage + 1)}
            aria-label="Next page"
            className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-[#524C61] hover:bg-[#FAF8F5] disabled:opacity-40 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Zoom & Utility Controls */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setScale((s) => Number(Math.max(0.55, s - 0.15).toFixed(2)))}
            aria-label="Zoom out"
            className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-[#524C61] hover:bg-[#FAF8F5] transition-colors"
          >
            <ZoomOut className="w-4 h-4" />
          </button>

          <span className="text-xs font-mono tabular-nums text-[#524C61] w-11 text-center select-none">
            {Math.round(scale * 100)}%
          </span>

          <button
            type="button"
            onClick={() => setScale((s) => Number(Math.min(2.2, s + 0.15).toFixed(2)))}
            aria-label="Zoom in"
            className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-[#524C61] hover:bg-[#FAF8F5] transition-colors"
          >
            <ZoomIn className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={handleFitWidth}
            title="Fit page width"
            aria-label="Fit page width"
            className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-[#524C61] hover:bg-[#FAF8F5] transition-colors"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>

          <div className="w-px h-4 bg-[#E7E2DA] mx-1" aria-hidden="true" />

          <button
            type="button"
            onClick={() => setSearchOpen((o) => !o)}
            aria-label="Search inside PDF"
            className={`w-8 h-8 inline-flex items-center justify-center rounded-lg transition-colors ${
              searchOpen
                ? "bg-[#EDE9FE] text-[#4C1D95]"
                : "text-[#524C61] hover:bg-[#FAF8F5]"
            }`}
          >
            <Search className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={handleDownload}
            disabled={!pdfBlob}
            title="Download original PDF"
            aria-label="Download original PDF"
            className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-[#524C61] hover:bg-[#FAF8F5] disabled:opacity-40 transition-colors"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Expandable In-Document Search Bar */}
      {searchOpen && (
        <div className="bg-[#FAF8F5] border-b border-[#E7E2DA] px-3 py-2 flex items-center gap-2 shrink-0">
          <Search className="w-3.5 h-3.5 text-[#797288] shrink-0" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setMatchCursor(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && matchingPages.length > 0) {
                e.preventDefault();
                handleJumpMatch(matchCursor);
              }
            }}
            placeholder="Find term across pages..."
            aria-label="Search text inside PDF"
            autoFocus
            className="flex-1 text-xs bg-transparent text-[#1C1926] placeholder:text-[#797288] focus:outline-none"
          />
          {searchTerm.trim() && (
            <div className="flex items-center gap-1.5 text-xs font-mono tabular-nums text-[#524C61]">
              <span>
                {matchingPages.length > 0
                  ? `p. ${matchingPages[matchCursor]} (${matchCursor + 1}/${matchingPages.length})`
                  : "0 matches"}
              </span>
              {matchingPages.length > 0 && (
                <>
                  <button
                    type="button"
                    onClick={() => handleJumpMatch(matchCursor - 1)}
                    aria-label="Previous matching page"
                    className="p-1 rounded hover:bg-[#EDE9FE] text-[#4C1D95]"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleJumpMatch(matchCursor + 1)}
                    aria-label="Next matching page"
                    className="p-1 rounded hover:bg-[#EDE9FE] text-[#4C1D95]"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>
          )}
          <button
            type="button"
            onClick={() => {
              setSearchOpen(false);
              setSearchTerm("");
            }}
            aria-label="Close search"
            className="p-1 rounded text-[#797288] hover:text-[#1C1926]"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Scrollable PDF Canvas Stage */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-auto p-4 sm:p-5 space-y-4"
      >
        {isLoading ? (
          <div className="h-full min-h-[320px] flex flex-col items-center justify-center gap-3 text-[#524C61]">
            <div className="w-8 h-8 rounded-full border-2 border-[#DDD6FE] border-t-[#4C1D95] animate-spin" />
            <p className="text-sm font-medium">Rendering PDF pages...</p>
          </div>
        ) : loadError || !pdfDoc ? (
          <div className="h-full min-h-[320px] flex flex-col items-center justify-center text-center max-w-sm mx-auto px-4 space-y-3">
            <FileWarning className="w-8 h-8 text-[#E86A58]" />
            <p className="text-sm font-semibold text-[#1C1926]">PDF preview unavailable</p>
            <p className="text-xs text-[#524C61] leading-relaxed">
              {loadError || "The PDF file could not be loaded for preview, though extracted text and AI chat remain available."}
            </p>
          </div>
        ) : (
          pageNumbers.map((pageNum) => (
            <PdfPageCanvas
              key={`${paperId}-p-${pageNum}`}
              pdf={pdfDoc}
              pageNumber={pageNum}
              scale={scale}
              registerNode={registerNode}
            />
          ))
        )}
      </div>
    </div>
  );
}
