"use client";

interface ChoiceTileProps {
  label: string;
  selected: boolean;
  onClick: () => void;
}

export default function ChoiceTile({ label, selected, onClick }: ChoiceTileProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-[44px] w-full rounded-xl border-2 px-5 py-3.5 text-sm font-medium transition-all
        ${
          selected
            ? "border-gold bg-gold/10 text-navy shadow-sm"
            : "border-gray-200 bg-white text-charcoal hover:border-gold/40"
        }`}
    >
      {label}
    </button>
  );
}
