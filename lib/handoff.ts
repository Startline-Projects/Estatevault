import crypto from "crypto";

const ALGO = "aes-256-gcm";
const TTL_MS = 30_000;

function getKey(): Buffer {
  const secret = process.env.HANDOFF_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("HANDOFF_SECRET missing or too short (need >=32 chars)");
  }
  return crypto.createHash("sha256").update(secret).digest();
}

export type HandoffPayload = {
  access_token: string;
  refresh_token: string;
  redirect_path: string;
  exp: number;
};

export function encryptHandoff(p: Omit<HandoffPayload, "exp">): string {
  const payload: HandoffPayload = { ...p, exp: Date.now() + TTL_MS };
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  const data = Buffer.concat([
    cipher.update(JSON.stringify(payload), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, data]).toString("base64url");
}

export function decryptHandoff(token: string): HandoffPayload {
  const buf = Buffer.from(token, "base64url");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const decipher = crypto.createDecipheriv(ALGO, getKey(), iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(data), decipher.final()]);
  const payload = JSON.parse(plain.toString("utf8")) as HandoffPayload;
  if (Date.now() > payload.exp) {
    throw new Error("Handoff token expired");
  }
  return payload;
}
