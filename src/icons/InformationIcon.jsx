// src/icons/InformationIcon.jsx
// Source: Icons8.com - Liquid glass style with active/inactive states
// Inactive: #b8001f (red), Active: #5cb800 (green)
export const InformationIcon = ({ size = 24, className = "", active = false }) => {
  const accentColor = active ? "#5cb800" : "#b8001f";
  const uniqueId = active ? "info-active" : "info-inactive";

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0,0,256,256"
      className={className}
    >
      <defs>
        <linearGradient x1="14.025" y1="2.025" x2="18.975" y2="6.975" gradientUnits="userSpaceOnUse" id={`${uniqueId}-color-1`}>
          <stop offset="0" stopColor={accentColor} stopOpacity="0.94902" />
          <stop offset="1" stopColor={accentColor} stopOpacity="0.50196" />
        </linearGradient>
        <linearGradient x1="14.025" y1="2.025" x2="18.975" y2="6.975" gradientUnits="userSpaceOnUse" id={`${uniqueId}-color-2`}>
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.6" />
          <stop offset="0.493" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="0.997" stopColor="#ffffff" stopOpacity="0.3" />
        </linearGradient>
        <linearGradient x1="8.439" y1="13.439" x2="23.061" y2="28.061" gradientUnits="userSpaceOnUse" id={`${uniqueId}-color-3`}>
          <stop offset="0" stopColor={accentColor} stopOpacity="0.94902" />
          <stop offset="1" stopColor={accentColor} stopOpacity="0.50196" />
        </linearGradient>
        <linearGradient x1="8.439" y1="13.439" x2="23.061" y2="28.061" gradientUnits="userSpaceOnUse" id={`${uniqueId}-color-4`}>
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.6" />
          <stop offset="0.493" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="0.997" stopColor="#ffffff" stopOpacity="0.3" />
        </linearGradient>
      </defs>
      <g fill="none" fillRule="nonzero" stroke="none" strokeWidth="1" strokeLinecap="butt" strokeLinejoin="miter" strokeMiterlimit="10">
        <g transform="scale(8,8)">
          <path d="M16.5,1c-1.933,0 -3.5,1.567 -3.5,3.5c0,1.933 1.567,3.5 3.5,3.5c1.933,0 3.5,-1.567 3.5,-3.5c0,-1.933 -1.567,-3.5 -3.5,-3.5z" fill={`url(#${uniqueId}-color-1)`} />
          <path d="M16.5,1.5c1.654,0 3,1.346 3,3c0,1.654 -1.346,3 -3,3c-1.654,0 -3,-1.346 -3,-3c0,-1.654 1.346,-3 3,-3M16.5,1c-1.933,0 -3.5,1.567 -3.5,3.5c0,1.933 1.567,3.5 3.5,3.5c1.933,0 3.5,-1.567 3.5,-3.5c0,-1.933 -1.567,-3.5 -3.5,-3.5z" fill={`url(#${uniqueId}-color-2)`} />
          <path d="M19,26v-14.5c0,-0.828 -0.672,-1.5 -1.5,-1.5h-5c-0.828,0 -1.5,0.672 -1.5,1.5v1c0,0.828 0.672,1.5 1.5,1.5h1.5v12h-1.5c-0.828,0 -1.5,0.672 -1.5,1.5v1c0,0.828 0.672,1.5 1.5,1.5h8c0.828,0 1.5,-0.672 1.5,-1.5v-1c0,-0.828 -0.672,-1.5 -1.5,-1.5z" fill={`url(#${uniqueId}-color-3)`} />
          <path d="M17.5,10.5c0.551,0 1,0.449 1,1v14.5v0.5h0.5h1.5c0.551,0 1,0.449 1,1v1c0,0.551 -0.449,1 -1,1h-8c-0.551,0 -1,-0.449 -1,-1v-1c0,-0.551 0.449,-1 1,-1h1.5h0.5v-0.5v-12v-0.5h-0.5h-1.5c-0.551,0 -1,-0.449 -1,-1v-1c0,-0.551 0.449,-1 1,-1h5M17.5,10h-5c-0.828,0 -1.5,0.672 -1.5,1.5v1c0,0.828 0.672,1.5 1.5,1.5h1.5v12h-1.5c-0.828,0 -1.5,0.672 -1.5,1.5v1c0,0.828 0.672,1.5 1.5,1.5h8c0.828,0 1.5,-0.672 1.5,-1.5v-1c0,-0.828 -0.672,-1.5 -1.5,-1.5h-1.5v-14.5c0,-0.828 -0.672,-1.5 -1.5,-1.5z" fill={`url(#${uniqueId}-color-4)`} />
        </g>
      </g>
    </svg>
  );
};
