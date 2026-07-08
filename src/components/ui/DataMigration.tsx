"use client";

import { useEffect } from "react";

const DATA_VERSION = "nexiova_v2";

export function DataMigration() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(DATA_VERSION)) return;

    const PRESERVE = new Set([
      "qc_auth_user",
      "qc_users_db",
      "qc_anonymous_id",
      DATA_VERSION,
    ]);

    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && !PRESERVE.has(key)) keysToRemove.push(key);
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
    try { sessionStorage.clear(); } catch {}
    localStorage.setItem(DATA_VERSION, "1");

    if (keysToRemove.length > 0) {
      window.location.reload();
    }
  }, []);

  return null;
}
