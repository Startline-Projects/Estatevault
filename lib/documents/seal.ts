// Server-side sealed-box helper. Uses libsodium WASM (already installed for client).
// Hybrid E2EE: server reads quiz answers + template plaintext transiently, generates
// PDF, seals to recipient X25519 pub, uploads ciphertext. Plaintext is discarded.

import sodium from "libsodium-wrappers-sumo";

let ready: Promise<void> | null = null;
function getReady(): Promise<void> {
  if (!ready) ready = sodium.ready;
  return ready;
}

export async function sealForRecipient(plaintext: Uint8Array, recipientPubX25519: Uint8Array): Promise<Uint8Array> {
  await getReady();
  if (recipientPubX25519.length !== 32) throw new Error("bad recipient pubkey length");
  return sodium.crypto_box_seal(new Uint8Array(plaintext), new Uint8Array(recipientPubX25519));
}
