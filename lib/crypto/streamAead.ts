import { getSodium } from "./sodium";

// secretstream xchacha20poly1305 — chunked AEAD for files/video.
// Stream layout: header(24) || [chunk_len(4 BE) || chunk_ct]*
// Chunks are framed because Web streams may split arbitrarily.

export const HEADER_LEN = 24;
export const DEFAULT_CHUNK = 64 * 1024;

const TAG_MESSAGE = 0;
const TAG_FINAL = 3;

function u32be(n: number): Uint8Array {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setUint32(0, n, false);
  return b;
}
function readU32be(b: Uint8Array, off: number): number {
  return new DataView(b.buffer, b.byteOffset, b.byteLength).getUint32(off, false);
}

export async function encryptStream(
  key: Uint8Array,
  source: ReadableStream<Uint8Array>,
  chunkSize = DEFAULT_CHUNK,
): Promise<ReadableStream<Uint8Array>> {
  const s = await getSodium();
  const init = s.crypto_secretstream_xchacha20poly1305_init_push(key);
  const reader = source.getReader();

  let buffer = new Uint8Array(0);
  let done = false;
  let headerSent = false;

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (!headerSent) {
        controller.enqueue(init.header);
        headerSent = true;
      }

      while (buffer.length < chunkSize && !done) {
        const r = await reader.read();
        if (r.done) { done = true; break; }
        const next = new Uint8Array(buffer.length + r.value.length);
        next.set(buffer, 0);
        next.set(r.value, buffer.length);
        buffer = next;
      }

      if (buffer.length === 0 && done) {
        const tail = s.crypto_secretstream_xchacha20poly1305_push(
          init.state, new Uint8Array(0), null, TAG_FINAL);
        controller.enqueue(u32be(tail.length));
        controller.enqueue(tail);
        controller.close();
        return;
      }

      const take = Math.min(chunkSize, buffer.length);
      const chunk = buffer.slice(0, take);
      buffer = buffer.slice(take);

      const isFinal = done && buffer.length === 0;
      const ct = s.crypto_secretstream_xchacha20poly1305_push(
        init.state, chunk, null, isFinal ? TAG_FINAL : TAG_MESSAGE);
      controller.enqueue(u32be(ct.length));
      controller.enqueue(ct);
      if (isFinal) controller.close();
    },
  });
}

export async function decryptStream(
  key: Uint8Array,
  source: ReadableStream<Uint8Array>,
): Promise<ReadableStream<Uint8Array>> {
  const s = await getSodium();
  const reader = source.getReader();

  let buffer = new Uint8Array(0);
  let done = false;
  let state: ReturnType<typeof s.crypto_secretstream_xchacha20poly1305_init_pull> | null = null;
  let finalSeen = false;

  async function fill(min: number): Promise<boolean> {
    while (buffer.length < min && !done) {
      const r = await reader.read();
      if (r.done) { done = true; break; }
      const next = new Uint8Array(buffer.length + r.value.length);
      next.set(buffer, 0);
      next.set(r.value, buffer.length);
      buffer = next;
    }
    return buffer.length >= min;
  }

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (!state) {
        if (!(await fill(HEADER_LEN))) {
          controller.error(new Error("stream too short for header"));
          return;
        }
        const header = buffer.slice(0, HEADER_LEN);
        buffer = buffer.slice(HEADER_LEN);
        state = s.crypto_secretstream_xchacha20poly1305_init_pull(header, key);
      }

      if (finalSeen) { controller.close(); return; }

      if (!(await fill(4))) {
        controller.error(new Error("missing chunk length"));
        return;
      }
      const len = readU32be(buffer, 0);
      buffer = buffer.slice(4);

      if (!(await fill(len))) {
        controller.error(new Error("truncated chunk"));
        return;
      }
      const ct = buffer.slice(0, len);
      buffer = buffer.slice(len);

      const out = s.crypto_secretstream_xchacha20poly1305_pull(state, ct, null);
      if (!out) { controller.error(new Error("decrypt failed")); return; }
      if (out.message.length > 0) controller.enqueue(out.message);
      if (out.tag === TAG_FINAL) {
        finalSeen = true;
        controller.close();
      }
    },
  });
}
