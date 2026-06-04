// Utility module for communicating with the CRG Google Voice Helper Chrome extension.
// The extension uses externally_connectable so the web app can send messages
// directly via chrome.runtime.sendMessage(EXTENSION_ID, payload).

// Chrome Web Store extension ID — placeholder until first publish.
// After publishing, replace with the real ID from the Chrome Web Store dashboard.
const GV_EXTENSION_ID = "clmhlgfcooanmndehiahccibpbbnmjlg";

// localStorage key for the user's saved Google Voice account (opt-in).
// Empty/unset = default behavior (account index 0). Only multi-account users
// who land on the wrong Google account need to set this. See buildGvComposeUrl.
const GV_ACCOUNT_STORAGE_KEY = "crgGvAccount";

/**
 * Read the saved Google Voice account selector (email or numeric index).
 * Returns "" when nothing is saved or storage is unavailable.
 */
export function getSavedGvAccount() {
  try {
    return localStorage.getItem(GV_ACCOUNT_STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

/**
 * Persist the Google Voice account selector. Pass an empty/blank value to clear.
 */
export function setSavedGvAccount(account) {
  try {
    const trimmed = (account || "").trim();
    if (trimmed) {
      localStorage.setItem(GV_ACCOUNT_STORAGE_KEY, trimmed);
    } else {
      localStorage.removeItem(GV_ACCOUNT_STORAGE_KEY);
    }
  } catch {
    /* storage unavailable (private mode, etc.) — silently ignore */
  }
}

/**
 * Build the Google Voice compose URL for a given account selector.
 *
 * Google distinguishes signed-in accounts by an index in the path
 * (/u/0/, /u/1/, ...). Index order depends on sign-in order, so a user signed
 * into a personal account first lands on /u/0/ (no Voice) instead of their org
 * Voice account. This lets them pin the right one:
 *   - blank          → /u/0/ (default, unchanged for everyone who doesn't set it)
 *   - numeric ("1")  → /u/1/ (account index — always honored by Google)
 *   - email          → ?authuser=<email> (selects by account; user-friendly)
 *
 * This is duplicated in crg-gv-extension/background.js — keep them in sync.
 */
export function buildGvComposeUrl(account) {
  const base = "https://voice.google.com";
  const draft = "/messages?itemId=draft";
  const a = (account || "").trim();
  if (!a) return `${base}/u/0${draft}`;
  if (/^\d+$/.test(a)) return `${base}/u/${a}${draft}`;
  return `${base}${draft}&authuser=${encodeURIComponent(a)}`;
}

/**
 * Check whether the CRG Google Voice Helper extension is installed.
 * Sends a PING message and waits for a response.
 * Returns false if the extension is not installed or the browser is not Chrome.
 */
export async function isGvExtensionInstalled() {
  if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) {
    return false;
  }
  try {
    const response = await chrome.runtime.sendMessage(GV_EXTENSION_ID, {
      type: "PING",
    });
    return response?.status === "ok";
  } catch {
    return false;
  }
}

/**
 * Send phone number and message to the extension for auto-filling in Google Voice.
 * The extension stores the data, opens Google Voice compose, and the content script
 * fills both fields automatically.
 */
export async function sendToGvExtension(phoneNumber, messageBody, account = "") {
  if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) {
    throw new Error("Chrome extension API not available");
  }
  const response = await chrome.runtime.sendMessage(GV_EXTENSION_ID, {
    type: "FILL_GV",
    phoneNumber,
    messageBody,
    // Account selector (email or numeric index). Older extension versions
    // ignore this field and fall back to /u/0/, so it degrades gracefully.
    authuser: account,
  });
  if (response?.status !== "ok") {
    throw new Error("Extension did not acknowledge");
  }
  return response;
}

/**
 * Direct link to the extension's Chrome Web Store page.
 * Update after publishing.
 */
export const GV_EXTENSION_STORE_URL =
  "https://chromewebstore.google.com/detail/crg-google-voice-helper/" +
  GV_EXTENSION_ID;
