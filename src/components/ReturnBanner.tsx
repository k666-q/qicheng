"use client";

import { useEffect, useState } from "react";
import { trackEvent } from "@/lib/profile/events";
import { detectProactiveMessage, type ProactiveMessage } from "@/lib/ai/proactive-messages";

export function ReturnBanner() {
  const [show, setShow] = useState(false);
  const [msg, setMsg] = useState<ProactiveMessage | null>(null);

  useEffect(() => {
    const detected = detectProactiveMessage();
    if (!detected) {
      setShow(false);
      return;
    }

    if (detected.type === "gentle_return" || detected.type === "real_return" || detected.type === "long_absence") {
      trackEvent("session_returned", { type: detected.type });
    }

    setMsg(detected);
    setShow(true);
  }, []);

  if (!show || !msg) return null;

  const bgColor = msg.type === "low_mood_detected"
    ? "border-blue-100 bg-blue-50"
    : msg.type === "milestone_achieved"
      ? "border-green-100 bg-green-50"
      : msg.type === "streak_maintain"
        ? "border-emerald-100 bg-emerald-50"
        : "border-amber-100 bg-amber-50";

  return (
    <div className={`relative rounded-lg border p-4 mb-6 ${bgColor}`}>
      <button
        onClick={() => setShow(false)}
        className="absolute top-3 right-3 text-stone-400 hover:text-stone-600 transition-colors"
        aria-label="关闭"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
      <p className="text-sm font-medium text-stone-800 pr-6">
        {msg.emoji} {msg.content}
      </p>
      {msg.cta && (
        <button
          onClick={() => setShow(false)}
          className="mt-3 rounded-lg bg-stone-800 px-4 py-2 text-xs font-medium text-white hover:bg-stone-700 transition-colors"
        >
          {msg.cta}
        </button>
      )}
    </div>
  );
}
