// scripts/run-scan.mjs
// Node entry point for the weekly Opportunity Scan. Runs the SAME pipeline that
// used to live in the Cloudflare function (functions/_lib/scan-pipeline.js) —
// only the trigger + transport moved here, to Omar's always-on home desktop,
// because a residential IP can reach Google News RSS and Node has no ~30s
// execution cap. Scheduled by launchd (Mondays 2pm local). See CLAUDE.md →
// "Opportunity Scan System".
//
//   node scripts/run-scan.mjs            # real run: insert findings + email digest
//   node scripts/run-scan.mjs --dry-run  # no DB write, no digest; prints findings
//
// The digest email IS the heartbeat: a legitimate 0-findings run still emails,
// so SILENCE = something broke. To make a crash-before-digest visible too, this
// wrapper emails a failure notice on any thrown error (real runs only).

import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { runScan } from "../functions/_lib/scan-pipeline.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load secrets from .dev.vars (the same file wrangler uses locally) resolved
// relative to THIS script, not the working directory — launchd sets a minimal,
// unpredictable cwd, so an absolute resolution is what keeps it robust.
dotenv.config({ path: resolve(__dirname, "../.dev.vars") });

const env = process.env;
const dryRun = process.argv.includes("--dry-run");

// Local calendar date (YYYY-MM-DD). en-CA formats as ISO; using LOCAL time is
// correct now that the scan runs on Omar's machine at 2pm Central.
const localDate = (d = new Date()) => d.toLocaleDateString("en-CA");
const runDate = localDate();
const expiresDate = localDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));

async function sendFailureEmail(err) {
  if (!env.RESEND_API_KEY) return;
  const recipient = env.SCAN_DIGEST_RECIPIENT || "operacha@sbcglobal.net";
  const body = {
    from: '"CRG Opportunity Scan" <info@crghouston.org>',
    to: recipient,
    subject: `⚠️ CRG Opportunity Scan FAILED — ${runDate}`,
    html:
      `<div style="font-family:Arial,sans-serif;color:#222">` +
      `<h2 style="color:#B8001F">Opportunity Scan crashed</h2>` +
      `<p>The weekly scan threw before it could finish. No digest was sent; ` +
      `findings for this run may be missing.</p>` +
      `<pre style="background:#f4f4f4;padding:10px;white-space:pre-wrap;font-size:12px">` +
      `${String(err?.stack || err).replace(/</g, "&lt;")}</pre>` +
      `<p style="font-size:12px;color:#888">Check the launchd logs on the home desktop ` +
      `(logs/scan.err.log).</p></div>`,
  };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) console.error("failure-email send failed:", res.status, await res.text());
    else console.error("failure notice emailed to", recipient);
  } catch (e) {
    console.error("failure-email threw:", e.message);
  }
}

async function main() {
  const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  const supabaseKey = env.SUPABASE_SECRET_KEY || env.VITE_SUPABASE_SECRET_KEY;
  if (!supabaseUrl || !supabaseKey) throw new Error("Supabase URL/secret key missing from .dev.vars");
  if (!env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY missing from .dev.vars");

  const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

  console.log(`🚀 Opportunity Scan starting — ${runDate}${dryRun ? " (DRY RUN)" : ""}`);
  const started = Date.now();
  const result = await runScan({ env, supabase, runDate, expiresDate, dryRun });
  const secs = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`🏁 done in ${secs}s:`, JSON.stringify(result, null, dryRun ? 2 : 0));
}

main()
  .then(() => process.exit(0))
  .catch(async (err) => {
    console.error("🚨 scan error:", err);
    if (!dryRun) await sendFailureEmail(err);
    process.exit(1);
  });
