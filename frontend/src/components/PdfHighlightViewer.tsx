import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { PageSize, ScanHighlight, SourceSelection } from "../types";

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
  selection: SourceSelection | null;
  onSelectHighlight: (highlight: ScanHighlight, occurrenceIndex: number) => void;
};

function occurrenceIndexOf(
  highlights: ScanHighlight[],
  target: ScanHighlight,
): number {
  const group = highlights.filter(
    (item) => item.section === target.section && item.code === target.code,
  );
  return group.indexOf(target);
}

export function PdfHighlightViewer({
  pdfUrl,
  highlights,
  pageSizes,
  pageCount,
  selection,
  onSelectHighlight,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const highlightRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadNonce, setLoadNonce] = useState(0);
  const [rendering, setRendering] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [pageInput, setPageInput] = useState("1");
  const userZoomedRef = useRef(false);
  const lastFitKeyRef = useRef<string | null>(null);

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
  }, [pdfUrl, loadNonce]);

  const jumpedForPdfRef = useRef<PDFDocumentProxy | null>(null);
  const renderTaskRef = useRef<RenderTask | null>(null);

  useEffect(() => {
    if (!pdf) return;
    if (jumpedForPdfRef.current === pdf) return;
    jumpedForPdfRef.current = pdf;
    if (selection) {
      setPageIndex(selection.page);
      setPageInput(String(selection.page + 1));
    } else {
      const first = scannedPages.length > 0 ? scannedPages[0] : 0;
      setPageIndex(first);
      setPageInput(String(first + 1));
    }
  }, [pdf, scannedPages, selection]);

  useEffect(() => {
    if (!selection) return;
    if (selection.page !== pageIndex) {
      setPageIndex(selection.page);
      setPageInput(String(selection.page + 1));
    }
    const fitKey = `${selection.section}:${selection.code}:${selection.occurrenceIndex}:${selection.page}`;
    if (lastFitKeyRef.current === fitKey) return;
    lastFitKeyRef.current = fitKey;
    userZoomedRef.current = false;

    const pageSize = pageSizes[selection.page];
    const group = highlights.filter(
      (item) => item.section === selection.section && item.code === selection.code,
    );
    const target = group[selection.occurrenceIndex] ?? group[group.length - 1];
    if (!target || !pageSize || viewportHeight <= 0 || viewportWidth <= 0) return;

    const highlightH = Math.max(target.bottom - target.top, 8);
    const fitWidth = viewportWidth / pageSize.width;
    const desired = (viewportHeight * 0.38) / highlightH;
    const nextZoom = Math.min(4, Math.max(1, desired / fitWidth));
    setZoom(nextZoom);
  }, [
    highlights,
    pageIndex,
    pageSizes,
    selection,
    viewportHeight,
    viewportWidth,
  ]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const update = () => {
      setViewportWidth(viewport.clientWidth);
      setViewportHeight(viewport.clientHeight);
    };
    update();

    const observer = new ResizeObserver(update);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [pdf]);

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
        const horizontalPadding = 2;
        const availableWidth = Math.max(viewportWidth - horizontalPadding, 1);
        const scale = (availableWidth / base.width) * zoom;
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
  }, [pdf, pageIndex, viewportWidth, zoom]);

  useEffect(() => {
    if (!selection) return;
    const key = `${selection.section}:${selection.code}:${selection.occurrenceIndex}`;
    const node = highlightRefs.current[key];
    node?.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
  }, [selection, pageIndex, zoom, rendering]);

  const pageSize = pageSizes[pageIndex];

  function overlayStyle(h: ScanHighlight): CSSProperties {
    if (!pageSize || pageSize.width <= 0 || pageSize.height <= 0) {
      return { display: "none" };
    }
    return {
      left: `${(h.x0 / pageSize.width) * 100}%`,
      top: `${(h.top / pageSize.height) * 100}%`,
      width: `${(Math.max(h.x1 - h.x0, 1) / pageSize.width) * 100}%`,
      height: `${(Math.max(h.bottom - h.top, 1) / pageSize.height) * 100}%`,
      backgroundColor: SECTION_COLORS[h.section] ?? "rgba(100, 116, 139, 0.35)",
    };
  }

  function goToPage(next: number) {
    if (totalPages <= 0) return;
    const clamped = Math.min(totalPages - 1, Math.max(0, next));
    setPageIndex(clamped);
    setPageInput(String(clamped + 1));
  }

  if (loadError) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-800">
        <p>PDF-viewer laden mislukt. De financiële analyse blijft geldig.</p>
        <p className="mt-1 text-sm">{loadError}</p>
        <button
          type="button"
          onClick={() => {
            setLoadError(null);
            setLoadNonce((n) => n + 1);
          }}
          className="mt-3 rounded-lg bg-red-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-800"
        >
          Opnieuw laden
        </button>
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
    <div className="flex min-h-0 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-40"
            disabled={pageIndex <= 0}
            onClick={() => goToPage(pageIndex - 1)}
          >
            Vorige
          </button>
          <label className="flex items-center gap-1 text-sm text-slate-600">
            Pagina
            <input
              type="number"
              min={1}
              max={totalPages || undefined}
              value={pageInput}
              onChange={(event) => setPageInput(event.target.value)}
              onBlur={() => goToPage(Number(pageInput) - 1)}
              onKeyDown={(event) => {
                if (event.key === "Enter") goToPage(Number(pageInput) - 1);
              }}
              className="w-16 rounded border border-slate-200 px-1 py-0.5 text-center"
            />
            {totalPages > 0 ? `/ ${totalPages}` : ""}
          </label>
          <button
            type="button"
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-40"
            disabled={totalPages > 0 ? pageIndex >= totalPages - 1 : true}
            onClick={() => goToPage(pageIndex + 1)}
          >
            Volgende
          </button>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <button
            type="button"
            className="rounded-lg px-2 py-1 ring-1 ring-slate-200 hover:bg-slate-50"
            onClick={() => {
              userZoomedRef.current = true;
              setZoom((z) => Math.max(0.5, Math.round((z - 0.25) * 100) / 100));
            }}
          >
            −
          </button>
          <span className="min-w-12 text-center text-slate-600">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            className="rounded-lg px-2 py-1 ring-1 ring-slate-200 hover:bg-slate-50"
            onClick={() => {
              userZoomedRef.current = true;
              setZoom((z) => Math.min(4, Math.round((z + 0.25) * 100) / 100));
            }}
          >
            +
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
                onClick={() => goToPage(page)}
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

      {pdf && (
        <PdfThumbnails
          pdf={pdf}
          pages={scannedPages.length > 0 ? scannedPages : [pageIndex]}
          currentPage={pageIndex}
          onSelectPage={goToPage}
        />
      )}

      <div
        ref={viewportRef}
        className="relative min-h-[28rem] flex-1 overflow-auto rounded border border-slate-200 bg-slate-50"
      >
        {rendering && (
          <div className="absolute inset-x-0 top-0 z-10 bg-white/80 px-3 py-1 text-xs text-slate-500">
            Pagina laden…
          </div>
        )}
        <div className="relative inline-block min-w-full">
          <canvas ref={canvasRef} className="block h-auto max-w-none" />
          <div className="absolute inset-0">
            {pageHighlights.map((h, index) => {
              const occ = occurrenceIndexOf(highlights, h);
              const selected =
                selection &&
                selection.section === h.section &&
                selection.code === h.code &&
                selection.occurrenceIndex === occ;
              const emphasize = selected || !selection;
              const key = `${h.section}:${h.code}:${occ}:${index}`;
              return (
                <button
                  key={key}
                  type="button"
                  ref={(node) => {
                    highlightRefs.current[`${h.section}:${h.code}:${occ}`] = node;
                  }}
                  title={`${h.code} (${SECTION_LABELS[h.section] ?? h.section})`}
                  className={`absolute box-border ${
                    selected
                      ? "ring-2 ring-emerald-700 ring-offset-1"
                      : emphasize
                        ? "ring-1 ring-black/10"
                        : "opacity-70"
                  }`}
                  style={overlayStyle(h)}
                  onClick={() => onSelectHighlight(h, occ)}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function PdfThumbnails({
  pdf,
  pages,
  currentPage,
  onSelectPage,
}: {
  pdf: PDFDocumentProxy;
  pages: number[];
  currentPage: number;
  onSelectPage: (page: number) => void;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {pages.map((page) => (
        <Thumbnail
          key={page}
          pdf={pdf}
          pageIndex={page}
          active={page === currentPage}
          onClick={() => onSelectPage(page)}
        />
      ))}
    </div>
  );
}

function Thumbnail({
  pdf,
  pageIndex,
  active,
  onClick,
}: {
  pdf: PDFDocumentProxy;
  pageIndex: number;
  active: boolean;
  onClick: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const page = await pdf.getPage(pageIndex + 1);
      if (cancelled) return;
      const viewport = page.getViewport({ scale: 0.18 });
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const context = canvas.getContext("2d");
      if (!context) return;
      await page.render({ canvas, canvasContext: context, viewport }).promise;
    })();
    return () => {
      cancelled = true;
    };
  }, [pdf, pageIndex]);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded border p-0.5 ${
        active ? "border-emerald-600 ring-1 ring-emerald-600" : "border-slate-200"
      }`}
    >
      <canvas ref={canvasRef} className="block h-20 w-auto" />
      <span className="block text-center text-[10px] text-slate-500">{pageIndex + 1}</span>
    </button>
  );
}
