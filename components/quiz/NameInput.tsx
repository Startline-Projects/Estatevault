"use client";

import { useEffect, useState } from "react";

interface NameInputProps {
  value: string;
  onChange: (val: string) => void;
  optional?: boolean;
  onPartialChange?: (partial: boolean) => void;
}

function split(value: string): { first: string; last: string } {
  const parts = value.trim().split(/\s+/);
  if (value.trim() === "") return { first: "", last: "" };
  const [first, ...rest] = parts;
  return { first: first ?? "", last: rest.join(" ") };
}

export default function NameInput({ value, onChange, optional, onPartialChange }: NameInputProps) {
  const initial = split(value);
  const [first, setFirst] = useState(initial.first);
  const [last, setLast] = useState(initial.last);

  useEffect(() => {
    const fT = first.trim();
    const lT = last.trim();
    const ownEmit = fT && lT ? `${fT} ${lT}` : "";
    if (value === ownEmit) return;
    const ext = split(value);
    setFirst(ext.first);
    setLast(ext.last);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function emit(f: string, l: string) {
    const fT = f.trim();
    const lT = l.trim();
    onChange(fT && lT ? `${fT} ${lT}` : "");
  }

  const fT = first.trim();
  const lT = last.trim();
  const partial = !!((fT && !lT) || (!fT && lT));

  useEffect(() => {
    onPartialChange?.(partial);
    return () => onPartialChange?.(false);
  }, [partial, onPartialChange]);

  const baseCls =
    "min-h-[44px] w-full rounded-xl border-2 bg-white px-4 py-3 text-sm text-charcoal placeholder:text-gray-400 focus:outline-none focus:ring-1 transition-colors";
  const firstCls = `${baseCls} ${!fT && lT ? "border-red-400 focus:border-red-500 focus:ring-red-300" : "border-gray-200 focus:border-gold focus:ring-gold/30"}`;
  const lastCls = `${baseCls} ${fT && !lT ? "border-red-400 focus:border-red-500 focus:ring-red-300" : "border-gray-200 focus:border-gold focus:ring-gold/30"}`;

  return (
    <div>
      <div className="grid grid-cols-2 gap-3">
        <input
          type="text"
          value={first}
          onChange={(e) => {
            setFirst(e.target.value);
            emit(e.target.value, last);
          }}
          placeholder={optional ? "First name (optional)" : "First name"}
          className={firstCls}
        />
        <input
          type="text"
          value={last}
          onChange={(e) => {
            setLast(e.target.value);
            emit(first, e.target.value);
          }}
          placeholder={optional ? "Last name (optional)" : "Last name"}
          className={lastCls}
        />
      </div>
      {partial && (
        <p className="mt-1.5 text-xs text-red-500">Enter both first and last name.</p>
      )}
    </div>
  );
}
