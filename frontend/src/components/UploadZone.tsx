import { useRef, useState, type DragEvent } from "react";

interface UploadZoneProps {
  /** Wordt aangeroepen zodra de gebruiker een PDF kiest — parent doet de API-call. */
  onFile: (file: File) => void;
  /** True tijdens analyse: visuele status; selectie van een andere PDF blijft mogelijk. */
  loading: boolean;
}

function isPdfFile(file: File): boolean {
  return (
    file.type === "application/pdf" ||
    file.type === "application/octet-stream" ||
    file.name.toLowerCase().endsWith(".pdf")
  );
}

/**
 * Upload-UI met klik én drag-and-drop. Parent blijft controlled via onFile.
 */
export function UploadZone({ onFile, loading }: UploadZoneProps) {
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);

  function handleDragEnter(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    event.stopPropagation();
    dragDepth.current += 1;
    setDragging(true);
  }

  function handleDragLeave(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    event.stopPropagation();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragging(false);
  }

  function handleDragOver(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    event.stopPropagation();
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    event.stopPropagation();
    dragDepth.current = 0;
    setDragging(false);

    const file = event.dataTransfer.files?.[0];
    if (file && isPdfFile(file)) onFile(file);
  }

  return (
    <label
      id="upload-zone"
      tabIndex={0}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-8 py-12 transition outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
        loading
          ? "border-slate-300 bg-slate-100"
          : dragging
            ? "border-emerald-600 bg-emerald-50"
            : "border-emerald-400 bg-white hover:border-emerald-500 hover:bg-emerald-50"
      }`}
    >
      <input
        type="file"
        accept=".pdf,application/pdf"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file && isPdfFile(file)) onFile(file);
          event.target.value = "";
        }}
      />
      <p className="text-lg font-medium text-slate-800">
        {loading
          ? "Analyse bezig — kies een andere PDF om opnieuw te starten"
          : "Sleep een jaarrekening-PDF hierheen of klik om te kiezen"}
      </p>
    </label>
  );
}

export function HeaderUploadButton({
  onFile,
}: {
  onFile: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <input
        id="header-upload-input"
        ref={inputRef}
        type="file"
        accept=".pdf,application/pdf"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file && isPdfFile(file)) onFile(file);
          event.target.value = "";
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
      >
        Andere PDF
      </button>
    </>
  );
}
