// src/icons/ReportsIcon.jsx
// Source: Icons8.com - Liquid glass style with active/inactive states
// Inactive: #b8001f (red), Active: #5cb800 (green)
export const ReportsIcon = ({ size = 24, className = "", active = false }) => {
  const accentColor = active ? "#5cb800" : "#b8001f";
  const uniqueId = active ? "reports-active" : "reports-inactive";

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0,0,256,256"
      className={className}
    >
      <defs>
        <linearGradient x1="1.994" y1="2.494" x2="36.455" y2="36.955" gradientUnits="userSpaceOnUse" id={`${uniqueId}-color-1`}>
          <stop offset="0" stopColor={accentColor} stopOpacity="0.94902" />
          <stop offset="1" stopColor={accentColor} stopOpacity="0.50196" />
        </linearGradient>
        <linearGradient x1="5.129" y1="5.629" x2="26.871" y2="27.371" gradientUnits="userSpaceOnUse" id={`${uniqueId}-color-2`}>
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.6" />
          <stop offset="0.493" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="0.997" stopColor="#ffffff" stopOpacity="0.3" />
        </linearGradient>
        <linearGradient x1="6.672" y1="12.257" x2="13.743" y2="19.328" gradientUnits="userSpaceOnUse" id={`${uniqueId}-color-3`}>
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.8" />
          <stop offset="0.519" stopColor="#ffffff" stopOpacity="0.5" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0.6" />
        </linearGradient>
        <linearGradient x1="10.922" y1="10.484" x2="17.415" y2="16.977" gradientUnits="userSpaceOnUse" id={`${uniqueId}-color-4`}>
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.8" />
          <stop offset="0.519" stopColor="#ffffff" stopOpacity="0.5" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0.6" />
        </linearGradient>
        <linearGradient x1="10.793" y1="17.793" x2="21.207" y2="28.207" gradientUnits="userSpaceOnUse" id={`${uniqueId}-color-5`}>
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.8" />
          <stop offset="0.519" stopColor="#ffffff" stopOpacity="0.5" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0.6" />
        </linearGradient>
        <linearGradient x1="21.293" y1="13.293" x2="24.707" y2="16.707" gradientUnits="userSpaceOnUse" id={`${uniqueId}-color-6`}>
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.8" />
          <stop offset="0.519" stopColor="#ffffff" stopOpacity="0.5" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0.6" />
        </linearGradient>
        <linearGradient x1="21.293" y1="17.293" x2="24.707" y2="20.707" gradientUnits="userSpaceOnUse" id={`${uniqueId}-color-7`}>
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.8" />
          <stop offset="0.519" stopColor="#ffffff" stopOpacity="0.5" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0.6" />
        </linearGradient>
        <linearGradient x1="21.293" y1="9.293" x2="24.707" y2="12.707" gradientUnits="userSpaceOnUse" id={`${uniqueId}-color-8`}>
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.8" />
          <stop offset="0.519" stopColor="#ffffff" stopOpacity="0.5" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0.6" />
        </linearGradient>
      </defs>
      <g fill="none" fillRule="nonzero" stroke="none" strokeWidth="1" strokeLinecap="butt" strokeLinejoin="miter" strokeMiterlimit="10">
        <g transform="scale(8,8)">
          <path d="M29,9c0,-1.657 -1.343,-3 -3,-3h-20c-1.657,0 -3,1.343 -3,3v15c0,1.657 1.343,3 3,3h20c1.657,0 3,-1.343 3,-3z" fill={`url(#${uniqueId}-color-1)`} />
          <path d="M26,6.5c1.378,0 2.5,1.121 2.5,2.5v15c0,1.379 -1.122,2.5 -2.5,2.5h-20c-1.379,0 -2.5,-1.121 -2.5,-2.5v-15c0,-1.379 1.121,-2.5 2.5,-2.5h20M26,6h-20c-1.657,0 -3,1.343 -3,3v15c0,1.657 1.343,3 3,3h20c1.657,0 3,-1.343 3,-3v-15c0,-1.657 -1.343,-3 -3,-3z" fill={`url(#${uniqueId}-color-2)`} />
          <path d="M15.9,16c-0.46,2.28 -2.48,4 -4.9,4c-2.76,0 -5,-2.24 -5,-5c0,-2.42 1.72,-4.44 4,-4.9v4.23c0,0.92 0.75,1.67 1.67,1.67z" fill={`url(#${uniqueId}-color-3)`} />
          <path d="M11,14.333v-4.62c0,-0.399 0.35,-0.716 0.747,-0.667c1.316,0.165 2.549,0.763 3.496,1.711c0.947,0.947 1.545,2.18 1.711,3.496c0.049,0.397 -0.267,0.747 -0.667,0.747h-4.62c-0.368,0 -0.667,-0.299 -0.667,-0.667z" fill={`url(#${uniqueId}-color-4)`} />
          <path d="M25,24h-18c-0.552,0 -1,-0.448 -1,-1v0c0,-0.552 0.448,-1 1,-1h18c0.552,0 1,0.448 1,1v0c0,0.552 -0.448,1 -1,1z" fill={`url(#${uniqueId}-color-5)`} />
          <path d="M25,16h-4c-0.552,0 -1,-0.448 -1,-1v0c0,-0.552 0.448,-1 1,-1h4c0.552,0 1,0.448 1,1v0c0,0.552 -0.448,1 -1,1z" fill={`url(#${uniqueId}-color-6)`} />
          <path d="M25,20h-4c-0.552,0 -1,-0.448 -1,-1v0c0,-0.552 0.448,-1 1,-1h4c0.552,0 1,0.448 1,1v0c0,0.552 -0.448,1 -1,1z" fill={`url(#${uniqueId}-color-7)`} />
          <path d="M25,12h-4c-0.552,0 -1,-0.448 -1,-1v0c0,-0.552 0.448,-1 1,-1h4c0.552,0 1,0.448 1,1v0c0,0.552 -0.448,1 -1,1z" fill={`url(#${uniqueId}-color-8)`} />
        </g>
      </g>
    </svg>
  );
};
