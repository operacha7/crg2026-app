# Opportunity Scan — home-desktop scheduling (launchd)

The weekly scan runs on **this machine** (Omar's always-on home desktop), not
Cloudflare — a residential IP can reach Google News RSS and Node has no ~30s
execution cap. See `CLAUDE.md → Opportunity Scan System` for the full why.

- **Engine:** `functions/_lib/scan-pipeline.js` (`runScan()`)
- **Runner:** `scripts/run-scan.mjs` (loads `.dev.vars`, builds env + Supabase client, calls `runScan`)
- **Schedule:** `org.crghouston.opportunity-scan.plist` — **Mondays 2:00 PM local**

## One-time setup

```bash
# 1. Create the log directory the plist writes to (gitignored).
mkdir -p /Users/operacha/crg2026-app/logs

# 2. Confirm the node path in the plist matches this machine.
which node        # expect /usr/local/bin/node — if different, edit the plist

# 3. Copy the plist into the per-user LaunchAgents dir.
cp /Users/operacha/crg2026-app/scripts/launchd/org.crghouston.opportunity-scan.plist \
   ~/Library/LaunchAgents/

# 4. Load it (bootstrap into your GUI login session).
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/org.crghouston.opportunity-scan.plist

# 5. Verify it's registered.
launchctl list | grep opportunity-scan
```

## Test it now (don't wait for Monday)

```bash
# Dry run — no DB write, no email, just prints candidates → findings.
cd /Users/operacha/crg2026-app && node scripts/run-scan.mjs --dry-run

# Fire the REAL scheduled job immediately (inserts findings + sends the digest).
launchctl kickstart -k gui/$(id -u)/org.crghouston.opportunity-scan

# Watch the logs.
tail -f /Users/operacha/crg2026-app/logs/scan.out.log
tail -f /Users/operacha/crg2026-app/logs/scan.err.log
```

## Update after editing the plist

```bash
launchctl bootout gui/$(id -u)/org.crghouston.opportunity-scan 2>/dev/null
cp /Users/operacha/crg2026-app/scripts/launchd/org.crghouston.opportunity-scan.plist ~/Library/LaunchAgents/
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/org.crghouston.opportunity-scan.plist
```

## Remove entirely

```bash
launchctl bootout gui/$(id -u)/org.crghouston.opportunity-scan
rm ~/Library/LaunchAgents/org.crghouston.opportunity-scan.plist
```

## Reliability notes (accepted trade-offs)

- **Asleep at 2pm, awake later →** launchd runs the missed job on wake. Fine.
- **Powered off / sitting at the FileVault or login screen at 2pm →** the run is
  **skipped** (a per-user LaunchAgent only runs inside a logged-in GUI session).
  Accepted: the news feed is nice-to-have; a skipped week harms nothing. If this
  ever bites, harden with a `LaunchDaemon` (runs without login) or enable
  auto-login — deferred for now.
- **Silence = broken.** The digest email is the heartbeat — even a 0-findings run
  emails. A crash before the digest sends a separate "⚠️ FAILED" email
  (`run-scan.mjs`). If a Monday passes with *no* email of either kind, check the
  logs above.
- **Runs the working tree, not a build artifact.** An uncommitted half-edit in
  `functions/_lib/` or `scripts/` will run as-is. Keep the tree clean.
