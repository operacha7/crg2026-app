// CRG Google Voice Helper - Background Service Worker
// Receives messages from the CRG web app via externally_connectable
// and relays phone number + message to the content script via chrome.storage.local.

// Build the Google Voice compose URL for a given account selector.
// Google distinguishes signed-in accounts by an index in the path
// (/u/0/, /u/1/, ...). Index order depends on sign-in order, so a user signed
// into a personal account first lands on /u/0/ (no Voice). The web app can pass
// an account selector so the right account opens:
//   - blank          -> /u/0/ (default, unchanged)
//   - numeric ("1")  -> /u/1/ (account index)
//   - email          -> ?authuser=<email>
// Keep in sync with buildGvComposeUrl in src/utils/gvExtension.js.
function buildComposeUrl(account) {
  const base = "https://voice.google.com";
  const draft = "/messages?itemId=draft";
  const a = (account || "").trim();
  if (!a) return base + "/u/0" + draft;
  if (/^\d+$/.test(a)) return base + "/u/" + a + draft;
  return base + draft + "&authuser=" + encodeURIComponent(a);
}

chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  // Extension detection — web app sends PING to check if installed
  if (message.type === "PING") {
    sendResponse({ status: "ok", version: chrome.runtime.getManifest().version });
    return true;
  }

  // Fill Google Voice — store data and open compose view
  if (message.type === "FILL_GV") {
    const { phoneNumber, messageBody, authuser } = message;

    chrome.storage.local.set(
      {
        crgPending: {
          phoneNumber,
          messageBody,
          timestamp: Date.now(),
        },
      },
      () => {
        // Open Google Voice compose in a new tab, targeting the user's
        // saved account when provided (falls back to /u/0/ when blank).
        chrome.tabs.create(
          { url: buildComposeUrl(authuser) },
          () => {
            sendResponse({ status: "ok" });
          }
        );
      }
    );

    // Keep the message channel open for the async sendResponse
    return true;
  }
});
