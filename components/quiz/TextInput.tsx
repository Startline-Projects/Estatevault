"use client";

interface TextInputProps {
  value: string;
  onChange: (val: string) => void;
  placeholder: string;
}

export default function TextInput({ value, onChange, placeholder }: TextInputProps) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="min-h-[44px] w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-3 text-sm text-charcoal placeholder:text-gray-400 focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold/30 transition-colors"
    />
  );
}
