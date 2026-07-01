// src/icons/ServiceAreaIcon.jsx
// Clipboard-with-checkmark used for the Service Area (audit) chip in NavBar2's
// Organization mode. Uses currentColor so the chip's active/inactive state
// drives the icon color (white when active, #2E5A88 when inactive).
export const ServiceAreaIcon = ({ size = 22, className = "" }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 50 50"
    className={className}
    fill="currentColor"
    aria-hidden="true"
  >
    <path d="M25,1c-2.21094,0 -4,1.78906 -4,4v1h-9c-1.69922,0 -3,1.30078 -3,3v37c0,1.69922 1.30078,3 3,3h26c1.69922,0 3,-1.30078 3,-3v-37c0,-1.69922 -1.30078,-3 -3,-3h-9v-1c0,-2.21094 -1.78906,-4 -4,-4zM25,3c1.19141,0 2,0.80859 2,2v4h-4v-4c0,-1.19141 0.80859,-2 2,-2zM25,4c-0.55078,0 -1,0.44922 -1,1c0,0.55078 0.44922,1 1,1c0.55078,0 1,-0.44922 1,-1c0,-0.55078 -0.44922,-1 -1,-1zM33.29297,21.29297l1.41406,1.41406l-12.70703,12.70703l-6.70703,-6.70703l1.41406,-1.41406l5.29297,5.29297z" />
  </svg>
);
