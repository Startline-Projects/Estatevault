"use client";

import { useEffect, useMemo, useState } from "react";

interface DateOfBirthInputProps {
  value: string;
  onChange: (val: string) => void;
  maxDate?: string;
  minYearsAgo?: number;
  maxYearsAgo?: number;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function daysInMonth(year: number, month: number): number {
  if (!year || !month) return 31;
  return new Date(year, month, 0).getDate();
}

function pad(n: number | string): string {
  const s = String(n);
  return s.length < 2 ? `0${s}` : s;
}

function parse(value: string): { y: number; m: number; d: number } {
  if (!value) return { y: 0, m: 0, d: 0 };
  const [yStr = "", mStr = "", dStr = ""] = value.split("-");
  return { y: Number(yStr) || 0, m: Number(mStr) || 0, d: Number(dStr) || 0 };
}

export default function DateOfBirthInput({
  value,
  onChange,
  maxDate,
  minYearsAgo = 0,
  maxYearsAgo = 120,
}: DateOfBirthInputProps) {
  const initial = parse(value);
  const [year, setYear] = useState(initial.y);
  const [month, setMonth] = useState(initial.m);
  const [day, setDay] = useState(initial.d);

  useEffect(() => {
    const p = parse(value);
    if (p.y !== year || p.m !== month || p.d !== day) {
      if (value) {
        setYear(p.y);
        setMonth(p.m);
        setDay(p.d);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const currentYear = new Date().getFullYear();
  const maxYear = currentYear - minYearsAgo;
  const minYear = currentYear - maxYearsAgo;

  const years = useMemo(() => {
    const arr: number[] = [];
    for (let y = maxYear; y >= minYear; y--) arr.push(y);
    return arr;
  }, [maxYear, minYear]);

  const days = useMemo(() => {
    const total = daysInMonth(year, month);
    return Array.from({ length: total }, (_, i) => i + 1);
  }, [year, month]);

  function emit(nextYear: number, nextMonth: number, nextDay: number) {
    setYear(nextYear);
    setMonth(nextMonth);
    let safeDay = nextDay;
    if (nextYear && nextMonth) {
      const maxDay = daysInMonth(nextYear, nextMonth);
      if (safeDay > maxDay) safeDay = maxDay;
    }
    setDay(safeDay);
    if (nextYear && nextMonth && safeDay) {
      onChange(`${nextYear}-${pad(nextMonth)}-${pad(safeDay)}`);
    } else {
      onChange("");
    }
  }

  const selectClass =
    "appearance-none min-h-[44px] w-full rounded-xl border-2 border-gray-200 bg-white pl-3 pr-9 py-3 text-sm text-charcoal focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold/30 transition-colors";

  function Chevron() {
    return (
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 h-3 w-3 text-charcoal"
        viewBox="0 0 12 12"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="3 5 6 8 9 5" />
      </svg>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-2">
      <div className="relative">
        <select
          aria-label="Month"
          value={month || ""}
          onChange={(e) => emit(year, Number(e.target.value), day)}
          className={selectClass}
        >
          <option value="">Month</option>
          {MONTHS.map((name, idx) => (
            <option key={name} value={idx + 1}>
              {name}
            </option>
          ))}
        </select>
        <Chevron />
      </div>
      <div className="relative">
        <select
          aria-label="Day"
          value={day || ""}
          onChange={(e) => emit(year, month, Number(e.target.value))}
          className={selectClass}
        >
          <option value="">Day</option>
          {days.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <Chevron />
      </div>
      <div className="relative">
        <select
          aria-label="Year"
          value={year || ""}
          onChange={(e) => emit(Number(e.target.value), month, day)}
          className={selectClass}
        >
          <option value="">Year</option>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        <Chevron />
      </div>
    </div>
  );
}
