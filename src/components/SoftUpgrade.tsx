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
      <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-4 mt-4">
        <p className="text-sm text-emerald-800">开始吧 →「{nextTaskName}」</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-stone-200 bg-stone-50 p-4 mt-4">
      <p className="text-sm text-stone-700">
        完成了 ✓ {nextTaskMinutes && nextTaskMinutes <= 20
          ? `还有 ${nextTaskMinutes} 分钟的话，要不要把下一个也做了？`
          : `状态好的话，下一步是「${nextTaskName}」。要继续吗？`}
      </p>
      <div className="flex gap-2 mt-3">
        <button
          onClick={() => { setAccepted(true); onAccept?.(); }}
          className="rounded-lg bg-stone-800 px-4 py-2 text-xs text-white hover:bg-stone-700 transition-colors"
        >
          继续做
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="rounded-lg border border-stone-200 px-4 py-2 text-xs text-stone-500 hover:text-stone-700 hover:border-stone-300 transition-colors"
        >
          今天够了
        </button>
      </div>
    </div>
  );
}
