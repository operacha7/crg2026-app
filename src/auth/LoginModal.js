// src/auth/LoginModal.js
// Site-wide login modal that opens whenever the URL carries `?login=1`.
// Triggered from Footer / MobileMenu / HomeNavBar via a relative `?login=1`
// link, so the modal pops up on whatever page the user clicked from rather
// than redirecting to /find first. Replaces the standalone /login page from
// the pre-2026 design — all extra chrome (guest button, scrolling org list,
// background art, contact-support fallback) is gone. Per the redesign brief:
// only an organization dropdown, a passcode input, and Login / Cancel.
//
// Post-login navigation:
//   - From the homepage (/) → forward to /find so the user lands inside the
//     working app (matches the original "log in and start using it" flow).
//   - From anywhere else → stay put. A user already inside the app stays on
//     the page they were viewing; cancelling leaves them on /about, /find,
//     /privacy, etc. with no disruption.
//
// Visual: white panel with a 5px maroon-teal (#43747D) border and 20px radius.
// Title and labels are #660000 (semibold). Inputs are cream (#F3EED9) with
// black text. Buttons reuse the standard panel button tokens (red Cancel,
// green Login) so they match the Assistance panel etc. The full-screen wrapper
// has a transparent background — the page underneath stays visible so the
// login feels like an inline panel rather than a context-switching takeover.

import { useEffect, useState, useRef } from "react";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { dataService } from "../services/dataService";

export default function LoginModal({ onLoginSuccess }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  // Open whenever ?login=1 is present — even if a user is already signed in.
  // This lets a logged-in user re-open the modal from "Organization Login" to
  // switch to a different organization (no separate switch-org UI needed).
  const isOpen = searchParams.get("login") === "1";

  const [orgList, setOrgList] = useState([]);
  const [orgData, setOrgData] = useState([]);
  const [org, setOrg] = useState("");
  const [error, setError] = useState("");
  const passcodeRef = useRef(null);
  const dropdownRef = useRef(null);

  // Fetch registered orgs once on mount. Cheap (single small table); pre-fetch
  // so the dropdown is populated by the time the user clicks the footer link.
  useEffect(() => {
    let cancelled = false;
    dataService
      .getRegisteredOrganizations()
      .then((data) => {
        if (cancelled) return;
        const unique = [
          ...new Set(data.map((d) => d.reg_organization)),
        ].sort((a, b) => a.localeCompare(b));
        setOrgList(unique);
        setOrgData(data);
      })
      .catch((err) => console.error("LoginModal: org fetch failed", err));
    return () => {
      cancelled = true;
    };
  }, []);

  // Prefetch the MainApp chunk while the user is typing their passcode. A
  // successful login forwards into MainApp (→ /find from the homepage, or
  // stay-in-place from any other page that already mounts MainApp), so we
  // start the chunk download as soon as the modal opens. Covers entry
  // points that didn't flow through HomePage (clicking Organization Login
  // from /about, /privacy, /terms). .catch() prevents an unhandled
  // rejection if the network drops — lazy() will retry on demand.
  useEffect(() => {
    if (isOpen) {
      import("../MainApp").catch(() => {});
    }
  }, [isOpen]);

  // Reset transient state every time the modal opens — so reopening the modal
  // after a cancel doesn't show stale errors or a previously typed passcode.
  useEffect(() => {
    if (isOpen) {
      setOrg("");
      setError("");
      if (passcodeRef.current) passcodeRef.current.value = "";
      setTimeout(() => dropdownRef.current?.focus(), 0);
    }
  }, [isOpen]);

  // Move focus to the passcode field once an org is picked — saves a tab key.
  useEffect(() => {
    if (org && passcodeRef.current) {
      passcodeRef.current.focus({ preventScroll: true });
    }
  }, [org]);

  const close = () => {
    const params = new URLSearchParams(location.search);
    params.delete("login");
    const search = params.toString();
    navigate(`${location.pathname}${search ? `?${search}` : ""}`, {
      replace: true,
    });
  };

  // ESC closes the modal — standard modal a11y expectation.
  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, location.pathname, location.search]);

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    const enteredPasscode = passcodeRef.current?.value || "";
    const matched = orgData.find(
      (entry) =>
        entry.reg_organization === org &&
        entry.org_passcode === enteredPasscode
    );
    if (matched) {
      setError("");
      onLoginSuccess(matched);
      // Logging in from the homepage forwards into the working app; logging
      // in from anywhere else (including in-app re-login to switch orgs)
      // leaves the user where they were.
      if (location.pathname === "/") {
        navigate("/find", { replace: true });
      } else {
        close();
      }
    } else {
      setError("Invalid organization or passcode.");
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ background: "transparent", zIndex: 1000 }}
      onClick={close}
      role="dialog"
      aria-modal="true"
      aria-labelledby="login-modal-title"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 440,
          margin: "0 16px",
          background: "var(--color-login-panel-bg)",
          borderRadius: "var(--radius-login-panel)",
          overflow: "hidden",
          border:
            "var(--width-login-panel-border) solid var(--color-login-panel-border)",
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
        }}
      >
        {/* key={org} forces React to remount the form whenever the selected
            organization changes. The fresh-DOM passcode input causes Chrome's
            password manager to re-run autofill against the new "username"
            (the hidden field below), filling in the saved passcode for the
            newly-selected org instead of leaving the previous org's passcode
            in place. */}
        <form
          key={org || "no-org"}
          onSubmit={handleSubmit}
          autoComplete="on"
          style={{ padding: "24px 28px" }}
        >
          {/* Title */}
          <div
            id="login-modal-title"
            className="font-opensans"
            style={{
              textAlign: "center",
              color: "var(--color-login-label)",
              fontSize: "var(--font-size-login-title)",
              fontWeight: "var(--font-weight-login)",
              marginBottom: 20,
            }}
          >
            Organization Login
          </div>

          {/* Hidden username field so password managers attach the saved
              credential to the right org. */}
          <input
            type="text"
            name="username"
            autoComplete="username"
            value={org}
            onChange={() => {}}
            style={{ display: "none" }}
            tabIndex={-1}
          />

          <label
            htmlFor="login-org"
            className="font-opensans block"
            style={{
              color: "var(--color-login-label)",
              fontSize: "var(--font-size-login-label)",
              fontWeight: "var(--font-weight-login)",
              marginBottom: 6,
            }}
          >
            Select Organization
          </label>
          <select
            id="login-org"
            ref={dropdownRef}
            value={org}
            onChange={(e) => setOrg(e.target.value)}
            className="font-opensans w-full"
            style={{
              background: "var(--color-login-input-bg)",
              color: "var(--color-login-input-text)",
              borderRadius: "var(--radius-login-input)",
              fontSize: "var(--font-size-login-input-org)",
              fontWeight: "var(--font-weight-login)",
              padding: "8px 12px",
              border: "none",
              marginBottom: 16,
              appearance: "none",
              cursor: "pointer",
            }}
          >
            <option value="">— Select —</option>
            {orgList.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>

          <label
            htmlFor="login-passcode"
            className="font-opensans block"
            style={{
              color: "var(--color-login-label)",
              fontSize: "var(--font-size-login-label)",
              fontWeight: "var(--font-weight-login)",
              marginBottom: 6,
            }}
          >
            Passcode
          </label>
          {/* Chrome autofill override — keep the cream input bg + black text
              the rest of the panel uses. */}
          <style>
            {`
              .login-modal-passcode:-webkit-autofill,
              .login-modal-passcode:-webkit-autofill:hover,
              .login-modal-passcode:-webkit-autofill:focus,
              .login-modal-passcode:-webkit-autofill:active {
                -webkit-box-shadow: 0 0 0 30px var(--color-login-input-bg) inset !important;
                -webkit-text-fill-color: var(--color-login-input-text) !important;
                caret-color: var(--color-login-input-text) !important;
                transition: background-color 5000s ease-in-out 0s;
              }
            `}
          </style>
          <input
            id="login-passcode"
            ref={passcodeRef}
            type="password"
            autoComplete="current-password"
            placeholder="Enter Passcode"
            className="login-modal-passcode font-opensans w-full"
            style={{
              background: "var(--color-login-input-bg)",
              color: "var(--color-login-input-text)",
              borderRadius: "var(--radius-login-input)",
              fontSize: "var(--font-size-login-input-passcode)",
              fontWeight: "var(--font-weight-login)",
              padding: "8px 12px",
              border: "none",
              marginBottom: 16,
            }}
          />

          {error && (
            <div
              className="font-opensans"
              style={{
                color: "#FFFFFF",
                background: "#B8001F",
                padding: "8px 10px",
                borderRadius: 4,
                fontSize: 13,
                marginBottom: 12,
                textAlign: "center",
              }}
            >
              {error}
            </div>
          )}

          <div className="flex justify-between" style={{ marginTop: 8 }}>
            <button
              type="button"
              onClick={close}
              className="font-opensans hover:brightness-110"
              style={{
                background: "var(--color-panel-btn-cancel-bg)",
                color: "var(--color-panel-btn-text)",
                border: "none",
                width: "var(--width-panel-btn)",
                height: "var(--height-panel-btn)",
                borderRadius: "var(--radius-panel-btn)",
                fontSize: "var(--font-size-panel-btn)",
                letterSpacing: "var(--letter-spacing-panel-btn)",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="font-opensans hover:brightness-110"
              style={{
                background: "var(--color-panel-btn-ok-bg)",
                color: "var(--color-panel-btn-text)",
                border: "none",
                width: "var(--width-panel-btn)",
                height: "var(--height-panel-btn)",
                borderRadius: "var(--radius-panel-btn)",
                fontSize: "var(--font-size-panel-btn)",
                letterSpacing: "var(--letter-spacing-panel-btn)",
                cursor: "pointer",
              }}
            >
              Login
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
