// Vertical line accent icon with rounded corners
// Used for section headers in reports

export default function VerticalLineIcon({ size = 16, color = "currentColor", className = "" }) {
  return (
    <svg
      width={size * 0.625}
      height={size}
      viewBox="0 0 10 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <rect
        x="0"
        y="1"
        width="4"
        height="14"
        rx="2"
        fill={color}
      />
    </svg>
  );
}
