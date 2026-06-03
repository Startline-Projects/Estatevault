"use client";

import { useState, useCallback } from "react";
import type { CategoryField } from "./vault-constants";
import { validateField } from "@/lib/validation/vaultFieldRules";

interface VaultAddItemFormProps {
  selectedCategory: string;
  addForm: Record<string, string>;
  saving: boolean;
  onFormChange: (updater: (prev: Record<string, string>) => Record<string, string>) => void;
  onSave: () => void;
  onBack: () => void;
  categories: ReadonlyArray<{ key: string; icon: string; label: string; vaultOnly: boolean }>;
  categoryFields: Record<string, CategoryField[]>;
}

export default function VaultAddItemForm({
  selectedCategory,
  addForm,
  saving,
  onFormChange,
  onSave,
  onBack,
  categories,
  categoryFields,
}: VaultAddItemFormProps) {
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const fields = categoryFields[selectedCategory] || [];
  const cat = categories.find((c) => c.key === selectedCategory);

  const markTouched = useCallback((fieldName: string) => {
    setTouched((prev) => ({ ...prev, [fieldName]: true }));
  }, []);

  // Per-field validation error (only shown once the field is touched).
  function fieldError(field: CategoryField): string | null {
    return validateField(field.rule, addForm[field.name], field.required);
  }

  function handleSave() {
    // Validate every field; if any fail, mark all touched so errors render and block save.
    const hasError = fields.some((f) => fieldError(f) !== null);
    if (hasError) {
      setTouched(Object.fromEntries(fields.map((f) => [f.name, true])));
      return;
    }
    onSave();
  }

  return (
    <div className="max-w-lg">
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-sm text-navy/60 hover:text-navy mb-4"
      >
        &larr; Back
      </button>
      <h1 className="text-xl font-bold text-navy">Add {cat?.label?.replace(/s$/, "")}</h1>
      <div className="mt-6 space-y-4">
        {fields.map((field) => {
          const error = touched[field.name] ? fieldError(field) : null;
          const errorId = `add-item-${field.name}-error`;

          return (
            <div key={field.name}>
              <label className="block text-sm font-medium text-navy mb-1">
                {field.label}
                {field.required && <span className="text-red-500 ml-0.5">*</span>}
              </label>
              {field.type === "choice" ? (
                <div className="flex flex-wrap gap-2">
                  {field.options?.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => onFormChange((p) => ({ ...p, [field.name]: opt }))}
                      className={`rounded-lg border-2 px-4 py-2 text-sm ${
                        addForm[field.name] === opt
                          ? "border-gold bg-gold/10 text-navy"
                          : "border-gray-200 text-charcoal/70 hover:border-gold/40"
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              ) : field.type === "textarea" ? (
                <textarea
                  value={addForm[field.name] || ""}
                  onChange={(e) => onFormChange((p) => ({ ...p, [field.name]: e.target.value }))}
                  onBlur={() => markTouched(field.name)}
                  rows={3}
                  className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-sm focus:border-gold focus:outline-none resize-none"
                />
              ) : (
                <>
                  <input
                    type={field.type === "password" ? "password" : "text"}
                    value={addForm[field.name] || ""}
                    onChange={(e) =>
                      onFormChange((p) => ({ ...p, [field.name]: e.target.value }))
                    }
                    onBlur={() => markTouched(field.name)}
                    aria-invalid={!!error}
                    aria-describedby={error ? errorId : undefined}
                    className={`w-full min-h-[44px] rounded-xl border-2 px-4 py-3 text-sm focus:border-gold focus:outline-none ${
                      error ? "border-red-400" : "border-gray-200"
                    }`}
                  />
                  {error && (
                    <p id={errorId} className="mt-1 text-xs text-red-600" role="alert">
                      {error}
                    </p>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
      <button
        onClick={handleSave}
        disabled={saving || !addForm.label?.trim()}
        className="mt-6 w-full min-h-[44px] rounded-full bg-gold py-3 text-sm font-semibold text-white hover:bg-gold/90 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {saving ? "Saving..." : "Save Item"}
      </button>
    </div>
  );
}
