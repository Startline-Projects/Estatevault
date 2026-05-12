import { getSodium } from "./sodium";

// Anonymous sealed box — recipient pubkey only; sender ephemeral.
// Forward-secret w.r.t. sender (no long-term sender priv leaks past payloads).
export async function wrapForRecipient(
  dek: Uint8Array,
  recipientPubX25519: Uint8Array,
): Promise<Uint8Array> {
  const s = await getSodium();
  return s.crypto_box_seal(dek, recipientPubX25519);
}

export async function unwrapFromSender(
  sealed: Uint8Array,
  recipientPub: Uint8Array,
  recipientSec: Uint8Array,
): Promise<Uint8Array> {
  const s = await getSodium();
  return s.crypto_box_seal_open(sealed, recipientPub, recipientSec);
}
