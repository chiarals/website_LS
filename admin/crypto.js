// The GitHub key that lets the reserved area save, locked with Chiara's password.
// admin/key.json is public like the rest of the site, so the password is the only lock:
// it must be long (a short sentence works well). PBKDF2 with many rounds makes guessing slow.
// Shared by the browser and by tools/admin-key.mjs (Node has the same Web Crypto API).

const ROUNDS = 600000;
const enc = new TextEncoder();
const b64 = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function keyFrom(password, salt, rounds) {
  const base = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: rounds, hash: 'SHA-256' },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

export async function lock(secret, password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await keyFrom(password, salt, ROUNDS);
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(secret));
  return { v: 1, rounds: ROUNDS, salt: b64(salt), iv: b64(iv), data: b64(data) };
}

// Throws when the password is wrong.
export async function unlock(box, password) {
  const key = await keyFrom(password, unb64(box.salt), box.rounds);
  const data = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(box.iv) }, key, unb64(box.data));
  return new TextDecoder().decode(data);
}
