// src/layout/NavBar.js
import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";

function NavItem({ label, to, isMobile }) {
  const location = useLocation();
  const isActive = location.pathname === to;

  return (
    <Link
      to={to}
      className={`px-3 py-1 rounded ${isMobile ? "text-[1.1rem] w-full text-center mb-2" : "text-[1.4rem]"} ${
        isActive
          ? "bg-[#9A8C98] text-[#FFC857]"
          : "text-white hover:bg-[#9A8C98]"
      }`}
    >
      {label}
    </Link>
  );
}

export default function NavBar() {
  // State for mobile menu
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Define navItems
  const navItems = [
    { label: "Zip Code", to: "/" },
    { label: "Organization", to: "/organization" },
    { label: "Search", to: "/search" },
  ];

  // Toggle mobile menu
  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  return (
    <nav className="bg-[#4A4E69] text-white py-3 px-6">
      {/* Desktop Navigation */}
      <div className="hidden md:flex md:items-center">
        <div className="flex gap-6 items-center">
          {navItems.map((item) => (
            <NavItem key={item.to} {...item} />
          ))}
        </div>
      </div>

      {/* Mobile Navigation */}
      <div className="md:hidden flex items-center">
        <button
          onClick={toggleMobileMenu}
          className="text-white focus:outline-none"
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? <X size={28} /> : <Menu size={28} />}
        </button>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden mt-3 flex flex-col items-center">
          {navItems.map((item) => (
            <NavItem key={item.to} {...item} isMobile={true} />
          ))}
        </div>
      )}
    </nav>
  );
}
