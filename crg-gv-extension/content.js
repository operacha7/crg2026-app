// CRG Google Voice Helper - Content Script
// Injected into voice.google.com at document_idle.
// Checks chrome.storage.local for pending CRG data, then auto-fills
// the recipient and message fields in Google Voice's compose UI.

(function () {
  const MAX_WAIT_MS = 15000;
  const POLL_INTERVAL_MS = 500;

  chrome.storage.local.get("crgPending", (result) => {
    if (!result.crgPending) return;

    const { phoneNumber, messageBody, timestamp } = result.crgPending;

    // Ignore stale data (older than 30 seconds)
    if (Date.now() - timestamp > 30000) {
      chrome.storage.local.remove("crgPending");
      return;
    }

    // Clear immediately so we don't re-fill on page refresh
    chrome.storage.local.remove("crgPending");

    fillGoogleVoice(phoneNumber, messageBody);
  });

  /**
   * Polls for the Google Voice recipient input, fills it, then clicks
   * the suggestion to confirm, and finally fills the message field.
   */
  function fillGoogleVoice(phone, message) {
    const start = Date.now();

    const recipientPoll = setInterval(() => {
      if (Date.now() - start > MAX_WAIT_MS) {
        clearInterval(recipientPoll);
        return;
      }

      // Google Voice recipient field selectors (multiple fallbacks)
      const recipientInput =
        document.querySelector('input[placeholder*="name or phone"]') ||
        document.querySelector('input[placeholder*="Type a name"]') ||
        document.querySelector('input[aria-label*="Type a name or phone number"]');

      if (!recipientInput) return;

      clearInterval(recipientPoll);

      // Fill the phone number
      setFieldValue(recipientInput, phone);

      // After filling, GV shows a suggestion dropdown (e.g. "Send to (713) 857-4399").
      // We need to click that suggestion to confirm the recipient.
      waitForSuggestionAndClick(message);
    }, POLL_INTERVAL_MS);
  }

  /**
   * After typing in the recipient field, Google Voice shows a dropdown
   * with suggestions. We poll for that dropdown and click the first match.
   */
  function waitForSuggestionAndClick(message) {
    const start = Date.now();

    const suggestionPoll = setInterval(() => {
      if (Date.now() - start > MAX_WAIT_MS) {
        clearInterval(suggestionPoll);
        // Even if we can't click the suggestion, still try to fill the message
        waitForMessageField(message);
        return;
      }

      // The "Send to (713) 857-4399" suggestion is a button with class "send-to-button"
      // inside a gv-contact-list element
      const suggestion =
        document.querySelector('button.send-to-button') ||
        document.querySelector('[class*="send-to-button"]') ||
        document.querySelector('gv-contact-list button');

      if (!suggestion) return;

      clearInterval(suggestionPoll);

      // Click the suggestion to confirm the recipient as a chip
      suggestion.click();

      // Now wait for the message field to appear (it only shows after recipient is confirmed)
      setTimeout(() => waitForMessageField(message), 500);
    }, POLL_INTERVAL_MS);
  }

  /**
   * Polls for the message textarea/contenteditable and fills it.
   */
  function waitForMessageField(message) {
    const start = Date.now();

    const messagePoll = setInterval(() => {
      if (Date.now() - start > MAX_WAIT_MS) {
        clearInterval(messagePoll);
        return;
      }

      // Google Voice message field selectors (multiple fallbacks)
      const messageField =
        document.querySelector('textarea[aria-label="Type a message"]') ||
        document.querySelector(
          'div[contenteditable="true"][aria-label="Type a message"]'
        ) ||
        document.querySelector('textarea[placeholder="Type a message"]') ||
        document.querySelector('textarea');

      if (!messageField) return;

      clearInterval(messagePoll);

      // Use execCommand('insertText') instead of setting .value directly.
      // This simulates real typing, which triggers GV's Angular/Polymer
      // change detection and enables the Send button.
      messageField.focus();
      messageField.select?.(); // select existing content if any
      document.execCommand("selectAll", false, null);
      document.execCommand("insertText", false, message);

      // Wait for the Send button to become enabled, then click it
      setTimeout(() => clickSendButton(), 800);
    }, POLL_INTERVAL_MS);
  }

  /**
   * Finds and clicks the Send button in Google Voice.
   * Waits for it to become enabled (not disabled) before clicking.
   */
  function clickSendButton() {
    const start = Date.now();

    const sendPoll = setInterval(() => {
      if (Date.now() - start > MAX_WAIT_MS) {
        clearInterval(sendPoll);
        return;
      }

      const sendButton = document.querySelector(
        'button[aria-label="Send message"]'
      );

      // Wait until the button exists AND is not disabled
      if (!sendButton || sendButton.disabled) return;

      clearInterval(sendPoll);
      sendButton.click();
    }, POLL_INTERVAL_MS);
  }

  /**
   * Sets a field's value using the native setter to bypass React/Polymer
   * synthetic event handling, then dispatches input/change events.
   */
  function setFieldValue(el, value) {
    el.focus();

    if (el.tagName === "DIV" && el.contentEditable === "true") {
      // contenteditable div (some GV versions use this)
      el.textContent = value;
      el.dispatchEvent(new Event("input", { bubbles: true }));
    } else {
      // Standard input or textarea — use native setter to bypass framework
      const inputSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value"
      )?.set;
      const textareaSetter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        "value"
      )?.set;

      const setter =
        el.tagName === "TEXTAREA" ? textareaSetter : inputSetter;

      if (setter) {
        setter.call(el, value);
      } else {
        el.value = value;
      }

      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }
})();
