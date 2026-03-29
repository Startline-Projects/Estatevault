"use client";

import { useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

interface FarewellUploaderProps {
  messageId: string;
  onComplete: () => void;
  onCancel: () => void;
}

export default function FarewellUploader({ messageId, onComplete, onCancel }: FarewellUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");

  const MAX_SIZE = 500 * 1024 * 1024; // 500MB
  const VALID_TYPES = ["video/mp4", "video/quicktime", "video/webm"];

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");

    if (!VALID_TYPES.includes(file.type)) {
      setError("Please select an MP4, MOV, or WebM file.");
      return;
    }
    if (file.size > MAX_SIZE) {
      setError("File must be under 500MB.");
      return;
    }
    setSelectedFile(file);
  }

  async function handleUpload() {
    if (!selectedFile) return;
    setUploading(true);
    setError("");

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: client } = await supabase.from("clients").select("id").eq("profile_id", user.id).single();
      if (!client) throw new Error("No client record");

      const ext = selectedFile.name.split(".").pop() || "mp4";
      const filePath = `${client.id}/${messageId}/upload.${ext}`;

      setProgress(20);

      const { error: uploadErr } = await supabase.storage
        .from("farewell-videos")
        .upload(filePath, selectedFile, { contentType: selectedFile.type, upsert: true });

      if (uploadErr) throw new Error("Upload failed");

      setProgress(80);

      // Get video duration via HTML5 video element
      let duration = 0;
      try {
        const url = URL.createObjectURL(selectedFile);
        const video = document.createElement("video");
        video.preload = "metadata";
        await new Promise<void>((resolve) => {
          video.onloadedmetadata = () => { duration = Math.round(video.duration); resolve(); };
          video.onerror = () => resolve();
          video.src = url;
        });
        URL.revokeObjectURL(url);
      } catch { /* ignore duration detection failure */ }

      if (duration > 1800) {
        setError("Video exceeds 30-minute limit.");
        setUploading(false);
        return;
      }

      const res = await fetch("/api/vault/farewell/upload-complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messageId,
          storagePath: filePath,
          fileSize: selectedFile.size,
          duration,
        }),
      });

      if (!res.ok) throw new Error("Failed to finalize upload");

      setProgress(100);
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setUploading(false);
    }
  }

  function formatSize(bytes: number): string {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
    <div className="space-y-4">
      {/* Disclaimer */}
      <div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
        <p className="text-xs text-amber-800 leading-relaxed">
          Farewell Messages are personal video messages only. They are not legal documents and do not modify, supersede, or replace any estate planning documents in your vault. Any changes to your estate plan must be made through a formal document amendment.
        </p>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".mp4,.mov,.webm,video/mp4,video/quicktime,video/webm"
        onChange={handleFileSelect}
        className="hidden"
      />

      {!selectedFile ? (
        <div
          onClick={() => fileInputRef.current?.click()}
          className="rounded-xl border-2 border-dashed border-gray-300 p-12 text-center cursor-pointer hover:border-[#C9A84C]/50 transition-colors"
        >
          <div className="mx-auto w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
            <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
          </div>
          <p className="text-sm font-medium text-[#2D2D2D]">Click to select a video file</p>
          <p className="text-xs text-gray-400 mt-1">MP4, MOV, WebM — max 500MB, 30 minutes</p>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[#2D2D2D]">{selectedFile.name}</p>
              <p className="text-xs text-gray-400 mt-0.5">{formatSize(selectedFile.size)}</p>
            </div>
            {!uploading && (
              <button onClick={() => setSelectedFile(null)} className="text-xs text-red-600 hover:text-red-700">
                Remove
              </button>
            )}
          </div>

          {uploading && (
            <div className="mt-3">
              <div className="w-full h-2 rounded-full bg-gray-100 overflow-hidden">
                <div className="h-full bg-[#C9A84C] rounded-full transition-all" style={{ width: `${progress}%` }} />
              </div>
              <p className="text-xs text-gray-400 mt-1">{progress}% uploaded</p>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-end gap-3">
        <button onClick={onCancel} disabled={uploading} className="px-4 py-2.5 rounded-lg border border-gray-300 text-sm font-medium text-[#2D2D2D] hover:bg-gray-50 transition-colors disabled:opacity-50">
          Cancel
        </button>
        {selectedFile && (
          <button onClick={handleUpload} disabled={uploading} className="px-6 py-2.5 rounded-lg bg-[#1C3557] text-sm font-semibold text-white hover:bg-[#1C3557]/90 transition-colors disabled:opacity-50">
            {uploading ? "Uploading..." : "Upload Video"}
          </button>
        )}
      </div>
    </div>
  );
}
