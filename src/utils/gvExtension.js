// Utility module for communicating with the CRG Google Voice Helper Chrome extension.
// The extension uses externally_connectable so the web app can send messages
// directly via chrome.runtime.sendMessage(EXTENSION_ID, payload).

// Chrome Web Store extension ID — placeholder until first publish.
// After publishing, replace with the real ID from the Chrome Web Store dashboard.
const GV_EXTENSION_ID = "clmhlgfcooanmndehiahccibpbbnmjlg";

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
export async function sendToGvExtension(phoneNumber, messageBody) {
  if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) {
    throw new Error("Chrome extension API not available");
  }
  const response = await chrome.runtime.sendMessage(GV_EXTENSION_ID, {
    type: "FILL_GV",
    phoneNumber,
    messageBody,
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
