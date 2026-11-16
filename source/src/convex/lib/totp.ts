import { sha1 } from "@oslojs/crypto/sha1";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const PERIOD_SECONDS = 30;
const DIGITS = 6;

function base32Encode(bytes: Uint8Array): string {
  let output = "";
  let buffer = 0;
  let bits = 0;
  for (const byte of bytes) {
    buffer = (buffer << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      output += BASE32_ALPHABET[(buffer >>> bits) & 31];
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(buffer << (5 - bits)) & 31];
  }
  return output;
}

function base32Decode(value: string): Uint8Array {
  const clean = value.toUpperCase().replace(/[\s=]/g, "");
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const character of clean) {
    const index = BASE32_ALPHABET.indexOf(character);
    if (index < 0) throw new Error("Invalid base32 secret");
    buffer = (buffer << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >>> bits) & 0xff);
    }
  }
  return new Uint8Array(bytes);
}

function counterBytes(counter: number): Uint8Array {
  const bytes = new Uint8Array(8);
  let remaining = counter;
  for (let index = 7; index >= 0; index -= 1) {
    bytes[index] = remaining & 0xff;
    remaining = Math.floor(remaining / 256);
  }
  return bytes;
}

function hmacSha1(key: Uint8Array, message: Uint8Array): Uint8Array {
  const blockSize = 64;
  const normalizedKey =
    key.length > blockSize ? sha1(key) : key;
  const paddedKey = new Uint8Array(blockSize);
  paddedKey.set(normalizedKey);
  const innerPad = new Uint8Array(blockSize);
  const outerPad = new Uint8Array(blockSize);
  for (let index = 0; index < blockSize; index += 1) {
    innerPad[index] = paddedKey[index] ^ 0x36;
    outerPad[index] = paddedKey[index] ^ 0x5c;
  }
  const innerMessage = new Uint8Array(blockSize + message.length);
  innerMessage.set(innerPad);
  innerMessage.set(message, blockSize);
  const innerDigest = sha1(innerMessage);
  const outerMessage = new Uint8Array(blockSize + innerDigest.length);
  outerMessage.set(outerPad);
  outerMessage.set(innerDigest, blockSize);
  return sha1(outerMessage);
}

function hotp(secret: string, counter: number): string {
  const key = base32Decode(secret);
  const digest = hmacSha1(key, counterBytes(counter));
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);
  return String(binary % 10 ** DIGITS).padStart(DIGITS, "0");
}

/** Generates a 160-bit base32 secret suitable for authenticator apps. */
export function generateTotpSecret(): string {
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  return base32Encode(bytes);
}

/** Constant-time comparison for short numeric codes. */
function safeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

/**
 * Verifies a six-digit TOTP code. A one-period tolerance is allowed on each
 * side for small clock differences between the server and the phone.
 */
export function verifyTotp(
  secret: string,
  code: string,
  now = Date.now(),
  window = 1,
): boolean {
  const normalized = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(normalized)) return false;
  const counter = Math.floor(now / 1000 / PERIOD_SECONDS);
  for (let offset = -window; offset <= window; offset += 1) {
    if (safeEqual(hotp(secret, counter + offset), normalized)) return true;
  }
  return false;
}

export function totpUri(
  secret: string,
  accountName: string,
  issuer = "کافی‌نت‌یار",
): string {
  const label = encodeURIComponent(`${issuer}:${accountName}`);
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: "SHA1",
    digits: String(DIGITS),
    period: String(PERIOD_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}
