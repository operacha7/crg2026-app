// src/icons/Car2Icon.jsx
// Colorful car icon - shown in results row when driving distances are displayed

export default function Car2Icon({ size = 16, className = "" }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 120 120"
      className={className}
    >
      <rect width="120" height="4" y="82.999" opacity=".35" />
      <circle cx="23" cy="85.999" r="13" opacity=".35" />
      <circle cx="98" cy="85.999" r="13" opacity=".35" />
      <path
        fill="#ff1200"
        d="M92,48.999l-15-23H27l-9.316,9.317C10.645,42.355,5.218,50.837,1.776,60.178L0,65v17.999h120V61l0,0 c-5.169-5.815-12.214-9.632-19.908-10.787L92,48.999z"
      />
      <circle cx="23" cy="82.999" r="13" fill="#0037ff" />
      <circle cx="23" cy="85.999" r="6" opacity=".35" />
      <circle cx="23" cy="82.999" r="6" fill="#a4e2f1" />
      <circle cx="98" cy="82.999" r="13" fill="#0037ff" />
      <circle cx="98" cy="85.999" r="6" opacity=".35" />
      <circle cx="98" cy="82.999" r="6" fill="#a4e2f1" />
      <rect width="6" height="33" x="44" y="50" fill="#ff6c59" />
      <rect width="10" height="5" x="27" y="56" fill="#ffa6a3" />
      <rect width="10" height="5" x="66" y="56" fill="#ffa6a3" />
      <rect width="10" height="3" x="27" y="61" opacity=".2" />
      <rect width="10" height="3" x="66" y="61" opacity=".2" />
      <rect width="67" height="4" x="16" y="50" opacity=".2" />
      <polygon fill="#a4e2f1" points="50,50 83,50 73,33.999 50,33.999" />
      <polygon fill="#a4e2f1" points="44,33.999 31,33.999 16,50 44,50" />
      <rect width="9" height="6" x="111" y="61" fill="#ffc400" />
      <rect width="9" height="3" x="111" y="67" opacity=".35" />
    </svg>
  );
}
