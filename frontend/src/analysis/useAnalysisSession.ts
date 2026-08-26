import { useCallback, useEffect, useRef, useState } from "react";
import {
  cancelAnalyzeJob,
  computeRatios,
  getAnalyzeJob,
  startAnalyzeJob,
} from "../api/client";
import {
  loadCachedAnalysis,
  saveCachedAnalysis,
} from "../persistence/analysisCache";
import { SANDBOX_DRAFT_KEY } from "../persistence/preferences";
import type {
  AnalysisResult,
  AnalysisStatus,
  AnalyzeJobStatus,
  RatioResult,
  RatioSpec,
} from "../types";
import { hashFile } from "../utils/hash";
import { normalizeSpec } from "../utils/ratiosYaml";

const POLL_MS = 400;
const RECOMPUTE_DEBOUNCE_MS = 400;

export type RecomputeState = "idle" | "updating" | "failed";

function loadSandboxDraft(): RatioSpec[] {
  const raw =
    localStorage.getItem(SANDBOX_DRAFT_KEY) ??
    sessionStorage.getItem(SANDBOX_DRAFT_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as RatioSpec[];
    const specs = Array.isArray(parsed) ? parsed.map((s) => normalizeSpec(s)) : [];
    if (specs.length > 0) {
      localStorage.setItem(SANDBOX_DRAFT_KEY, JSON.stringify(specs));
      sessionStorage.removeItem(SANDBOX_DRAFT_KEY);
      sessionStorage.removeItem("ratioSandboxEnabled");
    }
    return specs;
  } catch {
    return [];
  }
}

export function useAnalysisSession() {
  const [status, setStatus] = useState<AnalysisStatus>("idle");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [stale, setStale] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [contentHash, setContentHash] = useState<string | null>(null);
  const [job, setJob] = useState<AnalyzeJobStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [errorStageLabel, setErrorStageLabel] = useState<string | null>(null);
  const [cancelMessage, setCancelMessage] = useState<string | null>(null);
  const [restoreReady, setRestoreReady] = useState(false);

  const [sandboxEnabled, setSandboxEnabled] = useState(false);
  const [sandboxDraft, setSandboxDraft] = useState<RatioSpec[]>(loadSandboxDraft);
  const [recomputeState, setRecomputeState] = useState<RecomputeState>("idle");
  const [recomputeError, setRecomputeError] = useState<string | null>(null);
  const [overlayRatios, setOverlayRatios] = useState<RatioResult[] | null>(null);
  const [overlayValidations, setOverlayValidations] = useState<string[] | null>(
    null,
  );

  const jobIdRef = useRef<string | null>(null);
  const pollTimerRef = useRef<number | null>(null);
  const pdfUrlRef = useRef<string | null>(null);
  const resultRef = useRef<AnalysisResult | null>(null);
  const recomputeTimerRef = useRef<number | null>(null);
  const recomputeGenRef = useRef(0);

  resultRef.current = result;

  const revokePdf = useCallback(() => {
    if (pdfUrlRef.current) {
      URL.revokeObjectURL(pdfUrlRef.current);
      pdfUrlRef.current = null;
    }
  }, []);

  const setPdfFromBlob = useCallback(
    (blob: Blob, fileName: string) => {
      revokePdf();
      const url = URL.createObjectURL(blob);
      pdfUrlRef.current = url;
      setPdfUrl(url);
      const file =
        blob instanceof File
          ? blob
          : new File([blob], fileName, { type: "application/pdf" });
      setPdfFile(file);
    },
    [revokePdf],
  );

  useEffect(() => {
    let cancelled = false;
    sessionStorage.removeItem("analysisResult");
    (async () => {
      try {
        const cached = await loadCachedAnalysis();
        if (cancelled || !cached) return;
        setPdfFromBlob(cached.pdfBlob, cached.fileName);
        setResult(cached.analysis);
        setContentHash(cached.contentHash);
        setStatus("completed");
        setStale(false);
      } catch {
        // Cache is optional; stay idle.
      } finally {
        if (!cancelled) setRestoreReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setPdfFromBlob]);

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) window.clearTimeout(pollTimerRef.current);
      revokePdf();
    };
  }, [revokePdf]);

  useEffect(() => {
    if (sandboxDraft.length > 0) {
      localStorage.setItem(SANDBOX_DRAFT_KEY, JSON.stringify(sandboxDraft));
    }
  }, [sandboxDraft]);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      window.clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const applyJobFailure = useCallback((payload: AnalyzeJobStatus) => {
    setJob(payload);
    setStatus("error");
    setError(payload.error ?? "Analyse mislukt.");
    setErrorDetail(payload.error_detail);
    setErrorStageLabel(payload.error_stage_label);
    setStale(false);
  }, []);

  const applyJobSuccess = useCallback(
    async (payload: AnalyzeJobStatus, file: File) => {
      if (!payload.result) return;
      const hash = await hashFile(file);
      setResult(payload.result);
      setContentHash(hash);
      setStale(false);
      setStatus("completed");
      setError(null);
      setErrorDetail(null);
      setErrorStageLabel(null);
      setCancelMessage(null);
      setOverlayRatios(null);
      setOverlayValidations(null);
      setRecomputeState("idle");
      setRecomputeError(null);
      try {
        await saveCachedAnalysis(payload.result, file, file.name);
      } catch {
        // Persistence failure must not hide a successful analysis.
      }
    },
    [],
  );

  const pollJob = useCallback(
    async (jobId: string, file: File) => {
      if (jobIdRef.current !== jobId) return;
      try {
        const payload = await getAnalyzeJob(jobId);
        if (jobIdRef.current !== jobId) return;
        setJob(payload);
        if (payload.status === "completed") {
          stopPolling();
          jobIdRef.current = null;
          await applyJobSuccess(payload, file);
          return;
        }
        if (payload.status === "error") {
          stopPolling();
          jobIdRef.current = null;
          applyJobFailure(payload);
          return;
        }
        if (payload.status === "canceled") {
          stopPolling();
          jobIdRef.current = null;
          setJob(payload);
          if (resultRef.current) {
            setStatus("completed");
            setStale(false);
            setCancelMessage(null);
          } else {
            setStatus("canceled");
            setCancelMessage("Analyse geannuleerd.");
          }
          return;
        }
        pollTimerRef.current = window.setTimeout(() => {
          void pollJob(jobId, file);
        }, POLL_MS);
      } catch (err) {
        if (jobIdRef.current !== jobId) return;
        stopPolling();
        jobIdRef.current = null;
        setStatus("error");
        setError(err instanceof Error ? err.message : "Status ophalen mislukt.");
        setStale(false);
      }
    },
    [applyJobFailure, applyJobSuccess, stopPolling],
  );

  const startAnalysis = useCallback(
    async (file: File) => {
      stopPolling();
      const previousJobId = jobIdRef.current;
      if (previousJobId) {
        jobIdRef.current = null;
        void cancelAnalyzeJob(previousJobId).catch(() => undefined);
      }

      setPdfFromBlob(file, file.name);
      setStatus("analyzing");
      setError(null);
      setErrorDetail(null);
      setErrorStageLabel(null);
      setCancelMessage(null);
      setJob(null);
      setStale(resultRef.current !== null);
      setOverlayRatios(null);
      setOverlayValidations(null);
      setRecomputeState("idle");

      const override =
        sandboxEnabled && sandboxDraft.length > 0 ? sandboxDraft : undefined;
      try {
        const created = await startAnalyzeJob(file, override);
        jobIdRef.current = created.job_id;
        void pollJob(created.job_id, file);
      } catch (err) {
        jobIdRef.current = null;
        setStatus("error");
        setError(err instanceof Error ? err.message : "Analyse starten mislukt.");
        setStale(false);
      }
    },
    [pollJob, sandboxDraft, sandboxEnabled, setPdfFromBlob, stopPolling],
  );

  const cancelAnalysis = useCallback(async () => {
    const jobId = jobIdRef.current;
    stopPolling();
    jobIdRef.current = null;
    if (jobId) {
      try {
        await cancelAnalyzeJob(jobId);
      } catch {
        // Local cancel still applies.
      }
    }
    setJob((current) =>
      current
        ? { ...current, status: "canceled", result: null }
        : current,
    );
    if (resultRef.current) {
      setStatus("completed");
      setStale(false);
      setError(null);
      setCancelMessage(null);
    } else {
      setStatus("canceled");
      setCancelMessage("Analyse geannuleerd.");
      setError(null);
    }
  }, [stopPolling]);

  const retryAnalysis = useCallback(() => {
    if (pdfFile) void startAnalysis(pdfFile);
  }, [pdfFile, startAnalysis]);

  const runRecompute = useCallback(
    (draft: RatioSpec[], enabled: boolean, analysis: AnalysisResult) => {
      if (recomputeTimerRef.current) {
        window.clearTimeout(recomputeTimerRef.current);
      }
      const gen = ++recomputeGenRef.current;
      setRecomputeState("updating");
      setRecomputeError(null);
      recomputeTimerRef.current = window.setTimeout(() => {
        void (async () => {
          try {
            const payload = await computeRatios({
              balance_assets: analysis.balance_assets,
              balance_liabilities: analysis.balance_liabilities,
              income_statement: analysis.income_statement,
              ratios: enabled && draft.length > 0 ? draft : undefined,
            });
            if (recomputeGenRef.current !== gen) return;
            setOverlayRatios(payload.ratios);
            setOverlayValidations(payload.validations);
            setRecomputeState("idle");
            setResult((current) => {
              if (!current) return current;
              const next = {
                ...current,
                ratios: payload.ratios,
                validations: payload.validations,
              };
              if (pdfFile && contentHash) {
                void saveCachedAnalysis(next, pdfFile, pdfFile.name).catch(
                  () => undefined,
                );
              }
              return next;
            });
          } catch (err) {
            if (recomputeGenRef.current !== gen) return;
            setRecomputeState("failed");
            setRecomputeError(
              err instanceof Error ? err.message : "Herberekening mislukt.",
            );
          }
        })();
      }, RECOMPUTE_DEBOUNCE_MS);
    },
    [contentHash, pdfFile],
  );

  const setSandboxEnabledAndMaybeRecompute = useCallback(
    (enabled: boolean) => {
      setSandboxEnabled(enabled);
      if (status === "completed" && !stale && result) {
        runRecompute(sandboxDraft, enabled, result);
      }
    },
    [result, runRecompute, sandboxDraft, stale, status],
  );

  const setSandboxDraftAndMaybeRecompute = useCallback(
    (updater: RatioSpec[] | ((current: RatioSpec[]) => RatioSpec[])) => {
      setSandboxDraft((current) => {
        const next = typeof updater === "function" ? updater(current) : updater;
        if (sandboxEnabled && status === "completed" && !stale && resultRef.current) {
          runRecompute(next, true, resultRef.current);
        }
        return next;
      });
    },
    [runRecompute, sandboxEnabled, stale, status],
  );

  const refreshLiveRatios = useCallback(() => {
    if (sandboxEnabled) return;
    if (status === "completed" && !stale && resultRef.current) {
      runRecompute(sandboxDraft, false, resultRef.current);
    }
  }, [runRecompute, sandboxDraft, sandboxEnabled, stale, status]);

  const displayedRatios = overlayRatios ?? result?.ratios ?? [];
  const displayedValidations = overlayValidations ?? result?.validations ?? [];

  return {
    status,
    result,
    stale,
    pdfUrl,
    pdfFile,
    contentHash,
    job,
    error,
    errorDetail,
    errorStageLabel,
    cancelMessage,
    restoreReady,
    startAnalysis,
    cancelAnalysis,
    retryAnalysis,
    sandboxEnabled,
    sandboxDraft,
    setSandboxEnabled: setSandboxEnabledAndMaybeRecompute,
    setSandboxDraft: setSandboxDraftAndMaybeRecompute,
    refreshLiveRatios,
    recomputeState,
    recomputeError,
    displayedRatios,
    displayedValidations,
  };
}
