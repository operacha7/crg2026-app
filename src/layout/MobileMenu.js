// src/layout/MobileMenu.js
// Mobile slide-out menu that contains vertical nav items
// Only visible on mobile (<768px)

import { useNavigate, useLocation } from "react-router-dom";
import { X } from "lucide-react";
import {
  HelpBubbleIcon,
  ReportsIcon,
  AnnouncementsIcon,
  PrivacyPolicyIcon,
  ContactSupportIcon,
  HomeIcon,
} from "../icons";
import { useAppData } from "../Contexts/AppDataContext";

const navItems = [
  { id: "home", Icon: HomeIcon, label: "Home", route: "/" },
  { id: "information", Icon: HelpBubbleIcon, label: "Help" },
  { id: "reports", Icon: ReportsIcon, label: "Reports", route: "/reports" },
  { id: "announcements", Icon: AnnouncementsIcon, label: "Announcements", route: "/announcements" },
  { id: "privacy", Icon: PrivacyPolicyIcon, label: "Legal", route: "/privacy" },
  { id: "contact", Icon: ContactSupportIcon, label: "Contact Support", route: "/support" },
];

export default function MobileMenu({ isOpen, onClose, onOpenHelp }) {
  const navigate = useNavigate();
  const location = useLocation();

  // Get context setters for resetting state on Home click
  const {
    setActiveSearchMode,
    setSelectedZipCode,
    setSelectedParentOrg,
    setSelectedChildOrg,
    setSelectedLocationCounty,
    setSelectedLocationCity,
    setSelectedLocationZip,
    setClientAddress,
    setClientCoordinates,
  } = useAppData();

  const handleHomeClick = () => {
    // Reset to Zip Code mode and clear all selections except assistance
    setActiveSearchMode("zipcode");
    setSelectedZipCode("");
    setSelectedParentOrg("");
    setSelectedChildOrg("");
    setSelectedLocationCounty("");
    setSelectedLocationCity("");
    setSelectedLocationZip("");
    setClientAddress("");
    setClientCoordinates("");
    navigate("/");
    onClose();
  };

  const handleItemClick = (item) => {
    if (item.id === "home") {
      handleHomeClick();
      return;
    }
    if (item.id === "information") {
      onOpenHelp();
      onClose();
      return;
    }
    if (item.route) {
      navigate(item.route);
      onClose();
    }
  };

  const isActive = (item) => {
    if (item.id === "home") return location.pathname === "/";
    if (item.route) return location.pathname === item.route;
    return false;
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 md:hidden"
        onClick={onClose}
      />

      {/* Slide-out menu */}
      <div
        className="fixed top-0 right-0 h-full w-64 bg-navbar1-bg z-50 md:hidden transform transition-transform duration-300 ease-in-out shadow-xl"
        style={{
          transform: isOpen ? "translateX(0)" : "translateX(100%)",
        }}
      >
        {/* Header with close button */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <span className="text-white font-medium text-lg">Menu</span>
          <button
            onClick={onClose}
            className="text-white p-2 hover:brightness-125 transition-all"
            aria-label="Close menu"
          >
            <X size={24} />
          </button>
        </div>

        {/* Menu items */}
        <nav className="flex flex-col p-4 gap-2">
          {navItems.map((item) => {
            const { Icon } = item;
            const active = isActive(item);
            return (
              <button
                key={item.id}
                onClick={() => handleItemClick(item)}
                className={`flex items-center gap-4 px-4 py-3 rounded-lg transition-all ${
                  active
                    ? "bg-vertical-nav-accent text-white"
                    : "text-gray-300 hover:bg-gray-700 hover:text-white"
                }`}
              >
                <Icon size={24} active={active} />
                <span className="text-base">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </>
  );
}
