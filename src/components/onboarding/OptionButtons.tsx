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
          className="rounded-xl border border-stone-200 bg-white px-4 py-2 text-sm text-stone-600 hover:border-stone-300 hover:bg-stone-50 hover:text-stone-800 hover:shadow-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {opt}
        </button>
      ))}
    </div>
  );
}
