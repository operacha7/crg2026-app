// scripts/hash-passcodes.js
// One-shot migration: read each plaintext passcode in registered_organizations
// and rewrite it as a PBKDF2-SHA256 hash. After this runs, the org_passcode
// column never holds plaintext again, and the login function's
// verifyPassword() picks up the new format automatically.
//
// Idempotent: rows already in the PBKDF2 format are skipped, so re-running
// (or running mid-migration) is safe.
//
// Usage:
//   node scripts/hash-passcodes.js              # dry run — shows what would change
//   node scripts/hash-passcodes.js --apply      # actually writes the hashes
//
// Reads VITE_SUPABASE_URL + VITE_SUPABASE_SECRET_KEY from the project's .env
// (same pattern as sync-to-supabase.js). The secret key is required because
// updating org_passcode bypasses the public read policy.

const path = require("path");
const { createClient } = require("@supabase/supabase-js");
const { webcrypto } = require("crypto");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

// Node 18+ exposes Web Crypto under crypto.webcrypto. Bind it to the globals
// the hashing code expects so the same routines run unmodified here and in
// the Cloudflare Pages function.
if (!globalThis.crypto) globalThis.crypto = webcrypto;

// ─── PBKDF2 hashing (mirrors functions/_lib/session.js) ─────────────────────
const PBKDF2_ALGO = "pbkdf2-sha256";
const PBKDF2_ITERATIONS = 100_000;
const PBKDF2_KEY_BITS = 256;
const SALT_BYTES = 16;
const enc = new TextEncoder();

function bytesToB64Url(bytes) {
  return Buffer.from(bytes)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function hashPassword(plaintext) {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(plaintext),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    keyMaterial,
    PBKDF2_KEY_BITS
  );
  return `${PBKDF2_ALGO}$${PBKDF2_ITERATIONS}$${bytesToB64Url(salt)}$${bytesToB64Url(new Uint8Array(bits))}`;
}

function isAlreadyHashed(value) {
  return typeof value === "string" && value.startsWith(`${PBKDF2_ALGO}$`);
}

// ─── Main ───────────────────────────────────────────────────────────────────
async function main() {
  const apply = process.argv.includes("--apply");

  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_SECRET_KEY;
  if (!url || !key) {
    console.error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_SECRET_KEY in .env");
    process.exit(1);
  }
  const supabase = createClient(url, key);

  const { data: rows, error } = await supabase
    .from("registered_organizations")
    .select("account_id, reg_organization, org_passcode");

  if (error) {
    console.error("Supabase fetch failed:", error);
    process.exit(1);
  }

  console.log(`Found ${rows.length} registered_organizations rows.`);
  let toHash = 0;
  let skipped = 0;
  let errors = 0;

  for (const row of rows) {
    if (isAlreadyHashed(row.org_passcode)) {
      console.log(`  [skip] ${row.reg_organization} — already hashed`);
      skipped++;
      continue;
    }
    if (!row.org_passcode) {
      console.log(`  [skip] ${row.reg_organization} — empty passcode (will lock this account out; fix manually)`);
      skipped++;
      continue;
    }

    const hashed = await hashPassword(row.org_passcode);
    toHash++;
    if (!apply) {
      console.log(`  [dry] ${row.reg_organization} → would write ${hashed.slice(0, 40)}…`);
      continue;
    }

    const { error: upErr } = await supabase
      .from("registered_organizations")
      .update({ org_passcode: hashed })
      .eq("account_id", row.account_id);

    if (upErr) {
      console.error(`  [fail] ${row.reg_organization}:`, upErr.message);
      errors++;
    } else {
      console.log(`  [ok]   ${row.reg_organization}`);
    }
  }

  console.log("");
  console.log(`Summary: ${toHash} to hash, ${skipped} skipped, ${errors} errors.`);
  if (!apply) {
    console.log("This was a dry run. Re-run with --apply to write the changes.");
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
