"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MICHIGAN_CITIES } from "@/lib/data/michigan-cities";

interface CityAutocompleteProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  maxSuggestions?: number;
}

const CITY_SET = new Set(MICHIGAN_CITIES.map((c) => c.toLowerCase()));

function findCanonical(input: string): string | null {
  const lc = input.trim().toLowerCase();
  if (!lc) return null;
  for (const city of MICHIGAN_CITIES) {
    if (city.toLowerCase() === lc) return city;
  }
  return null;
}

export default function CityAutocomplete({
  value,
  onChange,
  placeholder = "e.g. Grand Rapids",
  maxSuggestions = 8,
}: CityAutocompleteProps) {
  const [draft, setDraft] = useState(value);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const query = draft.trim().toLowerCase();
  const suggestions = useMemo(() => {
    if (!query) return [];
    const starts: string[] = [];
    const contains: string[] = [];
    for (const city of MICHIGAN_CITIES) {
      const lc = city.toLowerCase();
      if (lc.startsWith(query)) starts.push(city);
      else if (lc.includes(query)) contains.push(city);
      if (starts.length >= maxSuggestions) break;
    }
    return [...starts, ...contains].slice(0, maxSuggestions);
  }, [query, maxSuggestions]);

  useEffect(() => {
    setHighlight(0);
  }, [query]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        commitOrRevert();
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, value]);

  function commitOrRevert() {
    const canonical = findCanonical(draft);
    if (canonical) {
      if (canonical !== value) onChange(canonical);
      setDraft(canonical);
    } else {
      setDraft(value);
      if (value !== "" && !CITY_SET.has(value.toLowerCase())) onChange("");
    }
  }

  function pick(city: string) {
    setDraft(city);
    onChange(city);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      if (open && suggestions.length > 0) {
        e.preventDefault();
        pick(suggestions[highlight]);
      }
      return;
    }
    if (!open || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => (h + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => (h - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={wrapRef} className="relative">
      <input
        type="text"
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          setOpen(true);
          if (value !== "") onChange("");
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          // Defer to allow click on suggestion
          setTimeout(commitOrRevert, 120);
        }}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        className="min-h-[44px] w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-3 text-sm text-charcoal placeholder:text-gray-400 focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold/30 transition-colors"
      />
      {open && suggestions.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-gray-200 bg-white py-1 shadow-lg">
          {suggestions.map((city, i) => (
            <li key={city}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(city);
                }}
                onMouseEnter={() => setHighlight(i)}
                className={`w-full px-4 py-2 text-left text-sm transition-colors ${
                  i === highlight ? "bg-gold/10 text-navy" : "text-charcoal hover:bg-gray-50"
                }`}
              >
                {city}
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && query.length > 0 && suggestions.length === 0 && !CITY_SET.has(query) && (
        <div className="absolute z-20 mt-1 w-full rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs text-charcoal/60 shadow-lg">
          No matching Michigan city. Pick from the list.
        </div>
      )}
    </div>
  );
}
