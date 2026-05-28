"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { VaultItem, CategoryField } from "./vault-constants";

interface VaultItemDetailModalProps {
  item: VaultItem | null;
  categoryFields: Record<string, CategoryField[]>;
  onClose: () => void;
}

export default function VaultItemDetailModal({
  item,
  categoryFields,
  onClose,
}: VaultItemDetailModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [revealedFields, setRevealedFields] = useState<Record<string, boolean>>({});

  // Reset revealed fields when a new item is viewed
  useEffect(() => {
    if (item) {
      setRevealedFields({});
    }
  }, [item]);

  // Focus trap and Escape key handler
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }

      if (e.key === "Tab" && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    },
    [onClose]
  );

  // Attach keyboard listener and auto-focus on mount
  useEffect(() => {
    if (!item) return;

    document.addEventListener("keydown", handleKeyDown);
    // Focus the dialog container on open
    dialogRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [item, handleKeyDown]);

  if (!item) return null;

  const fields = categoryFields[item.category] || [];
  const data = item.data as Record<string, unknown>;
  const fieldMap = new Map(fields.map((f) => [f.name, f]));
  const extraKeys = Object.keys(data).filter((k) => !fieldMap.has(k) && k !== "label");
  const sensitive = new Set(["password", "access_instructions"]);

  const renderValue = (key: string, raw: unknown) => {
    const val = raw == null || raw === "" ? "—" : String(raw);
    if (sensitive.has(key) && val !== "—") {
      const shown = revealedFields[key];
      return (
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm text-charcoal break-all">
            {shown ? val : "•".repeat(Math.min(val.length, 12))}
          </span>
          <button
            type="button"
            onClick={() => setRevealedFields((p) => ({ ...p, [key]: !p[key] }))}
            className="text-xs text-navy/60 hover:text-navy underline"
          >
            {shown ? "Hide" : "Show"}
          </button>
        </div>
      );
    }
    return <span className="text-sm text-charcoal whitespace-pre-wrap break-words">{val}</span>;
  };

  const titleId = "vault-item-detail-title";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl max-h-[85vh] overflow-y-auto outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id={titleId} className="text-lg font-bold text-navy">
              {item.label}
            </h2>
            <p className="text-xs text-charcoal/50 mt-1">
              Added {new Date(item.created_at).toLocaleDateString()}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-charcoal/50 hover:text-charcoal text-2xl leading-none"
            aria-label="Close detail view"
          >
            &times;
          </button>
        </div>
        <div className="mt-5 space-y-4">
          {fields
            .filter((f) => f.name !== "label")
            .map((f) => (
              <div key={f.name}>
                <p className="text-xs font-medium text-charcoal/50 mb-1">{f.label}</p>
                {renderValue(f.name, data[f.name])}
              </div>
            ))}
          {extraKeys.map((k) => (
            <div key={k}>
              <p className="text-xs font-medium text-charcoal/50 mb-1">{k}</p>
              {renderValue(k, data[k])}
            </div>
          ))}
        </div>
        <button
          onClick={onClose}
          className="mt-6 w-full min-h-[44px] rounded-full bg-navy py-2.5 text-sm font-semibold text-white hover:bg-navy/90 transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
}
