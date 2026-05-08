"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

interface FarewellRecorderProps {
  title: string;
  recipientEmail: string;
  onComplete: () => void;
  onCancel: () => void;
}

export default function FarewellRecorder({ title, recipientEmail, onComplete, onCancel }: FarewellRecorderProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const [status, setStatus] = useState<"idle" | "previewing" | "recording" | "review" | "uploading">("idle");
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [error, setError] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const MAX_DURATION = 1800; // 30 minutes

  const startCamera = useCallback(async () => {
    try {
      if (typeof window === "undefined" || !window.isSecureContext) {
        setError("Camera requires a secure context (HTTPS or localhost). Current page is not secure.");
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("Your browser does not support camera recording. Try Chrome, Edge, Safari, or Firefox.");
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true;
        try {
          await videoRef.current.play();
        } catch { /* autoplay block ignored — user can press play */ }
      }
      setStatus("previewing");
      setError("");
    } catch (err) {
      const e = err as DOMException;
      const name = e?.name || "";
      console.error("[FarewellRecorder] getUserMedia failed:", name, e?.message, e);
      if (name === "NotAllowedError" || name === "SecurityError") {
        setError(
          "Camera/microphone blocked. Site permission may be allowed but OS or another app blocking it. Check: (1) macOS → System Settings → Privacy & Security → Camera + Microphone → enable your browser. (2) Quit Zoom/Meet/Teams/FaceTime. (3) Browser site settings → reset camera/mic for localhost → reload. Open DevTools console for exact error name."
        );
      } else if (name === "NotFoundError" || name === "OverconstrainedError") {
        setError("No camera or microphone found on this device.");
      } else if (name === "NotReadableError" || name === "AbortError") {
        setError("Camera/microphone is in use by another app. Close other apps (Zoom, Meet, etc.) and try again.");
      } else {
        setError(`Unable to access camera/microphone: ${e?.message || name || "unknown error"}`);
      }
    }
  }, []);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  function startRecording() {
    if (!streamRef.current) return;
    chunksRef.current = [];
    setElapsedSeconds(0);

    // Detect supported MIME type
    const mimeTypes = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "video/mp4"];
    const mimeType = mimeTypes.find((t) => MediaRecorder.isTypeSupported(t)) || "video/webm";

    const recorder = new MediaRecorder(streamRef.current, { mimeType });
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType });
      setRecordedBlob(blob);
      setStatus("review");
      // Stop camera
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };

    recorder.start(1000); // collect data every second
    setStatus("recording");

    // Timer
    timerRef.current = setInterval(() => {
      setElapsedSeconds((prev) => {
        if (prev + 1 >= MAX_DURATION) {
          recorder.stop();
          if (timerRef.current) clearInterval(timerRef.current);
          return MAX_DURATION;
        }
        return prev + 1;
      });
    }, 1000);
  }

  function stopRecording() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) clearInterval(timerRef.current);
  }

  async function uploadRecording() {
    if (!recordedBlob) return;
    setStatus("uploading");
    setError("");

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: client } = await supabase.from("clients").select("id").eq("profile_id", user.id).single();
      if (!client) throw new Error("No client record");

      // Create message row now (deferred until video is ready)
      const createRes = await fetch("/api/vault/farewell", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, recipientEmail }),
      });
      const createData = await createRes.json();
      if (!createRes.ok) throw new Error(createData.error || "Failed to create message");
      const messageId = createData.messageId as string;

      const ext = recordedBlob.type.includes("mp4") ? "mp4" : "webm";
      const filePath = `${client.id}/${messageId}/recording.${ext}`;

      setUploadProgress(10);

      const { error: uploadErr } = await supabase.storage
        .from("farewell-videos")
        .upload(filePath, recordedBlob, { contentType: recordedBlob.type, upsert: true });

      if (uploadErr) throw new Error("Upload failed");

      setUploadProgress(80);

      // Notify server upload is complete
      const res = await fetch("/api/vault/farewell/upload-complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messageId,
          storagePath: filePath,
          fileSize: recordedBlob.size,
          duration: elapsedSeconds,
        }),
      });

      if (!res.ok) throw new Error("Failed to finalize upload");

      setUploadProgress(100);
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setStatus("review");
    }
  }

  function formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
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
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Video display */}
      <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
        {status === "review" && recordedBlob ? (
          <video
            src={URL.createObjectURL(recordedBlob)}
            controls
            className="w-full h-full object-contain"
          />
        ) : (
          <video
            ref={videoRef}
            className="w-full h-full object-contain"
            playsInline
          />
        )}

        {/* Recording indicator */}
        {status === "recording" && (
          <div className="absolute top-4 left-4 flex items-center gap-2 bg-black/60 rounded-full px-3 py-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
            <span className="text-white text-sm font-mono">{formatTime(elapsedSeconds)} / {formatTime(MAX_DURATION)}</span>
          </div>
        )}

        {/* Idle state */}
        {status === "idle" && (
          <div className="absolute inset-0 flex items-center justify-center">
            <button
              onClick={startCamera}
              className="px-6 py-3 rounded-full bg-gold text-white font-semibold hover:bg-gold-600 transition-colors"
            >
              Start Camera
            </button>
          </div>
        )}

        {/* Upload progress */}
        {status === "uploading" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70">
            <div className="w-48 h-2 rounded-full bg-white/20 overflow-hidden">
              <div className="h-full bg-gold rounded-full transition-all" style={{ width: `${uploadProgress}%` }} />
            </div>
            <p className="text-white text-sm mt-3">Uploading... {uploadProgress}%</p>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-3">
        {status === "previewing" && (
          <>
            <button onClick={onCancel} className="px-4 py-2.5 rounded-lg border border-gray-300 text-sm font-medium text-charcoal hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button onClick={startRecording} className="px-6 py-2.5 rounded-lg bg-red-600 text-sm font-semibold text-white hover:bg-red-700 transition-colors">
              Start Recording
            </button>
          </>
        )}
        {status === "recording" && (
          <button onClick={stopRecording} className="px-6 py-2.5 rounded-lg bg-red-600 text-sm font-semibold text-white hover:bg-red-700 transition-colors flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm bg-white" />
            Stop Recording
          </button>
        )}
        {status === "review" && (
          <>
            <button onClick={onCancel} className="px-4 py-2.5 rounded-lg border border-gray-300 text-sm font-medium text-charcoal hover:bg-gray-50 transition-colors">
              Discard
            </button>
            <button onClick={async () => { setRecordedBlob(null); setStatus("idle"); await startCamera(); }} className="px-4 py-2.5 rounded-lg border border-gray-300 text-sm font-medium text-charcoal hover:bg-gray-50 transition-colors">
              Re-record
            </button>
            <button onClick={uploadRecording} className="px-6 py-2.5 rounded-lg bg-navy text-sm font-semibold text-white hover:bg-navy/90 transition-colors">
              Save & Upload
            </button>
          </>
        )}
      </div>
    </div>
  );
}
