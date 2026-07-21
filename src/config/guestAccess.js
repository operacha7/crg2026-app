// src/config/guestAccess.js
// Client-side "can a guest do this?" levers. One source of truth for the UI —
// import these instead of re-declaring flags per component.
//
// History: June 2026 trial opened Email/PDF/Text to guests to gauge usage.
// 2026-07-01: Email + PDF closed back to registered-orgs-only; Text stays open.
// 2026-07-21: Email + PDF reopened to guests. Guests and registered orgs now
//   have identical access (Email, PDF, Text, Reports). The only difference is
//   the sender identity stamped on sent media — guests have none, so the
//   sender line is omitted entirely (senderFooter resolves to null in
//   AppDataContext, and every sender already drops the line when it's null).
//
// IMPORTANT — Email and PDF also have a SERVER gate that must move in lockstep:
//   GUEST_EMAIL_OPEN  ↔  GUEST_ACTIONS_OPEN in functions/sendEmail.js
//   GUEST_PDF_OPEN    ↔  GUEST_ACTIONS_OPEN in functions/createPdf.js
// The client flag hides the button (and, via GUEST_SELECTION_OPEN below, the
// row checkbox); the server flag is what actually authorizes the API call.
// If the client flag is true but the server flag is false, guest requests 401.
//
// Text/SMS is a client-side handoff with no server gate, so GUEST_TEXT_OPEN
// alone controls it.
export const GUEST_EMAIL_OPEN = true;
export const GUEST_PDF_OPEN = true;
export const GUEST_TEXT_OPEN = true;

// The row Select checkbox only feeds Email + PDF (Text sends the whole filtered
// list, not the selected rows). So it's meaningful to a guest only when at
// least one of Email/PDF is open — otherwise checking boxes just runs up a
// count for buttons they can't use. Reopen either action and the checkbox
// re-enables automatically.
export const GUEST_SELECTION_OPEN = GUEST_EMAIL_OPEN || GUEST_PDF_OPEN;

// Guest sender identity (email/PDF/text sign-off): a guest has no org of their
// own, so guest-sent media is simply signed "Guest" (name only). This lives in
// AppDataContext's senderFooter, not here, since it needs no config. Usage
// logging records guests as reg_organization "Guest" independently.
