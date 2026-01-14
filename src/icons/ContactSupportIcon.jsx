// src/icons/ContactSupportIcon.jsx
// Source: Icons8.com - Liquid glass style with active/inactive states
// Inactive: #b8001f (red), Active: #5cb800 (green)
export const ContactSupportIcon = ({ size = 24, className = "", active = false }) => {
  const accentColor = active ? "#5cb800" : "#b8001f";
  const uniqueId = active ? "contact-active" : "contact-inactive";

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0,0,256,256"
      className={className}
    >
      <defs>
        <linearGradient x1="5.086" y1="5.086" x2="26.914" y2="26.914" gradientUnits="userSpaceOnUse" id={`${uniqueId}-color-1`}>
          <stop offset="0" stopColor={accentColor} stopOpacity="0.94902" />
          <stop offset="1" stopColor={accentColor} stopOpacity="0.50196" />
        </linearGradient>
        <linearGradient x1="5.086" y1="5.086" x2="26.914" y2="26.914" gradientUnits="userSpaceOnUse" id={`${uniqueId}-color-2`}>
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.6" />
          <stop offset="0.493" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="0.997" stopColor="#ffffff" stopOpacity="0.3" />
        </linearGradient>
        <linearGradient x1="9.948" y1="0.282" x2="22.052" y2="12.386" gradientUnits="userSpaceOnUse" id={`${uniqueId}-color-3`}>
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.8" />
          <stop offset="0.519" stopColor="#ffffff" stopOpacity="0.5" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0.6" />
        </linearGradient>
      </defs>
      <g fill="none" fillRule="nonzero" stroke="none" strokeWidth="1" strokeLinecap="butt" strokeLinejoin="miter" strokeMiterlimit="10">
        <g transform="scale(8,8)">
          <path d="M27,26h-22c-1.105,0 -2,-0.895 -2,-2v-16c0,-1.105 0.895,-2 2,-2h22c1.105,0 2,0.895 2,2v16c0,1.105 -0.895,2 -2,2z" fill={`url(#${uniqueId}-color-1)`} />
          <path d="M27,6.5c0.827,0 1.5,0.673 1.5,1.5v16c0,0.827 -0.673,1.5 -1.5,1.5h-22c-0.827,0 -1.5,-0.673 -1.5,-1.5v-16c0,-0.827 0.673,-1.5 1.5,-1.5h22M27,6h-22c-1.105,0 -2,0.895 -2,2v16c0,1.105 0.895,2 2,2h22c1.105,0 2,-0.895 2,-2v-16c0,-1.105 -0.895,-2 -2,-2z" fill={`url(#${uniqueId}-color-2)`} />
          <path d="M14.811,16.521c0.666,0.623 1.713,0.623 2.379,0l10.915,-10.187c-0.317,-0.21 -0.696,-0.334 -1.105,-0.334h-22c-0.409,0 -0.788,0.124 -1.105,0.334z" fill={`url(#${uniqueId}-color-3)`} />
        </g>
      </g>
    </svg>
  );
};
