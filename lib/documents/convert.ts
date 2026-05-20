/*
 * DOCX -> PDF conversion.
 *
 * Provider selection (DOC_CONVERT_PROVIDER, else auto):
 *   - "cloudconvert" → CloudConvert REST API (works on Vercel). Needs CLOUDCONVERT_API_KEY.
 *   - "libreoffice"  → local `soffice` binary (dev only; not available on Vercel).
 *   - auto (default) → CloudConvert if CLOUDCONVERT_API_KEY is set, otherwise LibreOffice.
 *
 * High-fidelity conversion only — no pure-JS fallback (those mangle legal docs).
 */

import { spawn } from "child_process";
import { mkdtemp, writeFile, readFile, rm } from "fs/promises";
import os from "os";
import path from "path";

const CC_BASE = "https://api.cloudconvert.com/v2";

export async function docxToPdf(docx: Buffer): Promise<Buffer> {
  const provider = (process.env.DOC_CONVERT_PROVIDER || "").toLowerCase();
  const hasKey = !!process.env.CLOUDCONVERT_API_KEY;

  if (provider === "cloudconvert" || (provider !== "libreoffice" && hasKey)) {
    return cloudConvert(docx);
  }
  return libreOfficeConvert(docx);
}

// ── CloudConvert ──────────────────────────────────────────────────────────
async function cloudConvert(docx: Buffer): Promise<Buffer> {
  const key = process.env.CLOUDCONVERT_API_KEY;
  if (!key) throw new Error("CLOUDCONVERT_API_KEY not set");
  const auth = { Authorization: `Bearer ${key}` };

  // 1. Create a job: upload → convert → export url.
  const jobRes = await fetch(`${CC_BASE}/jobs`, {
    method: "POST",
    headers: { ...auth, "Content-Type": "application/json" },
    body: JSON.stringify({
      tasks: {
        "import-1": { operation: "import/upload" },
        "convert-1": {
          operation: "convert",
          input: "import-1",
          input_format: "docx",
          output_format: "pdf",
          engine: "libreoffice",
        },
        "export-1": { operation: "export/url", input: "convert-1" },
      },
    }),
  });
  if (!jobRes.ok) throw new Error(`CloudConvert job create failed: ${jobRes.status} ${await jobRes.text()}`);
  const job = await jobRes.json();
  const jobId: string = job.data.id;
  const importTask = job.data.tasks.find((t: { name: string }) => t.name === "import-1");
  const form = importTask?.result?.form;
  if (!form?.url) throw new Error("CloudConvert: no upload form returned");

  // 2. Upload the DOCX to the provided form (parameters first, file last).
  const fd = new FormData();
  for (const [k, v] of Object.entries(form.parameters as Record<string, string>)) fd.append(k, v);
  fd.append("file", new Blob([new Uint8Array(docx)]), "document.docx");
  const upRes = await fetch(form.url, { method: "POST", body: fd });
  if (!upRes.ok && upRes.status !== 201) throw new Error(`CloudConvert upload failed: ${upRes.status}`);

  // 3. Wait for the job to finish (long-poll).
  const waitRes = await fetch(`${CC_BASE}/jobs/${jobId}/wait`, { headers: auth });
  if (!waitRes.ok) throw new Error(`CloudConvert wait failed: ${waitRes.status}`);
  const done = await waitRes.json();
  if (done.data.status !== "finished") {
    throw new Error(`CloudConvert job not finished: ${done.data.status}`);
  }
  const exportTask = done.data.tasks.find((t: { name: string }) => t.name === "export-1");
  const fileUrl: string | undefined = exportTask?.result?.files?.[0]?.url;
  if (!fileUrl) throw new Error("CloudConvert: no output file url");

  // 4. Download the resulting PDF.
  const pdfRes = await fetch(fileUrl);
  if (!pdfRes.ok) throw new Error(`CloudConvert download failed: ${pdfRes.status}`);
  return Buffer.from(await pdfRes.arrayBuffer());
}

// ── LibreOffice (local dev) ───────────────────────────────────────────────
async function libreOfficeConvert(docx: Buffer): Promise<Buffer> {
  const bin = await resolveSoffice();
  if (!bin) {
    throw new Error(
      "No DOCX->PDF converter configured. Set CLOUDCONVERT_API_KEY, or install LibreOffice (brew install --cask libreoffice).",
    );
  }
  const dir = await mkdtemp(path.join(os.tmpdir(), "ev-convert-"));
  const inPath = path.join(dir, "in.docx");
  const outPath = path.join(dir, "in.pdf");
  try {
    await writeFile(inPath, docx);
    await new Promise<void>((resolve, reject) => {
      const p = spawn(bin, ["--headless", "--convert-to", "pdf", "--outdir", dir, inPath], { stdio: "ignore" });
      p.on("error", reject);
      p.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`soffice exited ${code}`))));
    });
    return await readFile(outPath);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

async function resolveSoffice(): Promise<string | null> {
  const candidates = [
    process.env.SOFFICE_PATH,
    "soffice",
    "/Applications/LibreOffice.app/Contents/MacOS/soffice",
    "/usr/bin/soffice",
    "/usr/local/bin/soffice",
  ].filter(Boolean) as string[];
  for (const c of candidates) {
    const ok = await new Promise<boolean>((resolve) => {
      const p = spawn(c, ["--version"], { stdio: "ignore" });
      p.on("error", () => resolve(false));
      p.on("exit", (code) => resolve(code === 0));
    });
    if (ok) return c;
  }
  return null;
}
