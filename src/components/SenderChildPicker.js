// src/components/SenderChildPicker.js
// "Which location are you?" modal for multi-child registered parents.
//
// A parent login (e.g. Society of St Vincent de Paul) can map to ~50 children
// (conferences) with different names + phones. This modal lets the session
// declare which child it represents so the email/PDF/text footer shows that
// child's name + phone. The choice is remembered per parent (localStorage), so
// this only appears on first login for a multi-child parent — or when the user
// clicks "change" in a send panel. Solo/1:1 parents never see it.
//
// Two modes:
//   - Forced (no current selection): MANDATORY — the only way out is Logout.
//     Clicking the scrim does nothing; there is no Cancel.
//   - Change (already has a selection): dismissable with Cancel / scrim, keeping
//     the existing choice.
//
// The forced prompt waits for `gateReady` (announcements finished) so it doesn't
// stack on top of the announcement popups. See EMAIL_SENDER_FOOTER_PLAN.md.

import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import PanelScrim from "./PanelScrim";
import { useAppData } from "../Contexts/AppDataContext";

export default function SenderChildPicker({ gateReady = true }) {
  const {
    senderChildren,
    selectedSenderChild,
    setSelectedSenderChild,
    senderPickerOpen,
    setSenderPickerOpen,
    onLogout,
  } = useAppData();

  const [filter, setFilter] = useState("");
  // Staged selection: clicking a row highlights it but does NOT commit, so an
  // accidental tap can be corrected before confirming with OK. Seeded from the
  // current selection when the picker opens (so "change" pre-highlights it).
  const [pendingChild, setPendingChild] = useState(null);

  useEffect(() => {
    if (senderPickerOpen) {
      setPendingChild(selectedSenderChild || null);
      setFilter("");
    }
  }, [senderPickerOpen, selectedSenderChild]);

  // Case-insensitive substring filter over child org names. Memoized so typing
  // doesn't re-sort on every render of the (potentially ~50-item) list.
  const visibleChildren = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const list = q
      ? senderChildren.filter((c) => (c.organization || "").toLowerCase().includes(q))
      : senderChildren;
    return [...list].sort((a, b) =>
      (a.organization || "").localeCompare(b.organization || "")
    );
  }, [senderChildren, filter]);

  if (!senderPickerOpen || !gateReady) return null;

  // Forced = no current selection (first-login prompt). The only exit is Logout.
  // When a selection already exists, this is a "change" and Cancel is allowed.
  const isForced = !selectedSenderChild;

  const close = () => {
    setFilter("");
    setSenderPickerOpen(false);
  };

  // Scrim click dismisses only in change mode; forced mode is non-dismissable.
  const handleScrimClose = () => {
    if (!isForced) close();
  };

  // Stage a selection (highlight only). Commit happens on OK.
  const stage = (child) => setPendingChild(child);

  const confirm = () => {
    if (!pendingChild) return;
    setFilter("");
    setSelectedSenderChild(pendingChild); // persists + closes the modal
  };

  return createPortal(
    <>
      <PanelScrim isOpen onClose={handleScrimClose} zIndex={998} />
      <div
        className="fixed left-1/2 top-1/2 shadow-xl overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-label="Which location are you?"
        style={{
          transform: "translate(-50%, -50%)",
          zIndex: 999,
          width: "min(640px, calc(100vw - 24px))",
          borderRadius: "var(--radius-panel)",
          border: "var(--width-panel-border) solid var(--color-panel-border)",
        }}
      >
        {/* Header */}
        <div
          className="flex flex-col items-center justify-center"
          style={{
            backgroundColor: "var(--color-panel-header-bg)",
            height: "var(--height-panel-header)",
            padding: "0 20px",
          }}
        >
          <h3
            className="font-opensans"
            style={{
              color: "var(--color-panel-title)",
              fontSize: "var(--font-size-panel-title)",
              fontWeight: "var(--font-weight-panel-title)",
              letterSpacing: "var(--letter-spacing-panel-title)",
            }}
          >
            Which location are you?
          </h3>
        </div>

        {/* Body */}
        <div style={{ backgroundColor: "var(--color-panel-body-bg)", padding: "20px" }}>
          <p
            className="font-opensans"
            style={{ color: "#4A4F56", fontSize: "14px", lineHeight: 1.5, marginBottom: "14px" }}
          >
            Pick your organization so your name and phone appear on the emails,
            PDFs, and texts you send. You can change this later.
          </p>

          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search your organization…"
            autoFocus
            className="font-opensans w-full"
            style={{
              backgroundColor: "var(--color-panel-input-bg)",
              color: "#222",
              padding: "10px 14px",
              borderRadius: "var(--radius-panel-btn)",
              fontSize: "15px",
              border: "1px solid var(--color-panel-input-border)",
              outline: "none",
              marginBottom: "12px",
            }}
          />

          <div
            style={{
              maxHeight: "300px",
              overflowY: "auto",
              backgroundColor: "#fff",
              borderRadius: "var(--radius-panel-btn)",
              border: "1px solid var(--color-panel-input-border)",
            }}
          >
            {visibleChildren.length === 0 ? (
              <div
                className="font-opensans"
                style={{ padding: "14px", fontSize: "14px", color: "#666", textAlign: "center" }}
              >
                No matches.
              </div>
            ) : (
              visibleChildren.map((child) => {
                const isStaged =
                  pendingChild &&
                  String(pendingChild.id_no) === String(child.id_no);
                return (
                  <button
                    key={child.id_no}
                    type="button"
                    onClick={() => stage(child)}
                    aria-pressed={isStaged}
                    className="font-opensans w-full text-left transition-all duration-150 hover:brightness-95"
                    style={{
                      display: "block",
                      width: "100%",
                      padding: "10px 14px",
                      fontSize: "15px",
                      borderBottom: "1px solid #eee",
                      backgroundColor: isStaged ? "var(--color-navbar3-chip-active-bg)" : "#fff",
                      color: isStaged ? "#fff" : "#222",
                      cursor: "pointer",
                    }}
                  >
                    {/* Name on its own line; phone beneath in muted text so even
                        long names + numbers never wrap awkwardly. */}
                    <div style={{ fontWeight: 600 }}>{child.organization}</div>
                    {child.org_telephone ? (
                      <div
                        style={{
                          color: isStaged ? "#E0F0F3" : "#666",
                          fontSize: "13px",
                          marginTop: "2px",
                        }}
                      >
                        {child.org_telephone}
                      </div>
                    ) : null}
                  </button>
                );
              })
            )}
          </div>

          {/* Left: Logout (forced — a parent session must declare a location)
              or Cancel (change mode, keeps the current choice). Right: OK,
              grayed until a row is staged, commits the staged selection. */}
          <div className="flex justify-between items-center" style={{ marginTop: "16px" }}>
            <button
              type="button"
              onClick={isForced ? onLogout : close}
              className="font-opensans transition-all duration-200 hover:brightness-110"
              style={{
                backgroundColor: "var(--color-panel-btn-cancel-bg)",
                color: "var(--color-panel-btn-text)",
                width: "var(--width-panel-btn)",
                height: "var(--height-panel-btn)",
                borderRadius: "var(--radius-panel-btn)",
                fontSize: "var(--font-size-panel-btn)",
                letterSpacing: "var(--letter-spacing-panel-btn)",
              }}
            >
              {isForced ? "Logout" : "Cancel"}
            </button>

            <button
              type="button"
              onClick={confirm}
              disabled={!pendingChild}
              className="font-opensans transition-all duration-200 hover:brightness-110"
              style={{
                backgroundColor: "var(--color-panel-btn-ok-bg)",
                color: "var(--color-panel-btn-text)",
                width: "var(--width-panel-btn)",
                height: "var(--height-panel-btn)",
                borderRadius: "var(--radius-panel-btn)",
                fontSize: "var(--font-size-panel-btn)",
                letterSpacing: "var(--letter-spacing-panel-btn)",
                opacity: pendingChild ? 1 : 0.4,
                cursor: pendingChild ? "pointer" : "not-allowed",
              }}
            >
              OK
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
