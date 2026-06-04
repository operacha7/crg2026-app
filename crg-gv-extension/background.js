// CRG Google Voice Helper - Background Service Worker
// Receives messages from the CRG web app via externally_connectable
// and relays phone number + message to the content script via chrome.storage.local.

chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  // Extension detection — web app sends PING to check if installed
  if (message.type === "PING") {
    sendResponse({ status: "ok", version: chrome.runtime.getManifest().version });
    return true;
  }

  // Fill Google Voice — store data and open compose view
  if (message.type === "FILL_GV") {
    const { phoneNumber, messageBody } = message;

    chrome.storage.local.set(
      {
        crgPending: {
          phoneNumber,
          messageBody,
          timestamp: Date.now(),
        },
      },
      () => {
        // Open Google Voice compose in a new tab
        chrome.tabs.create(
          { url: "https://voice.google.com/u/0/messages?itemId=draft" },
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
