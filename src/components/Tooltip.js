// src/components/Tooltip.js
// Instant CSS tooltip component - appears on hover with no delay
// Replaces native browser title attribute which has ~750ms delay

export default function Tooltip({ children, text, position = "top" }) {
  if (!text) return children;

  // Position classes for the tooltip
  const positionClasses = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-1",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-1",
    left: "right-full top-1/2 -translate-y-1/2 mr-1",
    right: "left-full top-1/2 -translate-y-1/2 ml-1",
  };

  return (
    <span className="relative inline-flex group">
      {children}
      <span
        className={`absolute ${positionClasses[position]} px-2 py-1 rounded whitespace-nowrap
                   opacity-0 group-hover:opacity-100 transition-opacity duration-100
                   pointer-events-none z-50`}
        style={{
          backgroundColor: "var(--color-tooltip-bg)",
          color: "var(--color-tooltip-text)",
          fontSize: "var(--font-size-tooltip)",
        }}
      >
        {text}
      </span>
    </span>
  );
}
