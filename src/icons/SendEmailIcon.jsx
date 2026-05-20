// src/icons/SendEmailIcon.jsx
// Source: Icons8.com - Envelope outline; takes a `color` prop (defaults to currentColor)
// so the parent can switch between active/inactive shades.
export const SendEmailIcon = ({ size = 24, color = "currentColor", className = "" }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 256 256"
    className={className}
  >
    <g fill={color} fillRule="nonzero" stroke="none">
      <g transform="scale(5.12,5.12)">
        <path d="M0,7v36h50v-36zM2,9h46v2.53125l-23,18.1875l-23,-18.1875zM2,14.09375l22.375,17.6875c0.36719,0.29297 0.88281,0.29297 1.25,0l22.375,-17.6875v26.90625h-46z" />
      </g>
    </g>
  </svg>
);
