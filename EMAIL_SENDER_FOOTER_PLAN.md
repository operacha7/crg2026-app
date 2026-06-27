# Email/PDF/Text Sender Footer — Child Identity & `is_block` (FINAL DESIGN)

**Status:** Design finalized June 27, 2026. Implementing now. Schema changes are **already
done** in the Google Sheet + Supabase (see §8) — this is a code-only build.

**Goal:** Show the **sending organization's name + phone** at the bottom of the **email**,
the **PDF**, and the **text/SMS share** — the *child* (conference/location), even though the
login account is at the *parent* level.

---

## 1. The problem

Accounts are per **parent** (e.g. *Society of St Vincent de Paul*), but a parent can have
~50 children (conferences) with different names and phone numbers, all sharing one passcode.
A parent-login session knows which parent it is, not which child the person works at — so the
footer needs the session to declare its child once.

## 2. Data model (schema already in place)

Two Supabase tables. **Table names are plural:** `organizations`, `registered_organizations`.

### `organizations` — authoritative parent/child map + footer source
- `id_no` (int4, 4-digit) — **child** key, one row per child org.
- `organization` (text) — child name. `org_parent` (text) — parent name. Never null; equal when solo.
- `account_id` (text, 5-digit) — **parent** key. **Null unless the parent is registered.**
  All children of a registered parent carry the *same* `account_id`.
- `org_telephone` (text) — the single curated phone for the footer. **Freeform and independent
  of `directory.org_telephone`** (directory lists every per-assistance number; this is the one
  chosen number). Empty = name only, no phone.
- `is_block` (bool, default FALSE) — block this child's name/phone.
- (Other columns — `org_assistance`, `fin_funding`, `subgroup` — are unrelated to this feature.)

### `registered_organizations` — parent-level login (browser-locked)
- `account_id` (text, **PK**) — joins to `organizations.account_id`.
- `reg_organization` (text) — validation-bound to `organizations.org_parent`.
- `org_passcode`, `org_color`.
- ~~`is_block`~~ — **REMOVED 2026-06-27.** Block now lives solely on the child
  (`organizations.is_block`); a parent-wide block = flag every child. This drops
  all auth-layer wiring (no `is_block` in `/login` or `/whoami`) and collapses
  `senderBlocked` to a single source. Tradeoff: a child added later defaults
  unblocked until re-flagged (data owner re-applies; accepted). A separate
  who-decides-to-block process is owned by the data owner, out of scope here.

### Guaranteed invariants (confirmed by data owner)
- `reg_organization` is data-validated against `organizations.org_parent`, and `account_id`
  is a lookup off it → every `registered_organizations.account_id` appears on ≥1 `organizations`
  row. The child picker can never come up empty.
- `account_id` is **text on both sides** → exact string match, no coercion.

### Strict source separation
- **Results section** → sourced **solely from `directory`** (unchanged by this feature).
- **Sender footer + picker** → sourced **solely from `registered_organizations` + `organizations`**.
  `directory` plays **no** role.

## 3. Child-selection flow (after passcode validation)

1. User selects parent in the login dropdown, enters passcode, submits.
2. `/login` validates and returns the user object **including parent `is_block` and `account_id`**.
3. Client computes the parent's children = `organizations` rows where `account_id` === the
   session `account_id`. **No stored "has children" flag — derive from the count** (we load the
   list anyway, so the count is free, and it can never drift when a child is added/removed).
4. Resolve the child (**independent of block** — block governs only sent-item
   display, not which child the session is; this keeps usage logs and the panel
   change-link working for blocked orgs):
   - **count ≤ 1** (solo / 1:1, incl. child name == parent name) → **auto-select silently**.
   - **count > 1**:
     - Saved choice exists for this `account_id` *and still matches a current child* → apply silently.
     - Saved choice missing **or stale** (child removed) → show **"Which location are you?"**
       picker (searchable; up to ~50 items).
5. Selected child is stored in the session and used for all footers.

**The forced first-login prompt is MANDATORY and deferred:**
- It waits until the announcement popups finish (same ordering as the training
  popup — gated on `announcementsDone`), so it never stacks on an announcement.
- It is **non-dismissable**: no Cancel, clicking the scrim does nothing. The only
  way out without picking is **Logout**. A parent session must declare its location.
- **Two-step select-then-confirm:** clicking a row only *stages* it (highlights);
  an accidental tap can be corrected by clicking another row. An **OK** button (grayed
  until something is staged) commits. This is deliberate for our less tech-savvy users
  — no instant-commit-on-tap. Forced footer = Logout + OK; change footer = Cancel + OK.
- The "change" re-open (from a send panel, when a choice already exists) is the
  opposite: dismissable with Cancel / scrim, keeping the existing choice; it opens
  pre-staged on the current child so OK is enabled immediately.

### Persistence
- **localStorage, keyed by parent:** `account_id (5-digit) → child id_no (4-digit)`.
- Survives refresh/logout/browser+computer restart; **per-browser/per-device** (clearing data,
  another browser, or another device → re-prompt once — acceptable, not a bug).
- Keyed by stable numeric codes, so a child **rename** keeps the saved choice valid; a child
  **removal** invalidates it and re-prompts.

## 4. Changing the selection — in the send panels, not at login

Login stays **one step** (no recurring second click). The change affordance lives in the
**Email / PDF / Text panels** as a small **sender-status line** that does triple duty:

- **Not blocked:** `Sending as: [Child Name] · [phone]`  *(change)* → the *(change)* link
  re-opens the same picker.
- **Blocked** (`child.is_block`): still shows `Sending as: [Child Name]` *(change)* plus a
  **red** note `Your organization's name and phone won't appear on sent items (set by your
  organization).` — so the user can see/change their pick and isn't dead-ended (and it
  explains the blank sent footer).

This gives every user a pre-send confirmation of the footer, the only place to change it, and
the explanation for a blank footer — all without cluttering login or firing a popup.

## 5. Footer content rules

```
blocked = child.is_block      // single source: organizations.is_block
```
- **blocked** → footer shows **nothing**. Parent name is **never** a fallback. No central number.
- **not blocked** → **child name always**; **phone only if `organizations.org_telephone` non-empty**.
- One `is_block` covers **email + PDF + text** (no per-medium flags). One phone per child.
- **Guests** (no `account_id`) → no sender footer at all.

## 6. Email vs PDF vs Text

- **Email** (`src/emails/ResourceEmail.jsx`): add a sender block above/near the logo footer.
- **PDF** (`formatPdf…`/`createPdf` in `src/services/emailService.js`): today shows
  `By: [parent name]`, no phone → **change to child name + phone, `is_block`-gated** (match email).
- **Text/SMS** (`buildSmsBody` in `src/services/emailService.js`): the body **leads**
  with `Sent by: <child>, <phone>. ` (plain ASCII, `is_block`-gated; omitted when
  blocked/guest — no fallback name), then the header + share URL **last** (best for
  tap-to-open). The SMS panel also shows the same `SenderStatusLine`.
  - ⚠️ **MUST stay a single line, ASCII only.** Newlines in the `sms:` URI body broke
    QR/`sms:` parsing ("not a valid 10-digit number") and made Google Voice send early
    (Enter = send); a `·` is also risky for GV auto-fill. If length ever bites, drop the
    header line, not the sign-off. (The `+1` E.164 prefix on the number is correct and
    unrelated — it predates this feature.)

## 7. Help backstop

Arm the Help assistant (single knowledge file `functions/help-knowledge.js`) so "why didn't my
org name show up on the email?" answers: the organization's leadership chose not to display it.

## 8. Schema — DONE (already applied to Sheet + Supabase)

| Table | Column | Type | Notes |
|-------|--------|------|-------|
| `organizations` | `org_telephone` | text | curated footer phone; empty = no phone |
| `organizations` | `is_block` | bool | block this child (the ONLY block source) |
| `app_usage_logs` | `organization` | text | Part 2: sender child stamped on every log row |

`registered_organizations.is_block` was added then **dropped 2026-06-27** (block is
child-only now). Sync coerces `"TRUE"/"FALSE"` → real bool (mirror `header_config` /
`transformTrainingSession` in `scripts/sync-to-supabase.js`). `account_id` stays text.
`app_usage_logs` is runtime-written (not synced) — no sync change for the new column.

## 9. Code integration points (mapped against current code)

- **Login:** `src/auth/LoginModal.js` → `functions/login.js`. `/login` returns
  `{ account_id, reg_organization, org_color, isGuest, canEmail, canPdf }`.
  - No parent `is_block` — block is child-only (read from the `organizations` row).
- **Org data:** `AppDataContext` does **not** load `organizations` (orgs are derived from
  `directory` for search dropdowns — leave that alone).
  - [ ] Add a separate load of the real `organizations` table (`dataService` + context state),
        used only by the footer/picker. Filter to `account_id`-bearing rows is fine.
- **Picker:** post-login modal in the app shell; native `<select>` / filtered input
  (no combobox lib in the repo).
- **Sender line:** `src/components/EmailPanel.js` and `src/components/SmsPanel.js`.
- **Footers:** `src/emails/ResourceEmail.jsx` (email), `createPdf` in `emailService.js` (PDF),
  `buildSmsBody` in `emailService.js` (SMS).
- **Threading:** `src/views/ZipCodePage.js` passes the resolved child (name/phone/blocked) into
  `sendEmail`/`createPdf`/SMS build.

## 10. Rollout

1. Implement + test: 1:1 parent (no picker), multi-child parent (picker + saved choice + stale),
   blocked child (picker still shown, blank footer + red panel note + working change link),
   guest (no footer).
2. Populate `organizations.org_telephone` and set any `is_block` flags in the Sheet; `npm run sync`.
3. Review the block policy with multi-child parents.

---

## 11. Part 2 — sender child in usage logs (DONE 2026-06-27)

**Goal:** record which child (conference/location) performed each logged action, in a
new `app_usage_logs.organization` TEXT column — for **every** row, never null.

**Why decoupling the picker from block matters here:** because every multi-child parent
now picks (block-independent, §3), blocked orgs also get child-level logs instead of
collapsing to the parent name.

**Wiring (no threading through ~15 `logUsage` call sites):**
- `src/services/usageService.js` — module-level `currentLogOrganization` + exported
  `setLogOrganization(name)`; `logUsage` stamps `organization: currentLogOrganization`
  in the POST body.
- `src/Contexts/AppDataContext.js` — one `useEffect([selectedSenderChild])` calls
  `setLogOrganization(selectedSenderChild?.organization || null)`.
- `functions/log-usage.js` — reads `body.organization` (length-capped, informational —
  the server can't know the localStorage child), and **falls back to `reg_organization`
  when blank** → solo orgs and guests are recorded, never null.

**Block note:** a blocked child still logs its real name — block only suppresses the
client-facing footer, not internal analytics.

**Ordering:** the `organization` column had to exist in Supabase **before** deploy, or
every insert 503s (unknown column). It does. Reports views (`v_daily_usage`, etc.) don't
surface the new column yet — future work if child-level reporting is wanted.
