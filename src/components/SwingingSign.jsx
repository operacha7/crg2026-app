// src/components/SwingingSign.jsx
import React from "react";

export default function SwingingSign({ organizationName }) {
  if (!organizationName) return null;

  return (
    <div className="relative">
      {/* Sign board with swing animation */}
      <div
        className="w-66 h-auto py-4 px-10 bg-gradient-to-b from-[#2c3e50] to-[#1a2530] rounded-lg border-2 border-[#f8d568] shadow-lg animate-swing"
        style={{
          boxShadow:
            "0 6px 12px rgba(0,0,0,0.3), inset 0 1px 1px rgba(255,255,255,0.1)",
        }}
      >
        <div className="text-center">
          <div className="text-[#8fbbda] text-xs mb-1 italic">
            Logged in as
          </div>
          <div
            className="font-[Montserrat] text-[#f8d568] text-[1.5rem] font-normal"
            style={{ textShadow: "1px 1px 2px rgba(0,0,0,0.5)" }}
          >
            {organizationName}
          </div>
        </div>
      </div>

      {/* Hanging chains */}
      <div className="absolute top-[-8px] left-8 w-1 h-8 bg-gradient-to-b from-[#f8d568] to-[#d4af37]"></div>
      <div className="absolute top-[-8px] right-8 w-1 h-8 bg-gradient-to-b from-[#f8d568] to-[#d4af37]"></div>
    </div>
  );
}