// src/components/Tooltip.js
// Instant CSS tooltip component - appears on hover with no delay
// Replaces native browser title attribute which has ~750ms delay

export default function Tooltip({ children, text, position = "top", multiline = false, maxWidth }) {
  if (!text) return children;

  // Position classes for the tooltip
  // Uses "left-0" for counters to prevent off-screen overflow
  const positionClasses = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
    // Special position for elements near right edge of screen
    "bottom-left": "top-full right-0 mt-2",
    // Special position for elements near left edge of screen
    "bottom-right": "top-full left-0 mt-2",
  };

  // multiline=true triggers wrapping with a max-width cap. `maxWidth` overrides
  // the default 320px so callers with side-positioned (left/right) tooltips
  // can keep the bubble short enough to fit within a narrow host element's
  // height (e.g. NavBar2's 70px row needs ~600px to limit to 2–3 lines).
  //
  // When the caller passes `maxWidth` we also set width: max-content so the
  // bubble grows to its natural unwrapped width (capped by maxWidth) instead
  // of shrink-to-fitting to the narrow trigger's width. Without this the
  // tooltip would wrap at the trigger's width regardless of maxWidth, since
  // it's absolutely positioned inside an `inline-flex` parent.
  const effectiveMaxWidth = maxWidth || "320px";
  const multilineStyle = multiline
    ? {
        maxWidth: effectiveMaxWidth,
        whiteSpace: "normal",
        lineHeight: 1.4,
        ...(maxWidth ? { width: "max-content" } : {}),
      }
    : {};

  return (
    <span className="relative inline-flex group">
      {children}
      <span
        className={`absolute ${positionClasses[position] || positionClasses.top} px-2 py-1 rounded ${multiline ? "" : "whitespace-nowrap"}
                   opacity-0 group-hover:opacity-100 transition-opacity duration-100
                   pointer-events-none`}
        style={{
          backgroundColor: "var(--color-tooltip-bg)",
          color: "var(--color-tooltip-text)",
          fontSize: "var(--font-size-tooltip)",
          zIndex: 9999,
          ...multilineStyle,
        }}
      >
        {text}
      </span>
    </span>
  );
}
