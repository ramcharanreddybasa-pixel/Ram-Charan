import type { PaperRecord, UserProfile, WorkspaceSettings } from "../types/paper";

const DB_NAME = "researchmate_ai_library_v1";
const DB_VERSION = 1;
const PAPERS_STORE = "papers";
const BLOBS_STORE = "pdf_blobs";

const SETTINGS_KEY = "researchmate_settings_v1";
const PROFILE_KEY = "researchmate_profile_v1";

export const DEFAULT_SETTINGS: WorkspaceSettings = {
  responseDepth: "balanced",
  includeCitations: true,
  defaultZoom: 1.0,
  autoOpenSummary: false,
};

export const DEFAULT_PROFILE: UserProfile = {
  name: "Dr. Clara Lin",
  role: "Graduate Researcher",
  institution: "Academic Reading Desk",
};

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(PAPERS_STORE)) {
        db.createObjectStore(PAPERS_STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(BLOBS_STORE)) {
        db.createObjectStore(BLOBS_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Failed to open local library database"));
  });
}

export async function loadAllPapers(): Promise<PaperRecord[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PAPERS_STORE, "readonly");
    const store = tx.objectStore(PAPERS_STORE);
    const req = store.getAll();
    req.onsuccess = () => {
      const items = (req.result as PaperRecord[]) || [];
      items.sort((a, b) => b.lastOpenedAt - a.lastOpenedAt);
      resolve(items);
    };
    req.onerror = () => reject(req.error ?? new Error("Failed to load library"));
  });
}

export async function savePaperRecord(paper: PaperRecord, pdfBlob?: Blob): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const stores = pdfBlob ? [PAPERS_STORE, BLOBS_STORE] : [PAPERS_STORE];
    const tx = db.transaction(stores, "readwrite");
    tx.objectStore(PAPERS_STORE).put(paper);
    if (pdfBlob) {
      tx.objectStore(BLOBS_STORE).put(pdfBlob, paper.id);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Failed to save paper"));
  });
}

export async function loadPaperBlob(paperId: string): Promise<Blob | null> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(BLOBS_STORE, "readonly");
    const req = tx.objectStore(BLOBS_STORE).get(paperId);
    req.onsuccess = () => {
      const result = req.result;
      if (result instanceof Blob) {
        resolve(result);
      } else if (result instanceof ArrayBuffer) {
        resolve(new Blob([result], { type: "application/pdf" }));
      } else {
        resolve(null);
      }
    };
    req.onerror = () => reject(req.error ?? new Error("Failed to load PDF file"));
  });
}

export async function deletePaperRecord(paperId: string): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([PAPERS_STORE, BLOBS_STORE], "readwrite");
    tx.objectStore(PAPERS_STORE).delete(paperId);
    tx.objectStore(BLOBS_STORE).delete(paperId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Failed to delete paper"));
  });
}

export async function clearAllPapers(): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([PAPERS_STORE, BLOBS_STORE], "readwrite");
    tx.objectStore(PAPERS_STORE).clear();
    tx.objectStore(BLOBS_STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Failed to clear library"));
  });
}

export function loadSettings(): WorkspaceSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: WorkspaceSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage quota errors
  }
}

export function loadProfile(): UserProfile {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return DEFAULT_PROFILE;
    return { ...DEFAULT_PROFILE, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_PROFILE;
  }
}

export function saveProfile(profile: UserProfile): void {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch {
    // Ignore storage quota errors
  }
}
