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
    ? "border-blue-400/20 bg-blue-500/[0.07]"
    : msg.type === "milestone_achieved"
      ? "border-green-400/20 bg-green-500/[0.07]"
      : msg.type === "streak_maintain"
        ? "border-emerald-400/20 bg-emerald-500/[0.07]"
        : "border-amber-400/20 bg-amber-500/[0.07]";

  return (
    <div className={`relative rounded-2xl border p-4 mb-6 backdrop-blur-md ${bgColor}`}>
      <button
        onClick={() => setShow(false)}
        className="absolute top-3 right-3 text-white/35 hover:text-white/65 transition-colors"
        aria-label="关闭"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
      <p className="text-sm font-medium text-white/80 pr-6">
        {msg.emoji} {msg.content}
      </p>
      {msg.cta && (
        <button
          onClick={() => setShow(false)}
          className="mt-3 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-500 px-4 py-2 text-xs font-medium text-white hover:from-indigo-400 hover:to-purple-400 transition-all"
        >
          {msg.cta}
        </button>
      )}
    </div>
  );
}
