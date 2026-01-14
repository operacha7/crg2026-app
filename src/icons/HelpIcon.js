// src/icons/HelpIcon.js
// Help icon with fixed blue/white gradient - colors are baked in

export function HelpIcon({ size = 40, className = "" }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 4335 4335"
      className={className}
    >
      <defs>
        <linearGradient
          id="helpIconGradient"
          x1="2167.46"
          x2="2167.46"
          y1="4199.46"
          y2="135.46"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#e6e6e6" />
          <stop offset="1" stopColor="#fefefe" />
        </linearGradient>
      </defs>
      <path d="M2167 93c-1146,0 -2074,929 -2074,2074 0,1146 929,2074 2074,2074 1146,0 2074,-929 2074,-2074 0,-1146 -929,-2074 -2074,-2074zm0 76c-1104,0 -1998,895 -1998,1998 0,1104 895,1998 1998,1998 1104,0 1998,-895 1998,-1998 0,-1104 -895,-1998 -1998,-1998z" />
      <circle cx="2167" cy="2167" r="2032" fill="url(#helpIconGradient)" />
      <circle cx="2167" cy="2167" r="1727" fill="#1c56c9" />
      <path
        fill="#fff"
        d="M2167 1024c141,0 257,115 257,257 0,142 -115,257 -257,257 -142,0 -257,-115 -257,-257 0,-142 115,-257 257,-257zm-292 724l139 0 172 0c73,0 132,59 132,132l0 172 0 920 139 0c73,0 132,59 132,132l0 40c0,73 -59,132 -132,132l-139 0 -304 0 -139 0c-73,0 -132,-59 -132,-132l0 -40c0,-73 59,-132 132,-132l139 0 0 -920 -139 0c-73,0 -132,-59 -132,-132l0 -40c0,-73 59,-132 132,-132l0 0z"
      />
    </svg>
  );
}
