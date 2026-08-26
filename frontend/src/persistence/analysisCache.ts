import type { AnalysisResult } from "../types";
import { hashBlob } from "../utils/hash";

const DB_NAME = "jaarrekening-analyzer";
const DB_VERSION = 1;
const STORE = "latest";
const RECORD_ID = "latest";

export interface CachedAnalysis {
  contentHash: string;
  analysis: AnalysisResult;
  pdfBlob: Blob;
  fileName: string;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB open failed"));
  });
}

export async function saveCachedAnalysis(
  analysis: AnalysisResult,
  pdf: Blob,
  fileName: string,
): Promise<string> {
  const contentHash = await hashBlob(pdf);
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB write failed"));
    tx.objectStore(STORE).put({
      id: RECORD_ID,
      contentHash,
      analysis,
      pdfBlob: pdf,
      fileName,
    });
  });
  db.close();
  return contentHash;
}

export async function loadCachedAnalysis(): Promise<CachedAnalysis | null> {
  const db = await openDb();
  const record = await new Promise<
    | {
        contentHash: string;
        analysis: AnalysisResult;
        pdfBlob: Blob;
        fileName: string;
      }
    | undefined
  >((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const request = tx.objectStore(STORE).get(RECORD_ID);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB read failed"));
  });
  db.close();
  if (!record?.pdfBlob || !record.analysis || !record.contentHash) return null;

  const actualHash = await hashBlob(record.pdfBlob);
  if (actualHash !== record.contentHash) {
    return null;
  }
  return {
    contentHash: record.contentHash,
    analysis: record.analysis,
    pdfBlob: record.pdfBlob,
    fileName: record.fileName || "analyse.pdf",
  };
}

export async function verifyPdfMatchesHash(
  pdf: Blob,
  expectedHash: string,
): Promise<boolean> {
  const actual = await hashBlob(pdf);
  return actual === expectedHash;
}
