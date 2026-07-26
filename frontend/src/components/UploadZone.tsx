interface UploadZoneProps {
  /** Wordt aangeroepen zodra de gebruiker een PDF kiest — parent doet de API-call. */
  onFile: (file: File) => void;
  /** True tijdens analyse: input disabled + grijze look. */
  loading: boolean;
}

/**
 * Presentational upload-UI: geen drag-drop library, alleen een styled <label>
 * rond een verborgen file-input. De parent blijft "controlled" via onFile.
 */
export function UploadZone({ onFile, loading }: UploadZoneProps) {
  return (
    <label
      className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-8 py-12 transition ${
        loading
          ? "border-slate-300 bg-slate-100 opacity-60"
          : "border-emerald-400 bg-white hover:border-emerald-500 hover:bg-emerald-50"
      }`}
    >
      <input
        type="file"
        accept=".pdf"
        className="hidden"
        disabled={loading}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onFile(file);
          // Zelfde bestand opnieuw kunnen kiezen
          event.target.value = "";
        }}
      />
      <p className="text-lg font-medium text-slate-800">
        {loading ? "PDF analyseren..." : "Sleep een jaarrekening-PDF hierheen"}
      </p>
    </label>
  );
}
