// src/icons/AnnouncementsIcon.jsx
// Source: Icons8.com - Liquid glass style with active/inactive states
// Inactive: #b8001f (red), Active: #5cb800 (green)
export const AnnouncementsIcon = ({ size = 24, className = "", active = false }) => {
  const accentColor = active ? "#5cb800" : "#b8001f";
  const uniqueId = active ? "announce-active" : "announce-inactive";

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0,0,256,256"
      className={className}
    >
      <defs>
        <linearGradient x1="12.051" y1="4.66" x2="19.949" y2="18.34" gradientUnits="userSpaceOnUse" id={`${uniqueId}-color-1`}>
          <stop offset="0" stopColor={accentColor} stopOpacity="0.94902" />
          <stop offset="1" stopColor={accentColor} stopOpacity="0.50196" />
        </linearGradient>
        <linearGradient x1="10.922" y1="6.422" x2="21.078" y2="16.578" gradientUnits="userSpaceOnUse" id={`${uniqueId}-color-2`}>
          <stop offset="0.002" stopColor="#ffffff" stopOpacity="0.6" />
          <stop offset="0.493" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="0.996" stopColor="#ffffff" stopOpacity="0.3" />
        </linearGradient>
        <linearGradient x1="11.594" y1="10.77" x2="21.906" y2="28.632" gradientUnits="userSpaceOnUse" id={`${uniqueId}-color-3`}>
          <stop offset="0" stopColor={accentColor} stopOpacity="0.94902" />
          <stop offset="1" stopColor={accentColor} stopOpacity="0.50196" />
        </linearGradient>
        <linearGradient x1="8.543" y1="12.043" x2="23.457" y2="26.957" gradientUnits="userSpaceOnUse" id={`${uniqueId}-color-4`}>
          <stop offset="0.002" stopColor="#ffffff" stopOpacity="0.6" />
          <stop offset="0.493" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="0.996" stopColor="#ffffff" stopOpacity="0.3" />
        </linearGradient>
      </defs>
      <g fill="none" fillRule="nonzero" stroke="none" strokeWidth="1" strokeLinecap="butt" strokeLinejoin="miter" strokeMiterlimit="10">
        <g transform="scale(8,8)">
          <path d="M16,20v0c-2.209,0 -4,-1.791 -4,-4v-9c0,-2.209 1.791,-4 4,-4v0c2.209,0 4,1.791 4,4v9c0,2.209 -1.791,4 -4,4z" fill={`url(#${uniqueId}-color-1)`} />
          <path d="M16,3.5c1.93,0 3.5,1.57 3.5,3.5v9c0,1.93 -1.57,3.5 -3.5,3.5c-1.93,0 -3.5,-1.57 -3.5,-3.5v-9c0,-1.93 1.57,-3.5 3.5,-3.5M16,3c-2.209,0 -4,1.791 -4,4v9c0,2.209 1.791,4 4,4c2.209,0 4,-1.791 4,-4v-9c0,-2.209 -1.791,-4 -4,-4z" fill={`url(#${uniqueId}-color-2)`} />
          <g>
            <path d="M24,13c-0.553,0 -1,0.448 -1,1v2c0,3.86 -3.141,7 -7,7c-3.859,0 -7,-3.14 -7,-7v-2c0,-0.552 -0.447,-1 -1,-1c-0.553,0 -1,0.448 -1,1v2c0,4.624 3.507,8.442 8,8.941v2.059h-4c-0.553,0 -1,0.448 -1,1c0,0.552 0.447,1 1,1h10c0.553,0 1,-0.448 1,-1c0,-0.552 -0.447,-1 -1,-1h-4v-2.059c4.493,-0.5 8,-4.317 8,-8.941v-2c0,-0.552 -0.447,-1 -1,-1z" fill={`url(#${uniqueId}-color-3)`} />
            <path d="M24,13.5c0.276,0 0.5,0.224 0.5,0.5v2c0,4.335 -3.248,7.965 -7.555,8.444l-0.445,0.05v0.447v2.059v0.5h0.5h4c0.276,0 0.5,0.224 0.5,0.5c0,0.276 -0.224,0.5 -0.5,0.5h-10c-0.276,0 -0.5,-0.224 -0.5,-0.5c0,-0.276 0.224,-0.5 0.5,-0.5h4h0.5v-0.5v-2.059v-0.447l-0.445,-0.049c-4.307,-0.48 -7.555,-4.11 -7.555,-8.445v-2c0,-0.276 0.224,-0.5 0.5,-0.5c0.276,0 0.5,0.224 0.5,0.5v2c0,4.136 3.365,7.5 7.5,7.5c4.135,0 7.5,-3.364 7.5,-7.5v-2c0,-0.276 0.224,-0.5 0.5,-0.5M24,13c-0.553,0 -1,0.448 -1,1v2c0,3.86 -3.141,7 -7,7c-3.859,0 -7,-3.14 -7,-7v-2c0,-0.552 -0.447,-1 -1,-1c-0.553,0 -1,0.448 -1,1v2c0,4.624 3.507,8.442 8,8.941v2.059h-4c-0.553,0 -1,0.448 -1,1c0,0.552 0.447,1 1,1h10c0.553,0 1,-0.448 1,-1c0,-0.552 -0.447,-1 -1,-1h-4v-2.059c4.493,-0.5 8,-4.317 8,-8.941v-2c0,-0.552 -0.447,-1 -1,-1z" fill={`url(#${uniqueId}-color-4)`} />
          </g>
        </g>
      </g>
    </svg>
  );
};
