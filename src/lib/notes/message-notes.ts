/**
 * 消息式笔记存储（纯文本，零 Markdown 门槛）。
 *
 * 每条笔记 = 纯文本 + 时间戳 + 关联节点。像发消息一样记录，
 * 内部以 JSON 存 localStorage，对用户完全透明。
 * 若用户选择过本地目录（File System Access API），
 * 则同时把该节点的笔记以可读文本写入 note.md 作为备份。
 */

import { writeNote, hasNotesDirectory } from "./fs-provider";

export type MessageNoteKind = "user" | "excerpt" | "ai_summary";

export type MessageNote = {
  id: string;
  /** 纯文本内容 */
  content: string;
  nodeId: string;
  nodeName: string;
  subjectName: string;
  createdAt: number;
  /** user=手写 · excerpt=卡片摘录 · ai_summary=AI 整理稿 */
  kind: MessageNoteKind;
};

const STORAGE_KEY = "qc_msg_notes";

export function loadAllNotes(): MessageNote[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]") as MessageNote[];
  } catch {
    return [];
  }
}

function saveAll(notes: MessageNote[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  } catch { /* quota */ }
}

export function getNotesForNode(nodeId: string): MessageNote[] {
  return loadAllNotes()
    .filter((n) => n.nodeId === nodeId)
    .sort((a, b) => a.createdAt - b.createdAt);
}

export function addNote(input: {
  content: string;
  nodeId: string;
  nodeName: string;
  subjectName: string;
  kind?: MessageNoteKind;
}): MessageNote {
  const note: MessageNote = {
    id: `note_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    content: input.content.trim(),
    nodeId: input.nodeId,
    nodeName: input.nodeName,
    subjectName: input.subjectName,
    createdAt: Date.now(),
    kind: input.kind || "user",
  };
  const all = loadAllNotes();
  all.push(note);
  saveAll(all);
  void syncNodeToFile(input.nodeId);
  return note;
}

export function deleteNote(id: string) {
  const all = loadAllNotes();
  const target = all.find((n) => n.id === id);
  saveAll(all.filter((n) => n.id !== id));
  if (target) void syncNodeToFile(target.nodeId);
}

/**
 * 用 AI 整理稿替换节点的碎片笔记：
 * 删除该节点全部 user/excerpt 碎片与旧整理稿，保留一条新的 ai_summary。
 */
export function replaceNodeNotesWithSummary(
  nodeId: string,
  summary: Omit<MessageNote, "id" | "createdAt" | "kind">
): MessageNote {
  const all = loadAllNotes().filter((n) => n.nodeId !== nodeId);
  const note: MessageNote = {
    ...summary,
    id: `note_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: Date.now(),
    kind: "ai_summary",
  };
  all.push(note);
  saveAll(all);
  void syncNodeToFile(nodeId);
  return note;
}

/** 全局搜索（内容/节点名/学科名） */
export function searchMessageNotes(query: string): MessageNote[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return loadAllNotes().filter(
    (n) =>
      n.content.toLowerCase().includes(q) ||
      n.nodeName.toLowerCase().includes(q) ||
      n.subjectName.toLowerCase().includes(q)
  );
}

/** 把某节点的全部笔记序列化为可读文本，写入本地 note.md（选择过目录时） */
async function syncNodeToFile(nodeId: string) {
  try {
    if (!hasNotesDirectory()) return;
    const notes = getNotesForNode(nodeId);
    if (notes.length === 0) return;
    const { subjectName, nodeName } = notes[0];
    const lines: string[] = [`# ${nodeName} · 学习笔记`, ""];
    for (const n of notes) {
      const time = new Date(n.createdAt).toLocaleString("zh-CN");
      const tag = n.kind === "ai_summary" ? "【AI 整理】" : n.kind === "excerpt" ? "【摘录】" : "";
      lines.push(`- ${time} ${tag}`);
      lines.push(`  ${n.content.replace(/\n/g, "\n  ")}`);
      lines.push("");
    }
    await writeNote(subjectName, nodeName, lines.join("\n"));
  } catch { /* best-effort backup */ }
}
