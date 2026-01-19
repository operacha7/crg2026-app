// src/layout/Footer.js
// Simple footer with copyright, attribution, and US flag icon
// Responsive: maintains centered content across all screen sizes

import React from "react";
import { USFlagIcon } from "../icons";

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer
      className="bg-footer-bg text-footer-text h-footer flex items-center justify-center w-full"
      style={{ fontFamily: 'var(--font-family-body)', fontSize: 'var(--font-size-footer)' }}
    >
      <div className="flex items-center gap-2">
        <USFlagIcon size={20} />
        <span>
          © {currentYear} O Peracha. All Rights Reserved. Icons by icons8.com
        </span>
      </div>
    </footer>
  );
}
