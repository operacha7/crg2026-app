// src/icons/HomeIcon.js
// Source: Icons8.com - Liquid glass style with active/inactive states
// Inactive: #b8001f (red), Active: house=#948979 (tan), chimney/roof=#5cb800 (green)
import { useId } from 'react';

export const HomeIcon = ({ size = 24, active = false }) => {
  // Generate unique IDs for gradients to avoid conflicts with multiple icons
  const id = useId();
  const gradientId1 = `home-color-1-${id}`;
  const gradientId2 = `home-color-2-${id}`;
  const gradientId3 = `home-color-3-${id}`;
  const gradientId4 = `home-color-4-${id}`;
  const gradientId5 = `home-color-5-${id}`;

  // In inactive state, everything is red (#b8001f)
  // In active state, house body is tan (#948979), chimney/roof are green (#5cb800)
  const houseColor = active ? '#948979' : '#b8001f';
  const accentColor = active ? '#5cb800' : '#b8001f';

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 32 32"
    >
      <defs>
        {/* House body gradient - tan when active, red when inactive */}
        <linearGradient x1="7.219" y1="11.901" x2="24.781" y2="29.464" gradientUnits="userSpaceOnUse" id={gradientId1}>
          <stop offset="0" stopColor={houseColor} stopOpacity="0.94902" />
          <stop offset="1" stopColor={houseColor} stopOpacity="0.50196" />
        </linearGradient>
        {/* Chimney - green when active, red when inactive */}
        <linearGradient x1="24.214" y1="4.373" x2="29.501" y2="9.659" gradientUnits="userSpaceOnUse" id={gradientId2}>
          <stop offset="0" stopColor={accentColor} stopOpacity="0.94902" />
          <stop offset="1" stopColor={accentColor} stopOpacity="0.50196" />
        </linearGradient>
        {/* Door - white (unchanged) */}
        <linearGradient x1="11.396" y1="18.189" x2="20.604" y2="27.396" gradientUnits="userSpaceOnUse" id={gradientId3}>
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.8" />
          <stop offset="0.519" stopColor="#ffffff" stopOpacity="0.5" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0.6" />
        </linearGradient>
        {/* Roof outline - green when active, red when inactive */}
        <linearGradient x1="8.189" y1="6.619" x2="23.811" y2="22.24" gradientUnits="userSpaceOnUse" id={gradientId4}>
          <stop offset="0" stopColor={accentColor} stopOpacity="0.94902" />
          <stop offset="1" stopColor={accentColor} stopOpacity="0.50196" />
        </linearGradient>
        {/* Highlight overlay - white (unchanged) */}
        <linearGradient x1="7.696" y1="7.112" x2="27.414" y2="26.831" gradientUnits="userSpaceOnUse" id={gradientId5}>
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.6" />
          <stop offset="0.493" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="0.997" stopColor="#ffffff" stopOpacity="0.3" />
        </linearGradient>
      </defs>
      <g fill="none" fillRule="nonzero" stroke="none" strokeWidth="1" strokeLinecap="butt" strokeLinejoin="miter" strokeMiterlimit="10">
        {/* House body */}
        <path d="M28,15.12v9.88c0,1.66 -1.34,3 -3,3h-18c-1.66,0 -3,-1.34 -3,-3v-9.88l11.67,-10.01c0.19,-0.16 0.47,-0.16 0.66,0z" fill={`url(#${gradientId1})`} />
        {/* Chimney */}
        <path d="M28,5v6.16l-4,-3.43v-2.73c0,-0.55 0.45,-1 1,-1h2c0.55,0 1,0.45 1,1z" fill={`url(#${gradientId2})`} />
        {/* Door */}
        <path d="M12,28v-10c0,-0.552 0.448,-1 1,-1h6c0.552,0 1,0.448 1,1v10z" fill={`url(#${gradientId3})`} />
        {/* Roof outline */}
        <path d="M29.5,15.93c-0.346,0 -0.693,-0.119 -0.976,-0.361l-12.198,-10.457c-0.188,-0.161 -0.463,-0.161 -0.651,0l-12.199,10.456c-0.628,0.539 -1.576,0.467 -2.115,-0.163c-0.54,-0.629 -0.466,-1.576 0.163,-2.115l12.198,-10.456c1.319,-1.132 3.236,-1.132 4.556,0l12.198,10.457c0.629,0.539 0.702,1.486 0.163,2.115c-0.297,0.346 -0.717,0.524 -1.139,0.524z" fill={`url(#${gradientId4})`} />
        {/* Highlight overlay */}
        <path d="M16,2.486c0.711,0 1.405,0.259 1.952,0.728l5.722,4.905l0.826,0.708v-1.087v-2.74c0,-0.276 0.224,-0.5 0.5,-0.5h2c0.276,0 0.5,0.224 0.5,0.5v6.168v0.23l0.175,0.15l2.476,2.123c0.203,0.174 0.326,0.416 0.346,0.682c0.021,0.266 -0.064,0.524 -0.238,0.727c-0.19,0.222 -0.467,0.349 -0.759,0.349c-0.238,0 -0.469,-0.085 -0.65,-0.241l-0.524,-0.449l-0.826,-0.707v1.087v9.881c0,1.378 -1.122,2.5 -2.5,2.5h-18c-1.378,0 -2.5,-1.122 -2.5,-2.5v-9.881v-1.087l-0.825,0.708l-0.524,0.449c-0.181,0.155 -0.412,0.241 -0.651,0.241c-0.293,0 -0.569,-0.127 -0.759,-0.349c-0.174,-0.203 -0.258,-0.461 -0.238,-0.727c0.021,-0.266 0.144,-0.509 0.346,-0.682l12.199,-10.458c0.547,-0.47 1.241,-0.728 1.952,-0.728M16,1.986c-0.809,0 -1.618,0.283 -2.278,0.849l-12.198,10.456c-0.629,0.539 -0.702,1.486 -0.163,2.115c0.297,0.346 0.717,0.524 1.139,0.524c0.346,0 0.693,-0.119 0.976,-0.361l0.524,-0.45v9.881c0,1.66 1.34,3 3,3h18c1.66,0 3,-1.34 3,-3v-9.881l0.524,0.449c0.283,0.243 0.63,0.361 0.976,0.361c0.422,0 0.843,-0.178 1.139,-0.524c0.54,-0.629 0.466,-1.576 -0.163,-2.115l-2.476,-2.122v-6.168c0,-0.55 -0.45,-1 -1,-1h-2c-0.55,0 -1,0.45 -1,1v2.74l-5.722,-4.905c-0.66,-0.566 -1.469,-0.849 -2.278,-0.849z" fill={`url(#${gradientId5})`} />
      </g>
    </svg>
  );
};
