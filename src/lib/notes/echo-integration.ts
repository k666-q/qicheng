/**
 * Note Echo Integration: connects notes to the stimulus echo system.
 * Extracts snippets from past notes for review/recall stimulation.
 */

import { readNote } from "./fs-provider";

export type NoteSnippet = {
  nodeId: string;
  subjectName: string;
  nodeName: string;
  content: string;
  lineStart: number;
};

/**
 * Extract meaningful snippets from a note (non-empty paragraphs).
 */
function extractSnippets(
  content: string,
  nodeId: string,
  subjectName: string,
  nodeName: string
): NoteSnippet[] {
  if (!content.trim()) return [];

  const lines = content.split("\n");
  const snippets: NoteSnippet[] = [];
  let current = "";
  let lineStart = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === "") {
      if (current.length > 20) {
        snippets.push({ nodeId, subjectName, nodeName, content: current.trim(), lineStart });
      }
      current = "";
      lineStart = i + 1;
    } else {
      if (!current) lineStart = i;
      current += (current ? "\n" : "") + line;
    }
  }
  if (current.length > 20) {
    snippets.push({ nodeId, subjectName, nodeName, content: current.trim(), lineStart });
  }

  return snippets;
}

/**
 * Get a random note snippet for echo/recall stimulus.
 * Reads from localStorage-based notes.
 */
export function getRandomNoteEcho(): NoteSnippet | null {
  if (typeof window === "undefined") return null;

  const noteKeys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith("qc_note_")) noteKeys.push(key);
  }

  if (noteKeys.length === 0) return null;

  // Pick a random note
  const key = noteKeys[Math.floor(Math.random() * noteKeys.length)];
  const content = localStorage.getItem(key) || "";
  const parts = key.replace("qc_note_", "").split("_");
  const subjectName = parts[0] || "未知";
  const nodeName = parts.slice(1).join("_") || "未知";
  const nodeId = key.replace("qc_note_", "");

  const snippets = extractSnippets(content, nodeId, subjectName, nodeName);
  if (snippets.length === 0) return null;

  return snippets[Math.floor(Math.random() * snippets.length)];
}

/**
 * Get all note snippets for a specific node (for AI summarization).
 */
export async function getNodeNoteSnippets(
  subjectName: string,
  nodeName: string,
  nodeId: string
): Promise<NoteSnippet[]> {
  const content = await readNote(subjectName, nodeName);
  return extractSnippets(content, nodeId, subjectName, nodeName);
}

/**
 * Search all notes for a query string. Returns matching snippets.
 */
export function searchNotes(query: string): NoteSnippet[] {
  if (typeof window === "undefined" || !query.trim()) return [];

  const results: NoteSnippet[] = [];
  const lowerQuery = query.toLowerCase();

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith("qc_note_")) continue;

    const content = localStorage.getItem(key) || "";
    if (!content.toLowerCase().includes(lowerQuery)) continue;

    const parts = key.replace("qc_note_", "").split("_");
    const subjectName = parts[0] || "未知";
    const nodeName = parts.slice(1).join("_") || "未知";
    const nodeId = key.replace("qc_note_", "");

    const snippets = extractSnippets(content, nodeId, subjectName, nodeName);
    const matching = snippets.filter((s) =>
      s.content.toLowerCase().includes(lowerQuery)
    );
    results.push(...matching);
  }

  return results;
}
