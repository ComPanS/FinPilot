/**
 * AES-256-GCM encryption using Web Crypto API (works in Node.js and Edge Runtime).
 */
const IV_LENGTH = 12;

function uint8ArrayToBase64(u8: Uint8Array): string {
  const CHUNK = 0x8000;
  let binary = "";
  for (let i = 0; i < u8.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, Array.from(u8.subarray(i, i + CHUNK)));
  }
  return btoa(binary);
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const u8 = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) u8[i] = binary.charCodeAt(i);
  return u8;
}
const AUTH_TAG_LENGTH = 128; // bits
const PREFIX = "enc:";

function getKeyBytes(): Uint8Array {
  const keyBase64 = process.env.ENCRYPTION_KEY;
  if (!keyBase64) {
    throw new Error(
      "ENCRYPTION_KEY is not set. Generate with: node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\""
    );
  }
  const binary = atob(keyBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  if (bytes.length !== 32) {
    throw new Error("ENCRYPTION_KEY must be 32 bytes (base64 encoded)");
  }
  return bytes;
}

async function getCryptoKey(): Promise<CryptoKey> {
  const keyBytes = getKeyBytes();
  return crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

let cachedKey: CryptoKey | null = null;

async function getKey(): Promise<CryptoKey> {
  if (!cachedKey) cachedKey = await getCryptoKey();
  return cachedKey;
}

/**
 * Encrypt plaintext with AES-256-GCM. Returns base64 string with "enc:" prefix.
 */
export async function encrypt(plaintext: string): Promise<string> {
  if (!plaintext || plaintext.length === 0) return plaintext;
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const encoded = new TextEncoder().encode(plaintext);
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, tagLength: AUTH_TAG_LENGTH },
    key,
    encoded
  );
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);
  const base64 = uint8ArrayToBase64(combined);
  return PREFIX + base64;
}

/**
 * Decrypt ciphertext. Returns plaintext or original value if not encrypted.
 */
export async function decrypt(ciphertext: string): Promise<string> {
  if (!ciphertext || typeof ciphertext !== "string") return ciphertext;
  if (!ciphertext.startsWith(PREFIX)) return ciphertext; // backward compat: unencrypted data
  try {
    const key = await getKey();
    const combined = base64ToUint8Array(ciphertext.slice(PREFIX.length));
    const iv = combined.subarray(0, IV_LENGTH);
    const encrypted = combined.subarray(IV_LENGTH);
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv, tagLength: AUTH_TAG_LENGTH },
      key,
      encrypted
    );
    return new TextDecoder().decode(decrypted);
  } catch {
    return ciphertext; // on error, return as-is (e.g. corrupted or wrong key)
  }
}
