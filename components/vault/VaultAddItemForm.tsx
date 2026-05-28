"use client";

import { useState, useCallback } from "react";
import type { CategoryField } from "./vault-constants";

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

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

  // Validation helpers
  const labelEmpty = touched["label"] && !addForm.label?.trim();
  const isContactCategory = selectedCategory === "contact";

  function getEmailError(): string | null {
    const emailValue = addForm.email?.trim();
    if (!emailValue) return null;
    if (!EMAIL_REGEX.test(emailValue)) return "Please enter a valid email address.";
    return null;
  }

  const emailError = isContactCategory && touched["email"] ? getEmailError() : null;

  function handleSave() {
    // Mark label as touched so validation error shows
    if (!addForm.label?.trim()) {
      setTouched((prev) => ({ ...prev, label: true }));
      return;
    }
    // Check email if contact category
    if (isContactCategory && addForm.email?.trim() && !EMAIL_REGEX.test(addForm.email.trim())) {
      setTouched((prev) => ({ ...prev, email: true }));
      return;
    }
    onSave();
  }

  const labelErrorId = "add-item-label-error";
  const emailErrorId = "add-item-email-error";

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
          const isLabel = field.name === "label";
          const isEmailField = field.name === "email" && isContactCategory;
          const hasLabelError = isLabel && labelEmpty;
          const hasEmailError = isEmailField && emailError;

          return (
            <div key={field.name}>
              <label className="block text-sm font-medium text-navy mb-1">
                {field.label}
                {isLabel && <span className="text-red-500 ml-0.5">*</span>}
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
                    aria-invalid={!!hasLabelError || !!hasEmailError}
                    aria-describedby={
                      hasLabelError
                        ? labelErrorId
                        : hasEmailError
                        ? emailErrorId
                        : undefined
                    }
                    className={`w-full min-h-[44px] rounded-xl border-2 px-4 py-3 text-sm focus:border-gold focus:outline-none ${
                      hasLabelError || hasEmailError ? "border-red-400" : "border-gray-200"
                    }`}
                  />
                  {hasLabelError && (
                    <p id={labelErrorId} className="mt-1 text-xs text-red-600" role="alert">
                      Label is required.
                    </p>
                  )}
                  {hasEmailError && (
                    <p id={emailErrorId} className="mt-1 text-xs text-red-600" role="alert">
                      {emailError}
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
