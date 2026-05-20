// src/components/PanelScrim.js
// Dimmed backdrop ("scrim") painted behind any open panel or modal.
// Renders via a portal to document.body so the scrim's positioning escapes
// stacking-context traps from overflow:hidden ancestors (NavBars, results
// virtualized list, etc.) and reliably covers the full viewport regardless
// of where the panel itself is rendered in the tree.
//
// Click on the scrim invokes onClose, matching the standard "click outside
// to dismiss" behavior. Pass a zIndex one below the panel's own z-index so
// the panel sits on top of the dim layer.

import { createPortal } from "react-dom";

export default function PanelScrim({ isOpen, onClose, zIndex = 998 }) {
  if (!isOpen) return null;
  return createPortal(
    <div
      onClick={onClose}
      className="fixed inset-0"
      style={{
        backgroundColor: "var(--color-panel-scrim-bg)",
        zIndex,
      }}
      aria-hidden="true"
    />,
    document.body
  );
}
