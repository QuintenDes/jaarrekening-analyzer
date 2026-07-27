import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { PageSize, ScanHighlight } from "../types";

function isRenderCancelled(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const name = "name" in err ? String(err.name) : "";
  const message = "message" in err ? String(err.message) : String(err);
  return (
    name === "RenderingCancelledException" ||
    /cancel+ed/i.test(message) ||
    /Rendering cancelled/i.test(message)
  );
}

GlobalWorkerOptions.workerSrc = pdfWorker;

const SECTION_COLORS: Record<string, string> = {
  balans_activa: "rgba(16, 185, 129, 0.35)",
  balans_passiva: "rgba(59, 130, 246, 0.35)",
  resultatenrekening: "rgba(245, 158, 11, 0.35)",
  resultaatverwerking: "rgba(168, 85, 247, 0.35)",
};

const SECTION_LABELS: Record<string, string> = {
  balans_activa: "Activa",
  balans_passiva: "Passiva",
  resultatenrekening: "Resultatenrekening",
  resultaatverwerking: "Resultaatverwerking",
};

const SECTION_SWATCH: Record<string, string> = {
  balans_activa: "bg-emerald-400",
  balans_passiva: "bg-blue-400",
  resultatenrekening: "bg-amber-400",
  resultaatverwerking: "bg-purple-400",
};

type Props = {
  pdfUrl: string;
  highlights: ScanHighlight[];
  pageSizes: PageSize[];
  pageCount: number | null;
};

export function PdfHighlightViewer({
  pdfUrl,
  highlights,
  pageSizes,
  pageCount,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [rendering, setRendering] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(0);

  const scannedPages = useMemo(() => {
    const pages = [...new Set(highlights.map((h) => h.page))].sort((a, b) => a - b);
    return pages;
  }, [highlights]);

  const pageHighlights = useMemo(
    () => highlights.filter((h) => h.page === pageIndex),
    [highlights, pageIndex],
  );

  const totalPages = pageCount ?? pdf?.numPages ?? 0;

  useEffect(() => {
    let cancelled = false;
    let doc: PDFDocumentProxy | null = null;
    setLoadError(null);
    setPdf(null);

    getDocument({ url: pdfUrl })
      .promise.then((loaded) => {
        if (cancelled) {
          void loaded.cleanup();
          return;
        }
        doc = loaded;
        setPdf(loaded);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : "PDF laden mislukt");
        }
      });

    return () => {
      cancelled = true;
      if (doc) void doc.cleanup();
    };
  }, [pdfUrl]);

  const jumpedForPdfRef = useRef<PDFDocumentProxy | null>(null);
  const renderTaskRef = useRef<RenderTask | null>(null);

  useEffect(() => {
    if (!pdf) return;
    if (jumpedForPdfRef.current === pdf) return;
    jumpedForPdfRef.current = pdf;
    setPageIndex(scannedPages.length > 0 ? scannedPages[0] : 0);
  }, [pdf, scannedPages]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const updateWidth = () => setViewportWidth(viewport.clientWidth);
    updateWidth();

    const observer = new ResizeObserver(updateWidth);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!pdf || viewportWidth <= 0) return;

    let cancelled = false;
    const canvas = canvasRef.current;
    if (!canvas) return;

    setRendering(true);
    void (async () => {
      let task: RenderTask | null = null;
      try {
        const page = await pdf.getPage(pageIndex + 1);
        if (cancelled) return;

        const base = page.getViewport({ scale: 1 });
        const horizontalPadding = 2; // avoid border overflow/scrollbars
        const availableWidth = Math.max(viewportWidth - horizontalPadding, 1);
        const scale = availableWidth / base.width;
        const viewport = page.getViewport({ scale });

        const context = canvas.getContext("2d");
        if (!context || cancelled) return;

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        task = page.render({ canvas, canvasContext: context, viewport });
        renderTaskRef.current = task;
        await task.promise;
        if (cancelled) return;
      } catch (err) {
        if (!cancelled && !isRenderCancelled(err)) {
          setLoadError(err instanceof Error ? err.message : "Pagina renderen mislukt");
        }
      } finally {
        if (task && renderTaskRef.current === task) {
          renderTaskRef.current = null;
        }
        if (!cancelled) setRendering(false);
      }
    })();

    return () => {
      cancelled = true;
      const task = renderTaskRef.current;
      renderTaskRef.current = null;
      if (task) task.cancel();
    };
  }, [pdf, pageIndex, viewportWidth]);

  const pageSize = pageSizes[pageIndex];

  function overlayStyle(h: ScanHighlight): CSSProperties {
    if (!pageSize || pageSize.width <= 0 || pageSize.height <= 0) {
      return { display: "none" };
    }
    // Percentages stay aligned when the canvas is CSS-scaled (max-w-full).
    return {
      left: `${(h.x0 / pageSize.width) * 100}%`,
      top: `${(h.top / pageSize.height) * 100}%`,
      width: `${(Math.max(h.x1 - h.x0, 1) / pageSize.width) * 100}%`,
      height: `${(Math.max(h.bottom - h.top, 1) / pageSize.height) * 100}%`,
      backgroundColor: SECTION_COLORS[h.section] ?? "rgba(100, 116, 139, 0.35)",
    };
  }

  if (loadError) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-800">
        {loadError}
      </div>
    );
  }

  const legend = (
    <div className="flex flex-wrap gap-3 text-xs text-slate-600">
      {Object.entries(SECTION_LABELS).map(([key, label]) => (
        <span key={key} className="inline-flex items-center gap-1.5">
          <span className={`h-2.5 w-2.5 rounded-sm ${SECTION_SWATCH[key]}`} />
          {label}
        </span>
      ))}
    </div>
  );

  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-900">PDF scan</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-40"
            disabled={pageIndex <= 0}
            onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
          >
            Vorige
          </button>
          <span className="min-w-24 text-center text-sm text-slate-600">
            Pagina {pageIndex + 1}
            {totalPages > 0 ? ` / ${totalPages}` : ""}
          </span>
          <button
            type="button"
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-40"
            disabled={totalPages > 0 ? pageIndex >= totalPages - 1 : true}
            onClick={() =>
              setPageIndex((p) =>
                totalPages > 0 ? Math.min(totalPages - 1, p + 1) : p,
              )
            }
          >
            Volgende
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        {scannedPages.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {scannedPages.map((page) => (
              <button
                key={page}
                type="button"
                onClick={() => setPageIndex(page)}
                className={`rounded px-2 py-0.5 text-xs font-medium ${
                  page === pageIndex
                    ? "bg-emerald-600 text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {page + 1}
              </button>
            ))}
          </div>
        ) : (
          <div />
        )}
        {legend}
      </div>

      <div
        ref={viewportRef}
        className="relative overflow-auto rounded border border-slate-200 bg-slate-50"
      >
        {rendering && (
          <div className="absolute inset-x-0 top-0 z-10 bg-white/80 px-3 py-1 text-xs text-slate-500">
            Pagina laden…
          </div>
        )}
        <div className="relative inline-block w-full">
          <canvas ref={canvasRef} className="block max-w-full h-auto" />
          <div className="pointer-events-none absolute inset-0">
            {pageHighlights.map((h, index) => (
              <div
                key={`${h.page}-${h.code}-${index}`}
                title={`${h.code} (${SECTION_LABELS[h.section] ?? h.section})`}
                className="absolute box-border"
                style={overlayStyle(h)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
