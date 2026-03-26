"use client";

interface YesNoTilesProps {
  value: string;
  onChange: (val: string) => void;
}

export default function YesNoTiles({ value, onChange }: YesNoTilesProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {["Yes", "No"].map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={`min-h-[44px] rounded-xl border-2 px-5 py-3.5 text-sm font-medium transition-all
            ${
              value === opt
                ? "border-gold bg-gold/10 text-navy shadow-sm"
                : "border-gray-200 bg-white text-charcoal hover:border-gold/40"
            }`}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}
