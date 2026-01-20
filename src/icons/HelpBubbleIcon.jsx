// src/icons/HelpBubbleIcon.jsx
// Speech bubble with question mark - liquid glass style with active/inactive states
// Matches Icons8 liquid glass format used by other vertical nav icons
// Inactive: #b8001f (red), Active: #5cb800 (green)
export const HelpBubbleIcon = ({ size = 24, className = "", active = false }) => {
  const accentColor = active ? "#5cb800" : "#b8001f";
  const uniqueId = active ? "helpbubble-active" : "helpbubble-inactive";

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className={className}
    >
      <defs>
        {/* Main bubble gradient */}
        <linearGradient x1="4" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse" id={`${uniqueId}-color-1`}>
          <stop offset="0" stopColor={accentColor} stopOpacity="0.94902" />
          <stop offset="1" stopColor={accentColor} stopOpacity="0.50196" />
        </linearGradient>
        {/* Glass overlay gradient */}
        <linearGradient x1="4" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse" id={`${uniqueId}-color-2`}>
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.6" />
          <stop offset="0.493" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="0.997" stopColor="#ffffff" stopOpacity="0.3" />
        </linearGradient>
        {/* Question mark gradient */}
        <linearGradient x1="12" y1="8" x2="20" y2="20" gradientUnits="userSpaceOnUse" id={`${uniqueId}-color-3`}>
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0.7" />
        </linearGradient>
      </defs>
      <g fill="none" fillRule="nonzero" stroke="none" strokeWidth="1" strokeLinecap="butt" strokeLinejoin="miter" strokeMiterlimit="10">
        {/* Speech bubble shape */}
        <path
          d="M26,4H6C4.343,4,3,5.343,3,7v14c0,1.657,1.343,3,3,3h3v5l6-5h11c1.657,0,3-1.343,3-3V7C29,5.343,27.657,4,26,4z"
          fill={`url(#${uniqueId}-color-1)`}
        />
        {/* Glass overlay on bubble */}
        <path
          d="M26,4.5H6C4.619,4.5,3.5,5.619,3.5,7v14c0,1.381,1.119,2.5,2.5,2.5h3.5v4.293L14.793,23.5H26c1.381,0,2.5-1.119,2.5-2.5V7C28.5,5.619,27.381,4.5,26,4.5z M26,4H6C4.343,4,3,5.343,3,7v14c0,1.657,1.343,3,3,3h3v5l6-5h11c1.657,0,3-1.343,3-3V7C29,5.343,27.657,4,26,4z"
          fill={`url(#${uniqueId}-color-2)`}
        />
        {/* Question mark */}
        <g fill={`url(#${uniqueId}-color-3)`}>
          {/* Question mark curve */}
          <path d="M16,8c-2.761,0-5,2.015-5,4.5c0,0.828,0.672,1.5,1.5,1.5s1.5-0.672,1.5-1.5c0-0.827,0.897-1.5,2-1.5s2,0.673,2,1.5c0,0.652-0.418,0.978-1.244,1.537C15.79,14.723,14.5,15.578,14.5,17.5c0,0.828,0.672,1.5,1.5,1.5s1.5-0.672,1.5-1.5c0-0.652,0.418-0.978,1.244-1.537C19.71,15.277,21,14.422,21,12.5C21,10.015,18.761,8,16,8z" />
          {/* Question mark dot */}
          <circle cx="16" cy="21.5" r="1.5" />
        </g>
      </g>
    </svg>
  );
};
