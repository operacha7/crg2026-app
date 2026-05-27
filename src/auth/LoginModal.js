// src/auth/LoginModal.js
// Site-wide login modal that opens whenever the URL carries `?login=1`.
// Triggered from Footer / MobileMenu / HomeNavBar via a relative `?login=1`
// link, so the modal pops up on whatever page the user clicked from rather
// than redirecting to /find first.
//
// Post-login navigation:
//   - From the homepage (/) → forward to /find so the user lands inside the
//     working app (matches the original "log in and start using it" flow).
//   - From anywhere else → stay put. A user already inside the app stays on
//     the page they were viewing; cancelling leaves them on /about, /find,
//     /privacy, etc. with no disruption.
//
// Visual (2026 panel redesign): two-section card. Left side is a maroon
// welcome panel (logo + "Welcome back" + body + brand title); right side is
// the cream form (title in maroon, capitalized teal labels, white inputs with
// beige borders, standard Cancel/Login buttons). Outer panel has a 3px white
// border with a 10px radius. All non-login-specific styling pulls from the
// shared panel-* tokens so this stays in sync with the other panels.

import { useEffect, useState, useRef } from "react";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";

// Caret SVG (chevron down) embedded as a data URI so the <select> can show
// a custom dropdown indicator after appearance:none strips the native one.
// Color matches --color-panel-label-text (#43747D) for visual coherence with
// the labels above the inputs.
const CARET_BG =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'><path fill='%2343747D' d='M0 0l6 8 6-8z'/></svg>\")";

const labelStyle = {
  color: "var(--color-panel-label-text)",
  fontSize: "var(--font-size-panel-label)",
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  marginBottom: 6,
  display: "block",
};

const inputBaseStyle = {
  width: "100%",
  background: "var(--color-panel-input-bg)",
  color: "#222831",
  border: "1px solid var(--color-panel-input-border)",
  borderRadius: "var(--radius-login-input)",
  padding: "10px 12px",
  fontSize: 14,
  outline: "none",
};

export default function LoginModal({ onLoginSuccess }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  // Open whenever ?login=1 is present — even if a user is already signed in.
  // This lets a logged-in user re-open the modal from "Organization Login" to
  // switch to a different organization (no separate switch-org UI needed).
  const isOpen = searchParams.get("login") === "1";

  const [orgList, setOrgList] = useState([]);
  const [org, setOrg] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showPasscode, setShowPasscode] = useState(false);
  const passcodeRef = useRef(null);
  const dropdownRef = useRef(null);

  // Fetch the dropdown labels once on mount via the server-side /list-orgs
  // endpoint. The previous implementation called dataService directly, which
  // returned the full registered_organizations row including org_passcode —
  // that fetch leaked every org's passcode to the browser's Network tab.
  useEffect(() => {
    let cancelled = false;
    fetch("/list-orgs", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data?.success && Array.isArray(data.orgs)) {
          setOrgList(data.orgs);
        }
      })
      .catch((err) => console.error("LoginModal: org list fetch failed", err));
    return () => {
      cancelled = true;
    };
  }, []);

  // Prefetch the MainApp chunk while the user is typing their passcode. A
  // successful login forwards into MainApp (→ /find from the homepage, or
  // stay-in-place from any other page that already mounts MainApp), so we
  // start the chunk download as soon as the modal opens.
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
      setShowPasscode(false);
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

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (submitting) return;
    const enteredPasscode = passcodeRef.current?.value || "";
    if (!org || !enteredPasscode) {
      setError("Invalid organization or passcode.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reg_organization: org, passcode: enteredPasscode }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success || !data?.user) {
        setError(data?.message || "Invalid organization or passcode.");
        return;
      }
      onLoginSuccess(data.user);
      // Logging in from the homepage forwards into the working app; logging
      // in from anywhere else (including in-app re-login to switch orgs)
      // leaves the user where they were.
      if (location.pathname === "/") {
        navigate("/find", { replace: true });
      } else {
        close();
      }
    } catch (err) {
      console.error("LoginModal: /login request failed", err);
      setError("Login service unavailable. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ background: "var(--color-panel-scrim-bg)", zIndex: 1000 }}
      onClick={close}
      role="dialog"
      aria-modal="true"
      aria-labelledby="login-modal-title"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex flex-col md:flex-row"
        style={{
          width: "100%",
          maxWidth: 760,
          margin: "0 16px",
          borderRadius: "var(--radius-login-panel)",
          overflow: "hidden",
          border:
            "var(--width-login-panel-border) solid var(--color-login-panel-border)",
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
        }}
      >
        {/* ---------- LEFT SECTION (maroon welcome panel) ---------- */}
        <div
          className="flex flex-col"
          style={{
            background: "var(--color-login-left-bg)",
            padding: "24px 22px",
            width: "100%",
            // md+ : fixed share of the panel so the right side has room for
            // the form; stacks above the form on narrow screens.
            flex: "0 0 38%",
            minHeight: 240,
          }}
        >
          {/* CRG logo */}
          <img
            src="/images/CRG Logo 2025.webp"
            alt="CRG"
            style={{ width: 32, height: 32, objectFit: "contain", marginBottom: 16 }}
          />

          {/* Welcome header */}
          <div
            className="font-opensans"
            style={{
              color: "var(--color-login-welcome-text)",
              fontSize: "var(--font-size-login-welcome)",
              fontWeight: 700,
              letterSpacing: "0.02em",
              marginBottom: 8,
            }}
          >
            Welcome back
          </div>

          {/* Body paragraph */}
          <p
            className="font-opensans"
            style={{
              color: "var(--color-login-body-text)",
              fontSize: "var(--font-size-login-body)",
              lineHeight: 1.45,
              margin: 0,
            }}
          >
            Sign in to your organization&rsquo;s account to email or text referrals,
            create PDFs or review reports and maps.
          </p>

          {/* Brand title — pinned to the bottom of the maroon section via
              mt-auto so it sits below the body regardless of how short the
              right-side form is. Comfortaa to match the title treatment in
              the NavBar1 / HomeNavBar header. */}
          <div
            className="font-comfortaa mt-auto"
            style={{
              color: "var(--color-login-brand-text)",
              fontSize: "var(--font-size-login-brand)",
              letterSpacing: "0.05em",
              paddingTop: 24,
            }}
          >
            Community Resources Guide Houston
          </div>
        </div>

        {/* ---------- RIGHT SECTION (cream form) ---------- */}
        <div
          style={{
            background: "var(--color-login-panel-bg)",
            flex: "1 1 auto",
            padding: "28px 32px",
          }}
        >
          {/* key={org} forces React to remount the form whenever the selected
              organization changes. The fresh-DOM passcode input causes
              Chrome's password manager to re-run autofill against the new
              "username" (the hidden field below), filling in the saved
              passcode for the newly-selected org instead of leaving the
              previous org's passcode in place. */}
          <form
            key={org || "no-org"}
            onSubmit={handleSubmit}
            autoComplete="on"
          >
            {/* Title */}
            <div
              id="login-modal-title"
              className="font-opensans"
              style={{
                color: "var(--color-login-title-text)",
                fontSize: "var(--font-size-login-title)",
                fontWeight: "var(--font-weight-login)",
                marginBottom: 24,
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

            {/* Organization (dropdown — caret rendered via background SVG
                after appearance:none strips the native control's arrow). */}
            <label htmlFor="login-org" className="font-opensans" style={labelStyle}>
              Organization
            </label>
            <select
              id="login-org"
              ref={dropdownRef}
              value={org}
              onChange={(e) => setOrg(e.target.value)}
              className="font-opensans"
              style={{
                ...inputBaseStyle,
                // Override the shared inputBaseStyle 14px specifically for
                // the Organization picker — applies to both the closed-state
                // displayed name and the open option list. Leaves the
                // Passcode input below at the smaller default.
                fontSize: 16,
                appearance: "none",
                WebkitAppearance: "none",
                MozAppearance: "none",
                cursor: "pointer",
                paddingRight: 32,
                backgroundImage: CARET_BG,
                backgroundRepeat: "no-repeat",
                backgroundPosition: "right 12px center",
                marginBottom: 16,
              }}
            >
              <option value=""></option>
              {orgList.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>

            {/* Passcode. */}
            <label htmlFor="login-passcode" className="font-opensans" style={labelStyle}>
              Passcode
            </label>
            {/* Chrome autofill override — keep the white input bg + dark text
                the rest of the panel uses instead of the browser's pale yellow. */}
            <style>
              {`
                .login-modal-passcode:-webkit-autofill,
                .login-modal-passcode:-webkit-autofill:hover,
                .login-modal-passcode:-webkit-autofill:focus,
                .login-modal-passcode:-webkit-autofill:active {
                  -webkit-box-shadow: 0 0 0 30px var(--color-panel-input-bg) inset !important;
                  -webkit-text-fill-color: #222831 !important;
                  caret-color: #222831 !important;
                  transition: background-color 5000s ease-in-out 0s;
                }
              `}
            </style>
            <div style={{ position: "relative", marginBottom: 20 }}>
              <input
                id="login-passcode"
                ref={passcodeRef}
                type={showPasscode ? "text" : "password"}
                autoComplete="current-password"
                className="login-modal-passcode font-opensans"
                style={{ ...inputBaseStyle, paddingRight: 40 }}
              />
              <button
                type="button"
                onClick={() => setShowPasscode((v) => !v)}
                aria-label={showPasscode ? "Hide passcode" : "Show passcode"}
                title={showPasscode ? "Hide passcode" : "Show passcode"}
                tabIndex={-1}
                style={{
                  position: "absolute",
                  top: 0,
                  right: 0,
                  height: "100%",
                  width: 36,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--color-panel-label-text)",
                  padding: 0,
                }}
              >
                {showPasscode ? (
                  // Eye-off
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a19.77 19.77 0 0 1 4.22-5.06" />
                    <path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a19.86 19.86 0 0 1-3.17 4.19" />
                    <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  // Eye
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>

            {error && (
              <div
                className="font-opensans"
                style={{
                  color: "#FFFFFF",
                  background: "#B71C1C",
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

            {/* Cancel / Login. Uses the shared panel button tokens — same
                styling as every other panel's Cancel / OK pair. */}
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
    </div>
  );
}
