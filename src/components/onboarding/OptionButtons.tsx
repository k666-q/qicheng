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
          className="rounded-full border border-stone-200 bg-white px-4 py-2 text-sm text-stone-700 hover:border-stone-400 hover:bg-stone-50 transition-colors disabled:opacity-50"
        >
          {opt}
        </button>
      ))}
    </div>
  );
}
