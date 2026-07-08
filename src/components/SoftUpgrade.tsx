"use client";

import { useState } from "react";

type SoftUpgradeProps = {
  nextTaskName?: string;
  nextTaskMinutes?: number;
  onAccept?: () => void;
};

export function SoftUpgrade({ nextTaskName, nextTaskMinutes, onAccept }: SoftUpgradeProps) {
  const [dismissed, setDismissed] = useState(false);
  const [accepted, setAccepted] = useState(false);

  if (dismissed || !nextTaskName) return null;

  if (accepted) {
    return (
      <div className="rounded-lg border border-emerald-400/20 bg-emerald-500/[0.08] p-4 mt-4">
        <p className="text-sm text-emerald-300">开始吧 →「{nextTaskName}」</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-white/[0.08] bg-white/[0.04] p-4 mt-4">
      <p className="text-sm text-white/75">
        完成了 ✓ {nextTaskMinutes && nextTaskMinutes <= 20
          ? `还有 ${nextTaskMinutes} 分钟的话，要不要把下一个也做了？`
          : `状态好的话，下一步是「${nextTaskName}」。要继续吗？`}
      </p>
      <div className="flex gap-2 mt-3">
        <button
          onClick={() => { setAccepted(true); onAccept?.(); }}
          className="rounded-lg bg-gradient-to-r from-indigo-500 to-purple-500 px-4 py-2 text-xs text-white hover:opacity-90 transition-opacity"
        >
          继续做
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="rounded-lg border border-white/10 px-4 py-2 text-xs text-white/50 hover:text-white/75 hover:border-white/20 transition-colors"
        >
          今天够了
        </button>
      </div>
    </div>
  );
}
