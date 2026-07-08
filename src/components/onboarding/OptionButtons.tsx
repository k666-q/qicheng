"use client";

type OptionButtonsProps = {
  options: string[];
  onSelect: (option: string) => void;
  disabled?: boolean;
};

export function OptionButtons({ options, onSelect, disabled }: OptionButtonsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => onSelect(opt)}
          disabled={disabled}
          className="border border-cyan-400/25 bg-cyan-400/[0.05] px-4 py-2 font-mono text-sm text-cyan-100/80 hover:border-cyan-400/60 hover:bg-cyan-400/15 hover:text-cyan-50 hover:shadow-[0_0_16px_rgba(34,211,238,0.15)] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {opt}
        </button>
      ))}
    </div>
  );
}
