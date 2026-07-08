/**
 * Session storage with localStorage backup.
 *
 * 核心计划数据原本只存 sessionStorage，刷新/关闭标签页即丢失。
 * 这里在写入 sessionStorage 的同时备份到 localStorage，
 * 读取时若 sessionStorage 为空则自动从备份恢复。
 */

const BACKUP_PREFIX = "qicheng_backup_";

export function saveSessionItem(key: string, value: string) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(key, value);
    localStorage.setItem(BACKUP_PREFIX + key, value);
  } catch {
    /* storage full or unavailable */
  }
}

export function loadSessionItem(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    const ss = sessionStorage.getItem(key);
    if (ss) return ss;
    const backup = localStorage.getItem(BACKUP_PREFIX + key);
    if (backup) {
      sessionStorage.setItem(key, backup);
      return backup;
    }
  } catch {
    /* ignore */
  }
  return null;
}
