// src/services/senderIdentity.js
// Helpers for the email/PDF/text "sender footer" feature.
//
// Logins are at the PARENT level (registered_organizations.account_id), but the
// footer needs the CHILD org's name + phone (organizations row). A parent can
// have ~50 children sharing one account_id, so a multi-child parent picks which
// child it represents once; the choice is remembered per parent in localStorage.
//
// We key the saved choice on the parent's 5-digit account_id → child's 4-digit
// id_no — both stable numeric codes, so a child rename keeps the saved choice
// valid (a removal invalidates it and re-prompts). See EMAIL_SENDER_FOOTER_PLAN.md.

const KEY_PREFIX = "crg_sender_child_";

// Read the saved child id_no for a parent (string), or null if none / storage
// unavailable (private mode, disabled storage).
export function getSavedChildId(accountId) {
  if (!accountId) return null;
  try {
    return localStorage.getItem(KEY_PREFIX + accountId);
  } catch {
    return null;
  }
}

// Persist the chosen child id_no for a parent. Best-effort — a storage failure
// just means the picker re-appears next session, which is acceptable.
export function saveChildId(accountId, childId) {
  if (!accountId || childId == null) return;
  try {
    localStorage.setItem(KEY_PREFIX + accountId, String(childId));
  } catch {
    /* best-effort only */
  }
}

// Given a parent's children (organizations rows), resolve the saved selection.
// Returns { selectedChild, needsPicker }:
//   - saved id matches a current child  → that child, no picker
//   - no saved id, or it's stale (child removed) → null, show picker
export function resolveSavedChild(accountId, children) {
  const savedId = getSavedChildId(accountId);
  const saved = children.find((c) => String(c.id_no) === String(savedId));
  if (saved) return { selectedChild: saved, needsPicker: false };
  return { selectedChild: null, needsPicker: true };
}
