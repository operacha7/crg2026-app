// src/layout/VerticalNavBar.js
// Vertical navigation bar with accent stripe and icon buttons
// Icons have active/inactive states with hover effects

import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  HelpBubbleIcon,
  ReportsIcon,
  AnnouncementsIcon,
  PrivacyPolicyIcon,
  ContactSupportIcon,
  HomeIcon,
} from "../icons";
import Tooltip from "../components/Tooltip";
import { useAppData } from "../Contexts/AppDataContext";
import HelpPanel from "../components/HelpPanel";

const navItems = [
  { id: "information", Icon: HelpBubbleIcon, label: "Help" },
  { id: "reports", Icon: ReportsIcon, label: "Reports" },
  { id: "announcements", Icon: AnnouncementsIcon, label: "Announcements" },
  { id: "privacy", Icon: PrivacyPolicyIcon, label: "Legal" },
  { id: "contact", Icon: ContactSupportIcon, label: "Contact Support" },
];

// Map nav item ids to their routes
const navRoutes = {
  reports: "/reports",
  privacy: "/privacy",
  contact: "/support",
  announcements: "/announcements",
};

export default function VerticalNavBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [helpResetKey, setHelpResetKey] = useState(0);

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

  // Home is active when we're on the root path
  const isHomeActive = location.pathname === "/";

  // Determine active item based on current route
  const getActiveItem = () => {
    for (const [id, route] of Object.entries(navRoutes)) {
      if (location.pathname === route) {
        return id;
      }
    }
    return null;
  };

  const handleClick = (id) => {
    if (id === "information") {
      // Always increment reset key to clear conversation, whether panel is open or not
      setHelpResetKey((prev) => prev + 1);
      setIsHelpOpen(true);
      return;
    }
    const route = navRoutes[id];
    if (route) {
      navigate(route);
    }
  };

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
    // Note: Assistance selections are NOT cleared - they persist until session restart
    navigate("/");
  };

  return (
    <>
    <div className="flex h-full">
      {/* Accent stripe */}
      <div
        className="bg-vertical-nav-accent"
        style={{ width: "var(--width-vertical-nav-accent)" }}
      />

      {/* Main nav bar */}
      <div
        className="bg-vertical-nav-bg flex flex-col"
        style={{
          width: "var(--width-vertical-nav-main)",
        }}
      >
        {/* Home icon at top */}
        <div className="flex justify-center mt-[10px]">
          <Tooltip text="Home" position="left">
            <button
              onClick={handleHomeClick}
              className="transition-all duration-200 hover:brightness-125 focus:outline-none"
              aria-label="Home"
            >
              <HomeIcon size={35} active={isHomeActive} />
            </button>
          </Tooltip>
        </div>

        {/* Spacer to push icons to bottom */}
        <div className="flex-1" />

        {/* Icon buttons */}
        <div
          className="flex flex-col items-center"
          style={{
            gap: "var(--gap-vertical-nav-icons)",
            paddingBottom: "var(--padding-vertical-nav-bottom)",
          }}
        >
          {navItems.map(({ id, Icon, label }) => (
            <Tooltip key={id} text={label} position="left">
              <button
                onClick={() => handleClick(id)}
                className="transition-all duration-200 hover:brightness-125 focus:outline-none"
                aria-label={label}
              >
                <Icon
                  size={35}
                  active={getActiveItem() === id || (id === "information" && isHelpOpen)}
                />
              </button>
            </Tooltip>
          ))}
        </div>
      </div>
    </div>

    {/* Help Panel */}
    <HelpPanel isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} resetKey={helpResetKey} />
    </>
  );
}
