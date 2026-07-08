"use client";

import { useRouter } from "next/navigation";

type Props = {
  icon: string;
  title: string;
  description: string;
  actionLabel: string;
  actionHref: string;
  secondaryLabel?: string;
  secondaryHref?: string;
};

export function EmptyState({ icon, title, description, actionLabel, actionHref, secondaryLabel, secondaryHref }: Props) {
  const router = useRouter();

  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 animate-fade-in">
      <div className="relative mb-6">
        <div className="w-20 h-20 rounded-2xl border border-cyan-400/15 bg-cyan-400/[0.03] flex items-center justify-center text-3xl shadow-[0_0_30px_rgba(34,211,238,0.06)]">
          {icon}
        </div>
        <div className="absolute -inset-4 rounded-3xl bg-gradient-to-br from-cyan-400/5 to-transparent blur-xl pointer-events-none" />
      </div>

      <h3 className="text-base font-semibold text-white/70 mb-2 tracking-wide">{title}</h3>
      <p className="text-xs text-white/35 max-w-sm text-center leading-relaxed mb-8">{description}</p>

      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push(actionHref)}
          className="px-6 py-2.5 text-xs font-medium tracking-wider text-black bg-gradient-to-r from-cyan-400 to-blue-500 rounded-xl hover:opacity-90 transition-all shadow-[0_0_20px_rgba(34,211,238,0.2)]"
        >
          {actionLabel}
        </button>
        {secondaryLabel && secondaryHref && (
          <button
            onClick={() => router.push(secondaryHref)}
            className="px-6 py-2.5 text-xs font-medium tracking-wider text-white/40 border border-white/10 rounded-xl hover:bg-white/[0.03] transition-all"
          >
            {secondaryLabel}
          </button>
        )}
      </div>
    </div>
  );
}
