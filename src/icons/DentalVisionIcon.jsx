// src/icons/DentalVisionIcon.jsx
// Temporary icon for Dental & Vision assistance type
// Tooth with glasses - uses currentColor for dynamic styling
export const DentalVisionIcon = ({ size = 24, className = "" }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 50 50"
    className={className}
    fill="currentColor"
  >
    {/* Glasses on top */}
    {/* Left lens */}
    <circle cx="16" cy="10" r="6" fill="none" stroke="currentColor" strokeWidth="2" />
    {/* Right lens */}
    <circle cx="34" cy="10" r="6" fill="none" stroke="currentColor" strokeWidth="2" />
    {/* Bridge */}
    <path d="M22 10 L28 10" fill="none" stroke="currentColor" strokeWidth="2" />
    {/* Left temple hint */}
    <path d="M10 10 L8 8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    {/* Right temple hint */}
    <path d="M40 10 L42 8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />

    {/* Tooth below */}
    <path
      d="M25 18C20 18 17 20 15 23C13 26 14 30 15 34C16 38 17 42 18 45C18.5 47 19.5 48 21 48C23 48 23.5 46 24 43C24.5 41 25 39 25 39C25 39 25.5 41 26 43C26.5 46 27 48 29 48C30.5 48 31.5 47 32 45C33 42 34 38 35 34C36 30 37 26 35 23C33 20 30 18 25 18ZM25 21C29 21 31 22.5 32.5 25C33.5 27 33 30 32 34C31 38 30 42 29.5 44C29.3 45 29 45.5 29 45.5C28.5 45.5 28 44 27.5 42C27 40 26.5 37 25 37C23.5 37 23 40 22.5 42C22 44 21.5 45.5 21 45.5C21 45.5 20.7 45 20.5 44C20 42 19 38 18 34C17 30 16.5 27 17.5 25C19 22.5 21 21 25 21Z"
      fillRule="evenodd"
    />
  </svg>
);
