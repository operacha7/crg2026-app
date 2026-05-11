// src/icons/HomeMarkerIcon.jsx
// Simple map-pin teardrop used for the Address chip in NavBar2.
// (Kept under the HomeMarkerIcon name so the import wiring doesn't churn.)
// Uses currentColor + evenodd so the chip's color drives the icon and the inner circle reads as a cutout.
export const HomeMarkerIcon = ({ size = 22, className = "" }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 50 50"
    className={className}
    fill="currentColor"
    fillRule="evenodd"
    aria-hidden="true"
  >
    <path d="M 25 1 C 16.179688 1 9 8.179688 9 17 C 9 31.113281 23.628906 47.945313 24.25 48.65625 C 24.441406 48.875 24.710938 49 25 49 C 25.308594 48.980469 25.558594 48.875 25.75 48.65625 C 26.371094 47.933594 41 30.8125 41 17 C 41 8.179688 33.820313 1 25 1 Z M 25 12 C 28.3125 12 31 14.6875 31 18 C 31 21.3125 28.3125 24 25 24 C 21.6875 24 19 21.3125 19 18 C 19 14.6875 21.6875 12 25 12 Z" />
  </svg>
);
