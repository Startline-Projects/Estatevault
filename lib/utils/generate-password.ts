import { randomInt } from "crypto";

// Credential-adjacent randomness is cryptographic. Math.random() is a
// predictable PRNG: a handful of observed outputs is enough to recover V8's
// internal state and predict the rest, and a serverless instance serves an
// attacker's request and a victim's from the same process.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";

export function generateTempPassword(): string {
  // Excludes confusing chars: 0, O, 1, l, I
  let password = "EV-";
  for (let i = 0; i < 8; i++) {
    password += ALPHABET.charAt(randomInt(ALPHABET.length));
  }
  return password;
  // Result example: EV-xK9mP2qR
}
