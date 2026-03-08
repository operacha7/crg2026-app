// src/icons/MapPinIcon.jsx
// Map pin icon with teardrop body and round head
// Supports two states: inactive (gold) and active/selected (green)
// Based on Icons8 map pin design

export const MapPinIcon = ({ size = 32, active = false, className = "" }) => {
  // Red (inactive) vs Green (active/selected)
  const headColor = active ? "#00CC44" : "#ff0000";
  const headColorEnd = active ? "#009930" : "#000000";

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 48 48"
      className={className}
    >
      {/* Needle/shaft */}
      <linearGradient
        id={`pin-shaft-${active ? "active" : "inactive"}`}
        x1="24" x2="24" y1="45.057" y2="22.031"
        gradientUnits="userSpaceOnUse"
      >
        <stop offset=".791" stopColor="#889097" />
        <stop offset=".858" stopColor="#838c93" />
        <stop offset=".937" stopColor="#758089" />
        <stop offset="1" stopColor="#64717c" />
      </linearGradient>
      <path
        fill={`url(#pin-shaft-${active ? "active" : "inactive"})`}
        d="M25,20h-2c0,0,0,19,0,21s1,4,1,4s1-2,1-4S25,20,25,20z"
      />
      {/* Round head */}
      <linearGradient
        id={`pin-head-${active ? "active" : "inactive"}`}
        x1="19.969" x2="28.093" y1="5.61" y2="20.504"
        gradientUnits="userSpaceOnUse"
      >
        <stop offset="0" stopColor={headColor} />
        <stop offset=".443" stopColor={headColor} />
        <stop offset="1" stopColor={headColorEnd} />
      </linearGradient>
      <circle
        cx="24" cy="13" r="9"
        fill={`url(#pin-head-${active ? "active" : "inactive"})`}
      />
    </svg>
  );
};

export default MapPinIcon;
