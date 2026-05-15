// functions/_lib/session.js
// Session token + password hashing for the CRG auth flow.
//
// Why no dependencies: bcrypt/jose pull in CommonJS shims that wobble in the
// Cloudflare Workers runtime. Web Crypto is built-in, NIST-approved, and lets
// the same code run unmodified in Node 18+ (used by the bcrypt/migration script
// in scripts/hash-passcodes.js) and in the Cloudflare Pages function runtime.
//
// Algorithm choices
//   Password hashing: PBKDF2-SHA256, 100k iterations. NIST SP 800-63B approved
//   for password storage. Roughly equivalent work factor to bcrypt cost 10.
//   Self-describing storage format embeds the iteration count so we can raise
//   it later without breaking older hashes.
//
//   Session token: HMAC-SHA256 signed JWT (header.payload.signature). Stateless
//   so we don't need a sessions table. Payload carries account_id +
//   reg_organization (the minimum identity the gated endpoints need).

const PBKDF2_ALGO = "pbkdf2-sha256";
const PBKDF2_ITERATIONS = 100_000;
const PBKDF2_KEY_BITS = 256;
const SALT_BYTES = 16;

const enc = new TextEncoder();
const dec = new TextDecoder();

// Base64url helpers (URL-safe base64, no padding) — JWT spec format
function bytesToB64Url(bytes) {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64UrlToBytes(s) {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// ─── Password hashing ────────────────────────────────────────────────────────

export async function hashPassword(plaintext) {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const derived = await deriveBits(plaintext, salt, PBKDF2_ITERATIONS);
  return `${PBKDF2_ALGO}$${PBKDF2_ITERATIONS}$${bytesToB64Url(salt)}$${bytesToB64Url(derived)}`;
}

// Verifies plaintext against a stored hash. Returns true/false.
// If the stored value isn't in our PBKDF2 format (e.g. a legacy plaintext
// passcode that hasn't been migrated yet), falls back to constant-time string
// compare so logins keep working through the migration window.
export async function verifyPassword(plaintext, stored) {
  if (typeof stored !== "string") return false;

  if (stored.startsWith(`${PBKDF2_ALGO}$`)) {
    const parts = stored.split("$");
    if (parts.length !== 4) return false;
    const iterations = parseInt(parts[1], 10);
    const salt = b64UrlToBytes(parts[2]);
    const expected = b64UrlToBytes(parts[3]);
    const derived = await deriveBits(plaintext, salt, iterations);
    return constantTimeEqual(new Uint8Array(derived), expected);
  }

  // Legacy plaintext fallback (pre-migration). Constant-time compare.
  return constantTimeEqualStr(plaintext, stored);
}

async function deriveBits(plaintext, salt, iterations) {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(plaintext),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    keyMaterial,
    PBKDF2_KEY_BITS
  );
  return new Uint8Array(bits);
}

function constantTimeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

function constantTimeEqualStr(a, b) {
  return constantTimeEqual(enc.encode(a), enc.encode(b));
}

// ─── JWT (HMAC-SHA256) ───────────────────────────────────────────────────────

const JWT_HEADER_B64 = bytesToB64Url(enc.encode(JSON.stringify({ alg: "HS256", typ: "JWT" })));

async function importHmacKey(secret) {
  return crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

export async function signSession(payload, secret) {
  const payloadB64 = bytesToB64Url(enc.encode(JSON.stringify(payload)));
  const signingInput = `${JWT_HEADER_B64}.${payloadB64}`;
  const key = await importHmacKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(signingInput));
  return `${signingInput}.${bytesToB64Url(new Uint8Array(sig))}`;
}

// Returns the payload object if valid + unexpired, else null.
export async function verifySession(token, secret) {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [headerB64, payloadB64, sigB64] = parts;

  const key = await importHmacKey(secret);
  const ok = await crypto.subtle.verify(
    "HMAC",
    key,
    b64UrlToBytes(sigB64),
    enc.encode(`${headerB64}.${payloadB64}`)
  );
  if (!ok) return null;

  let payload;
  try {
    payload = JSON.parse(dec.decode(b64UrlToBytes(payloadB64)));
  } catch {
    return null;
  }

  if (typeof payload?.exp === "number" && Date.now() / 1000 > payload.exp) {
    return null;
  }
  return payload;
}

// ─── Cookie helpers ──────────────────────────────────────────────────────────

export const SESSION_COOKIE_NAME = "crg_session";

// Returns Unix-seconds for the next 2:00 AM Central Time. Mirrors the existing
// 2 AM hard reload in src/components/ScheduledReload.js so cookie expiry and
// scheduled reload land at the same wall-clock moment.
export function next2amCentralUnix() {
  const now = new Date();
  const isDst = isCentralDst(now);
  const offsetHours = isDst ? -5 : -6;
  const target = new Date(now.getTime());
  target.setUTCHours(2 - offsetHours, 0, 0, 0);
  if (target.getTime() <= now.getTime()) {
    target.setUTCDate(target.getUTCDate() + 1);
  }
  return Math.floor(target.getTime() / 1000);
}

function isCentralDst(date) {
  const year = date.getUTCFullYear();
  // DST: second Sunday in March → first Sunday in November (US rules)
  const march1 = new Date(Date.UTC(year, 2, 1));
  const dstStart = new Date(Date.UTC(year, 2, 1 + ((14 - march1.getUTCDay()) % 7), 7)); // 2am CST = 7am UTC
  const nov1 = new Date(Date.UTC(year, 10, 1));
  const dstEnd = new Date(Date.UTC(year, 10, 1 + ((7 - nov1.getUTCDay()) % 7), 7));
  return date >= dstStart && date < dstEnd;
}

export function buildSessionCookie(token, expUnix, { secure }) {
  const maxAge = Math.max(60, expUnix - Math.floor(Date.now() / 1000));
  const parts = [
    `${SESSION_COOKIE_NAME}=${token}`,
    "HttpOnly",
    "Path=/",
    "SameSite=Lax",
    `Max-Age=${maxAge}`,
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export function buildClearCookie({ secure }) {
  const parts = [
    `${SESSION_COOKIE_NAME}=`,
    "HttpOnly",
    "Path=/",
    "SameSite=Lax",
    "Max-Age=0",
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export function readSessionCookie(request) {
  const header = request.headers.get("Cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === SESSION_COOKIE_NAME) return rest.join("=");
  }
  return null;
}

// True for prod (https). Lets us skip the `Secure` flag in local http dev,
// which Chrome would otherwise reject on http://localhost.
export function isSecureRequest(request) {
  const url = new URL(request.url);
  return url.protocol === "https:";
}
