// src/components/Tooltip.js
// Instant CSS tooltip component - appears on hover with no delay
// Replaces native browser title attribute which has ~750ms delay

export default function Tooltip({ children, text, position = "top" }) {
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
  };

  return (
    <span className="relative inline-flex group">
      {children}
      <span
        className={`absolute ${positionClasses[position] || positionClasses.top} px-2 py-1 rounded whitespace-nowrap
                   opacity-0 group-hover:opacity-100 transition-opacity duration-100
                   pointer-events-none`}
        style={{
          backgroundColor: "var(--color-tooltip-bg)",
          color: "var(--color-tooltip-text)",
          fontSize: "var(--font-size-tooltip)",
          zIndex: 9999,
        }}
      >
        {text}
      </span>
    </span>
  );
}
