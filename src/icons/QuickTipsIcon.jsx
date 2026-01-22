// src/icons/QuickTipsIcon.jsx
// Lightbulb icon - liquid glass style with active/inactive states
// Matches Icons8 liquid glass format used by other vertical nav icons
// Inactive: #b8001f (red), Active: #5cb800 (green)
export const QuickTipsIcon = ({ size = 24, className = "", active = false }) => {
  const accentColor = active ? "#5cb800" : "#b8001f";
  const uniqueId = active ? "quicktips-active" : "quicktips-inactive";

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className={className}
    >
      <defs>
        {/* Main bulb gradient - uses accent color */}
        <linearGradient x1="9.665" y1="9.435" x2="22.335" y2="22.105" gradientUnits="userSpaceOnUse" id={`${uniqueId}-color-1`}>
          <stop offset="0" stopColor={accentColor} stopOpacity="0.94902" />
          <stop offset="1" stopColor={accentColor} stopOpacity="0.50196" />
        </linearGradient>
        {/* Base/screw gradient - purple */}
        <linearGradient x1="13.587" y1="24.387" x2="18.413" y2="29.212" gradientUnits="userSpaceOnUse" id={`${uniqueId}-color-2`}>
          <stop offset="0" stopColor="#7f78a1" stopOpacity="0.95" />
          <stop offset="1" stopColor="#7f78a1" stopOpacity="0.5" />
        </linearGradient>
        {/* Base ring glass overlay */}
        <linearGradient x1="13.845" y1="24.595" x2="18.155" y2="28.905" gradientUnits="userSpaceOnUse" id={`${uniqueId}-color-3`}>
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.4" />
          <stop offset="0.521" stopColor="#ffffff" stopOpacity="0.2" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0.3" />
        </linearGradient>
        {/* Main glass overlay gradient */}
        <linearGradient x1="8.869" y1="10.232" x2="23.131" y2="24.494" gradientUnits="userSpaceOnUse" id={`${uniqueId}-color-4`}>
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.6" />
          <stop offset="0.493" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="0.997" stopColor="#ffffff" stopOpacity="0.3" />
        </linearGradient>
      </defs>
      <g fill="none" fillRule="nonzero" stroke="none" strokeWidth="1" strokeLinecap="butt" strokeLinejoin="miter" strokeMiterlimit="10">
        {/* Main bulb shape */}
        <path
          d="M16,6c-3.866,0 -7,3.134 -7,7c0,2.926 2.639,5.287 3.148,11.277c0.06,0.713 0.589,0.723 0.961,0.723c0.372,0 5.41,0 5.782,0c0.372,0 0.901,-0.01 0.961,-0.723c0.509,-5.99 3.148,-8.351 3.148,-11.277c0,-3.866 -3.134,-7 -7,-7z"
          fill={`url(#${uniqueId}-color-1)`}
        />
        {/* Base/screw cap */}
        <path
          d="M19.471,26.045c0.003,-0.035 0.007,-0.075 0.009,-0.108c0.038,-0.719 -0.483,-0.937 -0.715,-0.937c-0.292,0 -5.238,0 -5.531,0c-0.232,0 -0.753,0.218 -0.714,0.937c0.002,0.033 0.006,0.073 0.009,0.108c-0.304,0.095 -0.529,0.369 -0.529,0.705c0,0.414 0.336,0.75 0.75,0.75c0.001,0 0.004,0 0.005,0c0.07,0.327 0.146,0.618 0.214,0.804c0.299,0.831 1.232,1.696 3.031,1.696c1.799,0 2.732,-0.865 3.031,-1.696c0.067,-0.186 0.143,-0.477 0.214,-0.804c0.001,0 0.004,0 0.005,0c0.414,0 0.75,-0.336 0.75,-0.75c0,-0.336 -0.225,-0.61 -0.529,-0.705z"
          fill={`url(#${uniqueId}-color-2)`}
        />
        {/* Base ring highlight */}
        <path
          d="M19.25,26c-0.194,0 -6.306,0 -6.5,0c-0.414,0 -0.75,0.336 -0.75,0.75c0,0.414 0.336,0.75 0.75,0.75c0.194,0 6.306,0 6.5,0c0.414,0 0.75,-0.336 0.75,-0.75c0,-0.414 -0.336,-0.75 -0.75,-0.75z"
          fill={`url(#${uniqueId}-color-3)`}
        />
        {/* Glass overlay on entire icon */}
        <path
          d="M16,6.5c3.584,0 6.5,2.916 6.5,6.5c0,1.178 -0.476,2.28 -1.078,3.675c-0.791,1.832 -1.776,4.113 -2.068,7.56c-0.019,0.22 -0.023,0.266 -0.463,0.266h-0.126l-0.007,1c0.025,0.003 0.242,0.036 0.218,0.457l-0.004,0.046v0.004l-0.03,0.396l0.379,0.119c0.083,0.026 0.179,0.101 0.179,0.228c0,0.138 -0.112,0.25 -0.255,0.25h-0.404l-0.085,0.395c-0.068,0.315 -0.139,0.585 -0.195,0.74c-0.116,0.319 -0.642,1.364 -2.561,1.364c-1.919,0 -2.445,-1.045 -2.561,-1.366c-0.056,-0.155 -0.127,-0.425 -0.195,-0.74l-0.09,-0.394h-0.404c-0.138,0 -0.25,-0.112 -0.25,-0.25c0,-0.127 0.096,-0.202 0.179,-0.228l0.379,-0.119l-0.03,-0.396l-0.008,-0.094v-0.004c-0.02,-0.374 0.197,-0.407 0.215,-0.41v-1h-0.126c-0.441,0 -0.444,-0.046 -0.463,-0.266c-0.293,-3.447 -1.277,-5.727 -2.068,-7.56c-0.602,-1.393 -1.078,-2.495 -1.078,-3.673c0,-3.584 2.916,-6.5 6.5,-6.5M16,6c-3.866,0 -7,3.134 -7,7c0,2.926 2.639,5.287 3.148,11.277c0.06,0.713 0.589,0.723 0.961,0.723c0.024,0 0.067,0 0.126,0c-0.232,0 -0.753,0.218 -0.714,0.937c0.002,0.033 0.006,0.073 0.009,0.108c-0.305,0.095 -0.53,0.369 -0.53,0.705c0,0.414 0.336,0.75 0.75,0.75c0.001,0 0.004,0 0.005,0c0.07,0.327 0.146,0.618 0.214,0.804c0.299,0.831 1.232,1.696 3.031,1.696c1.799,0 2.732,-0.865 3.031,-1.696c0.067,-0.186 0.143,-0.477 0.214,-0.804c0.001,0 0.004,0 0.005,0c0.414,0 0.75,-0.336 0.75,-0.75c0,-0.336 -0.225,-0.61 -0.529,-0.705c0.003,-0.035 0.007,-0.075 0.009,-0.108c0.038,-0.719 -0.483,-0.937 -0.715,-0.937c0.059,0 0.102,0 0.126,0c0.372,0 0.901,-0.01 0.961,-0.723c0.509,-5.99 3.148,-8.351 3.148,-11.277c0,-3.866 -3.134,-7 -7,-7z"
          fill={`url(#${uniqueId}-color-4)`}
        />
      </g>
    </svg>
  );
};
