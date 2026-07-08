/**
 * File System Access API provider for local note storage.
 * Directory structure: {root}/{subjectName}/{nodeName}/note.md, images/, audio/
 * Falls back to localStorage if File System Access API is not available.
 */

const DB_NAME = "qicheng_notes_db";
const STORE_NAME = "dir_handles";
const ROOT_HANDLE_KEY = "root_dir";

type NoteMetadata = {
  nodeId: string;
  subjectName: string;
  nodeName: string;
  lastModified: number;
  wordCount: number;
};

let _rootHandle: FileSystemDirectoryHandle | null = null;

function isFileSystemAccessSupported(): boolean {
  return typeof window !== "undefined" && "showDirectoryPicker" in window;
}

async function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveHandleToDB(handle: FileSystemDirectoryHandle) {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readwrite");
  tx.objectStore(STORE_NAME).put(handle, ROOT_HANDLE_KEY);
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function loadHandleFromDB(): Promise<FileSystemDirectoryHandle | null> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readonly");
  const req = tx.objectStore(STORE_NAME).get(ROOT_HANDLE_KEY);
  return new Promise((resolve) => {
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => resolve(null);
  });
}

/** Request user to pick the notes root directory */
export async function pickNotesDirectory(): Promise<boolean> {
  if (!isFileSystemAccessSupported()) return false;
  try {
    const handle = await (window as unknown as { showDirectoryPicker: (opts?: object) => Promise<FileSystemDirectoryHandle> })
      .showDirectoryPicker({ mode: "readwrite" });
    _rootHandle = handle;
    await saveHandleToDB(handle);
    return true;
  } catch {
    return false;
  }
}

/** Try to restore previously selected directory handle */
export async function restoreNotesDirectory(): Promise<boolean> {
  if (!isFileSystemAccessSupported()) return false;
  try {
    const handle = await loadHandleFromDB();
    if (!handle) return false;
    const perm = await (handle as unknown as { queryPermission: (opts: object) => Promise<string> })
      .queryPermission({ mode: "readwrite" });
    if (perm === "granted") {
      _rootHandle = handle;
      return true;
    }
    const reqPerm = await (handle as unknown as { requestPermission: (opts: object) => Promise<string> })
      .requestPermission({ mode: "readwrite" });
    if (reqPerm === "granted") {
      _rootHandle = handle;
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function hasNotesDirectory(): boolean {
  return _rootHandle !== null;
}

async function getNodeDir(subjectName: string, nodeName: string): Promise<FileSystemDirectoryHandle | null> {
  if (!_rootHandle) return null;
  try {
    const subjectDir = await _rootHandle.getDirectoryHandle(
      sanitizeName(subjectName), { create: true }
    );
    return await subjectDir.getDirectoryHandle(
      sanitizeName(nodeName), { create: true }
    );
  } catch {
    return null;
  }
}

function sanitizeName(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, "_").trim().slice(0, 100);
}

/** Read note markdown content for a node */
export async function readNote(subjectName: string, nodeName: string): Promise<string> {
  if (!_rootHandle) {
    return localStorage.getItem(`qc_note_${sanitizeName(subjectName)}_${sanitizeName(nodeName)}`) || "";
  }
  try {
    const dir = await getNodeDir(subjectName, nodeName);
    if (!dir) return "";
    const fileHandle = await dir.getFileHandle("note.md", { create: false });
    const file = await fileHandle.getFile();
    return await file.text();
  } catch {
    return "";
  }
}

/** Write note markdown content for a node */
export async function writeNote(subjectName: string, nodeName: string, content: string): Promise<boolean> {
  if (!_rootHandle) {
    try {
      localStorage.setItem(`qc_note_${sanitizeName(subjectName)}_${sanitizeName(nodeName)}`, content);
      return true;
    } catch { return false; }
  }
  try {
    const dir = await getNodeDir(subjectName, nodeName);
    if (!dir) return false;
    const fileHandle = await dir.getFileHandle("note.md", { create: true });
    const writable = await (fileHandle as unknown as { createWritable: () => Promise<WritableStream & { write: (data: string) => Promise<void>; close: () => Promise<void> }> }).createWritable();
    await writable.write(content);
    await writable.close();
    return true;
  } catch {
    return false;
  }
}

/** Save an image blob to the node's images/ folder, returns filename */
export async function saveImage(subjectName: string, nodeName: string, blob: Blob, filename?: string): Promise<string | null> {
  const name = filename || `img_${Date.now()}.png`;
  if (!_rootHandle) {
    try {
      const reader = new FileReader();
      const dataUrl = await new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
      localStorage.setItem(`qc_img_${sanitizeName(subjectName)}_${sanitizeName(nodeName)}_${name}`, dataUrl);
      return name;
    } catch { return null; }
  }
  try {
    const dir = await getNodeDir(subjectName, nodeName);
    if (!dir) return null;
    const imgDir = await dir.getDirectoryHandle("images", { create: true });
    const fileHandle = await imgDir.getFileHandle(name, { create: true });
    const writable = await (fileHandle as unknown as { createWritable: () => Promise<WritableStream & { write: (data: Blob) => Promise<void>; close: () => Promise<void> }> }).createWritable();
    await writable.write(blob);
    await writable.close();
    return name;
  } catch {
    return null;
  }
}

/** Save audio blob, returns filename */
export async function saveAudio(subjectName: string, nodeName: string, blob: Blob): Promise<string | null> {
  const name = `audio_${Date.now()}.webm`;
  if (!_rootHandle) {
    try {
      const reader = new FileReader();
      const dataUrl = await new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
      localStorage.setItem(`qc_audio_${sanitizeName(subjectName)}_${sanitizeName(nodeName)}_${name}`, dataUrl);
      return name;
    } catch { return null; }
  }
  try {
    const dir = await getNodeDir(subjectName, nodeName);
    if (!dir) return null;
    const audioDir = await dir.getDirectoryHandle("audio", { create: true });
    const fileHandle = await audioDir.getFileHandle(name, { create: true });
    const writable = await (fileHandle as unknown as { createWritable: () => Promise<WritableStream & { write: (data: Blob) => Promise<void>; close: () => Promise<void> }> }).createWritable();
    await writable.write(blob);
    await writable.close();
    return name;
  } catch {
    return null;
  }
}

/** List all notes (subject/node pairs) from the root directory */
export async function listAllNotes(): Promise<NoteMetadata[]> {
  const results: NoteMetadata[] = [];
  if (!_rootHandle) {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith("qc_note_")) {
        const parts = key.replace("qc_note_", "").split("_");
        const content = localStorage.getItem(key) || "";
        results.push({
          nodeId: parts.join("_"),
          subjectName: parts[0] || "未知",
          nodeName: parts.slice(1).join("_") || "未知",
          lastModified: Date.now(),
          wordCount: content.length,
        });
      }
    }
    return results;
  }
  try {
    for await (const [subjectName, subjectEntry] of (_rootHandle as unknown as AsyncIterable<[string, FileSystemHandle]>)) {
      if ((subjectEntry as FileSystemHandle).kind !== "directory") continue;
      const subjectDir = subjectEntry as FileSystemDirectoryHandle;
      for await (const [nodeName, nodeEntry] of (subjectDir as unknown as AsyncIterable<[string, FileSystemHandle]>)) {
        if ((nodeEntry as FileSystemHandle).kind !== "directory") continue;
        const nodeDir = nodeEntry as FileSystemDirectoryHandle;
        try {
          const noteFile = await nodeDir.getFileHandle("note.md", { create: false });
          const file = await noteFile.getFile();
          const text = await file.text();
          results.push({
            nodeId: `${subjectName}_${nodeName}`,
            subjectName,
            nodeName,
            lastModified: file.lastModified,
            wordCount: text.length,
          });
        } catch { /* no note.md */ }
      }
    }
  } catch { /* iteration error */ }
  return results;
}
