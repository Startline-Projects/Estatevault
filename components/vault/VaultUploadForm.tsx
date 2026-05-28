"use client";

import { useState } from "react";
import { DOC_TYPE_OPTIONS } from "./vault-constants";

interface VaultUploadFormProps {
  uploadFile: File | null;
  uploadLabel: string;
  uploadDocType: string;
  uploading: boolean;
  uploadError: string;
  onFileChange: (file: File | null) => void;
  onLabelChange: (value: string) => void;
  onDocTypeChange: (value: string) => void;
  onUpload: () => void;
  onBack: () => void;
  onUploadErrorChange: (error: string) => void;
}

export default function VaultUploadForm({
  uploadFile,
  uploadLabel,
  uploadDocType,
  uploading,
  uploadError,
  onFileChange,
  onLabelChange,
  onDocTypeChange,
  onUpload,
  onBack,
  onUploadErrorChange,
}: VaultUploadFormProps) {
  const [labelTouched, setLabelTouched] = useState(false);
  const labelEmpty = labelTouched && !uploadLabel.trim();
  const labelErrorId = "upload-label-error";

  function validateFile(f: File): boolean {
    if (f.type !== "application/pdf") {
      onUploadErrorChange("Only PDF files are allowed.");
      return false;
    }
    if (f.size > 20 * 1024 * 1024) {
      onUploadErrorChange("File must be under 20MB.");
      return false;
    }
    onUploadErrorChange("");
    return true;
  }

  function handleSubmit() {
    if (!uploadLabel.trim()) {
      setLabelTouched(true);
      return;
    }
    onUpload();
  }

  return (
    <div className="max-w-lg">
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-sm text-navy/60 hover:text-navy mb-4"
      >
        &larr; Back
      </button>
      <h1 className="text-xl font-bold text-navy">Upload Signed Document</h1>
      <p className="mt-1 text-sm text-charcoal/60">
        Upload a PDF of your signed and executed estate document. Max 20MB.
      </p>

      <div className="mt-6 space-y-5">
        {/* Label */}
        <div>
          <label className="block text-sm font-medium text-navy mb-1.5">
            Document Label <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={uploadLabel}
            onChange={(e) => onLabelChange(e.target.value)}
            onBlur={() => setLabelTouched(true)}
            placeholder="e.g. Signed Will, April 2026"
            aria-invalid={labelEmpty}
            aria-describedby={labelEmpty ? labelErrorId : undefined}
            className={`w-full min-h-[44px] rounded-xl border-2 px-4 py-3 text-sm focus:border-gold focus:outline-none ${labelEmpty ? "border-red-400" : "border-gray-200"}`}
          />
          {labelEmpty && (
            <p id={labelErrorId} className="mt-1 text-xs text-red-600" role="alert">
              Document label is required.
            </p>
          )}
        </div>

        {/* Document type */}
        <div>
          <label className="block text-sm font-medium text-navy mb-1.5">Document Type</label>
          <div className="flex flex-wrap gap-2">
            {DOC_TYPE_OPTIONS.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => onDocTypeChange(opt)}
                className={`rounded-lg border-2 px-4 py-2 text-sm transition-colors ${
                  uploadDocType === opt
                    ? "border-gold bg-gold/10 text-navy font-medium"
                    : "border-gray-200 text-charcoal/70 hover:border-gold/40"
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        {/* File upload */}
        <div>
          <label className="block text-sm font-medium text-navy mb-1.5">
            PDF File <span className="text-red-500">*</span>
          </label>
          <label
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const f = e.dataTransfer.files?.[0];
              if (!f) return;
              if (validateFile(f)) onFileChange(f);
            }}
            className={`flex flex-col items-center justify-center w-full h-36 rounded-xl border-2 border-dashed cursor-pointer transition-colors ${
              uploadFile
                ? "border-gold bg-gold/5"
                : "border-gray-200 hover:border-gold/50 bg-gray-50"
            }`}
          >
            <input
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                if (validateFile(f)) onFileChange(f);
              }}
            />
            {uploadFile ? (
              <div className="text-center px-4">
                <svg
                  className="w-8 h-8 text-gold mx-auto mb-2"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                  />
                </svg>
                <p className="text-sm font-medium text-navy truncate max-w-[240px]">
                  {uploadFile.name}
                </p>
                <p className="text-xs text-charcoal/50 mt-0.5">
                  {(uploadFile.size / 1024).toFixed(0)} KB, tap to change
                </p>
              </div>
            ) : (
              <div className="text-center px-4">
                <svg
                  className="w-8 h-8 text-charcoal/30 mx-auto mb-2"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                  />
                </svg>
                <p className="text-sm text-charcoal/50">Click to select or drag &amp; drop a PDF</p>
                <p className="text-xs text-charcoal/30 mt-0.5">PDF only · Max 20MB</p>
              </div>
            )}
          </label>
        </div>

        {uploadError && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700" role="alert">
            {uploadError}
          </div>
        )}
      </div>

      <button
        onClick={handleSubmit}
        disabled={uploading || !uploadFile || !uploadLabel.trim()}
        className="mt-6 w-full min-h-[44px] rounded-full bg-gold py-3 text-sm font-semibold text-white hover:bg-gold/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {uploading ? (
          <span className="inline-flex items-center gap-2 justify-center">
            <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            Uploading...
          </span>
        ) : (
          "Upload Document"
        )}
      </button>
    </div>
  );
}
