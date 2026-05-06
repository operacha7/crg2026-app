// src/icons/LogoutIcon.jsx
// Liquid-glass logout icon for the vertical nav bar. Always rendered in gold
// (#FFB302) — there's no active/inactive state because clicking it logs the
// user out and immediately routes back to the public homepage where the
// vertical nav doesn't render.
//
// Gradient IDs are derived from a per-render counter so multiple instances on
// the same page don't collide on a global "color-1" id.
import { useId } from "react";

export const LogoutIcon = ({ size = 24, className = "" }) => {
  const uid = useId();
  const id1 = `logout-${uid}-1`;
  const id2 = `logout-${uid}-2`;
  const id3 = `logout-${uid}-3`;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className={className}
    >
      <defs>
        <linearGradient
          x1="3.891"
          y1="5.891"
          x2="24.109"
          y2="26.109"
          gradientUnits="userSpaceOnUse"
          id={id1}
        >
          <stop offset="0" stopColor="#FFB302" stopOpacity="0.94902" />
          <stop offset="1" stopColor="#FFB302" stopOpacity="0.50196" />
        </linearGradient>
        <linearGradient
          x1="3.891"
          y1="5.891"
          x2="24.109"
          y2="26.109"
          gradientUnits="userSpaceOnUse"
          id={id2}
        >
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.6" />
          <stop offset="0.493" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="0.997" stopColor="#ffffff" stopOpacity="0.3" />
        </linearGradient>
        <linearGradient
          x1="19.793"
          y1="20.207"
          x2="28.207"
          y2="11.793"
          gradientUnits="userSpaceOnUse"
          id={id3}
        >
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.8" />
          <stop offset="0.519" stopColor="#ffffff" stopOpacity="0.5" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0.6" />
        </linearGradient>
      </defs>
      <g fill="none" fillRule="nonzero" stroke="none" strokeWidth="1" strokeLinecap="butt" strokeLinejoin="miter" strokeMiterlimit="10">
        {/* Door body with arrow exit slot */}
        <path
          d="M31.707,15.293l-4,-4c-0.391,-0.391 -1.023,-0.391 -1.414,0c-0.391,0.391 -0.391,1.023 0,1.414l2.293,2.293h-4.586v-7.25c0,-2.623 -2.127,-4.75 -4.75,-4.75h-10.5c-2.623,0 -4.75,2.127 -4.75,4.75v16.5c0,2.623 2.127,4.75 4.75,4.75h10.5c2.623,0 4.75,-2.127 4.75,-4.75v-7.25h4.586l-2.293,2.293c-0.391,0.391 -0.391,1.023 0,1.414c0.391,0.391 1.023,0.391 1.414,0l4,-4c0.195,-0.195 0.293,-0.451 0.293,-0.707c0,-0.256 -0.098,-0.512 -0.293,-0.707z"
          fill={`url(#${id1})`}
        />
        {/* Glass highlight overlay */}
        <path
          d="M19.25,3.5c2.343,0 4.25,1.907 4.25,4.25v7.25v0.5h0.5h4.586h1.207l-0.854,-0.854l-2.293,-2.293c-0.094,-0.094 -0.146,-0.22 -0.146,-0.353c0,-0.133 0.052,-0.259 0.147,-0.353c0.095,-0.094 0.22,-0.147 0.353,-0.147c0.133,0 0.259,0.052 0.353,0.147l4,4c0.095,0.094 0.147,0.22 0.147,0.353c0,0.133 -0.052,0.259 -0.147,0.353l-4,4c-0.094,0.095 -0.22,0.147 -0.353,0.147c-0.133,0 -0.259,-0.052 -0.353,-0.147c-0.094,-0.095 -0.147,-0.22 -0.147,-0.353c0,-0.133 0.052,-0.259 0.147,-0.353l2.293,-2.293l0.854,-0.854h-1.207h-4.587h-0.5v0.5v7.25c0,2.343 -1.907,4.25 -4.25,4.25h-10.5c-2.343,0 -4.25,-1.907 -4.25,-4.25v-16.5c0,-2.343 1.907,-4.25 4.25,-4.25h10.5M19.25,3h-10.5c-2.623,0 -4.75,2.127 -4.75,4.75v16.5c0,2.623 2.127,4.75 4.75,4.75h10.5c2.623,0 4.75,-2.127 4.75,-4.75v-7.25h4.586l-2.293,2.293c-0.391,0.391 -0.391,1.023 0,1.414c0.195,0.195 0.451,0.293 0.707,0.293c0.256,0 0.512,-0.098 0.707,-0.293l4,-4c0.195,-0.195 0.293,-0.451 0.293,-0.707c0,-0.256 -0.098,-0.512 -0.293,-0.707l-4,-4c-0.195,-0.195 -0.451,-0.293 -0.707,-0.293c-0.256,0 -0.512,0.098 -0.707,0.293c-0.391,0.391 -0.391,1.023 0,1.414l2.293,2.293h-4.586v-7.25c0,-2.623 -2.127,-4.75 -4.75,-4.75z"
          fill={`url(#${id2})`}
        />
        {/* Arrow shaft + head */}
        <path
          d="M26.293,11.293c-0.391,0.391 -0.391,1.023 0,1.414l2.293,2.293h-11.586c-0.552,0 -1,0.448 -1,1c0,0.552 0.448,1 1,1h11.586l-2.293,2.293c-0.391,0.391 -0.391,1.023 0,1.414c0.391,0.391 1.023,0.391 1.414,0l4,-4c0.195,-0.195 0.293,-0.451 0.293,-0.707c0,-0.256 -0.098,-0.512 -0.293,-0.707l-4,-4c-0.391,-0.391 -1.023,-0.391 -1.414,0z"
          fill={`url(#${id3})`}
        />
      </g>
    </svg>
  );
};
