// src/icons/PrivacyPolicyIcon.jsx
// Source: Icons8.com - Liquid glass style with active/inactive states
// Inactive: #b8001f (red), Active: #5cb800 (green)
export const PrivacyPolicyIcon = ({ size = 24, className = "", active = false }) => {
  const accentColor = active ? "#5cb800" : "#b8001f";
  const uniqueId = active ? "privacy-active" : "privacy-inactive";

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0,0,256,256"
      className={className}
    >
      <defs>
        <linearGradient x1="7.863" y1="5.244" x2="26.215" y2="23.596" gradientUnits="userSpaceOnUse" id={`${uniqueId}-color-1`}>
          <stop offset="0" stopColor={accentColor} stopOpacity="0.94902" />
          <stop offset="1" stopColor={accentColor} stopOpacity="0.50196" />
        </linearGradient>
        <linearGradient x1="7.863" y1="5.244" x2="26.215" y2="23.596" gradientUnits="userSpaceOnUse" id={`${uniqueId}-color-2`}>
          <stop offset="0.002" stopColor="#ffffff" stopOpacity="0.6" />
          <stop offset="0.493" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="0.996" stopColor="#ffffff" stopOpacity="0.30196" />
        </linearGradient>
        <linearGradient x1="13.948" y1="8.961" x2="18.06" y2="13.072" gradientUnits="userSpaceOnUse" id={`${uniqueId}-color-3`}>
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.8" />
          <stop offset="0.519" stopColor="#ffffff" stopOpacity="0.50196" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0.6" />
        </linearGradient>
        <linearGradient x1="12.536" y1="16.093" x2="19.464" y2="23.021" gradientUnits="userSpaceOnUse" id={`${uniqueId}-color-4`}>
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.8" />
          <stop offset="0.519" stopColor="#ffffff" stopOpacity="0.50196" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0.6" />
        </linearGradient>
      </defs>
      <g fill="none" fillRule="nonzero" stroke="none" strokeWidth="1" strokeLinecap="butt" strokeLinejoin="miter" strokeMiterlimit="10">
        <g transform="scale(8,8)">
          <path d="M16.009,29.29c0.187,0 0.509,-0.051 0.882,-0.237c7.616,-3.85 10.109,-5.971 10.109,-10.89v-10.042c0,-1.357 -0.645,-1.781 -1.679,-2.222c-1.357,-0.577 -6.853,-2.544 -8.193,-3.002c-0.356,-0.119 -0.746,-0.187 -1.119,-0.187c-0.39,0 -0.78,0.085 -1.136,0.187c-1.357,0.407 -6.836,2.443 -8.193,3.002c-1.035,0.424 -1.679,0.865 -1.679,2.222v10.042c0,4.919 2.646,6.768 10.126,10.89c0.356,0.203 0.678,0.237 0.882,0.237z" fill={`url(#${uniqueId}-color-1)`} />
          <path d="M16.009,3.21c0.313,0 0.646,0.056 0.958,0.16c1.407,0.481 6.83,2.424 8.158,2.989c0.956,0.408 1.375,0.697 1.375,1.762v10.042c0,4.397 -1.93,6.447 -9.833,10.443c-0.352,0.176 -0.61,0.185 -0.658,0.185c-0.221,0 -0.435,-0.058 -0.641,-0.175c-7.457,-4.109 -9.868,-5.826 -9.868,-10.452v-10.042c0,-1.017 0.359,-1.345 1.37,-1.76c1.397,-0.576 6.823,-2.589 8.139,-2.984c0.4,-0.115 0.717,-0.168 1,-0.168M16.009,2.71c-0.39,0 -0.78,0.085 -1.136,0.187c-1.357,0.407 -6.836,2.443 -8.193,3.002c-1.035,0.424 -1.679,0.865 -1.679,2.222v10.042c0,4.919 2.646,6.768 10.126,10.89c0.356,0.204 0.678,0.237 0.882,0.237c0.187,0 0.509,-0.051 0.882,-0.237c7.616,-3.85 10.109,-5.971 10.109,-10.89v-10.042c0,-1.357 -0.645,-1.781 -1.679,-2.222c-1.357,-0.577 -6.853,-2.544 -8.193,-3.002c-0.356,-0.119 -0.746,-0.187 -1.119,-0.187z" fill={`url(#${uniqueId}-color-2)`} />
          <path d="M16.004,14.067c1.477,0 2.786,-1.344 2.786,-3.078c0,-1.734 -1.309,-2.989 -2.786,-2.989c-1.477,0 -2.795,1.282 -2.795,3.007c0.001,1.715 1.31,3.06 2.795,3.06z" fill={`url(#${uniqueId}-color-3)`} />
          <path d="M11.203,21h9.594c0.799,0 1.276,-0.367 1.276,-0.982c0,-1.864 -2.332,-4.434 -6.069,-4.434c-3.746,0 -6.078,2.571 -6.078,4.434c0.001,0.615 0.478,0.982 1.277,0.982z" fill={`url(#${uniqueId}-color-4)`} />
        </g>
      </g>
    </svg>
  );
};
