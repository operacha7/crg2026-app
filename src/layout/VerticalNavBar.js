// src/layout/VerticalNavBar.js
// Vertical navigation bar with accent stripe and icon buttons
// Icons have active/inactive states with hover effects

import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  HelpBubbleIcon,
  ReportsIcon,
  AnnouncementsIcon,
  HomeIcon,
  QuickTipsIcon,
  LogoutIcon,
} from "../icons";
import Tooltip from "../components/Tooltip";
import { useAppData } from "../Contexts/AppDataContext";
import HelpPanel from "../components/HelpPanel";
import QuickTipsPanel from "../components/QuickTipsPanel";

// Legal and Contact Support icons removed — both are now reachable from the
// site-wide secondary footer (Privacy Policy / Terms of Service / Contact
// Support), so the duplicates in the vertical bar were redundant.
const navItems = [
  { id: "quicktips", Icon: QuickTipsIcon, label: "Quick Tips" },
  { id: "information", Icon: HelpBubbleIcon, label: "Help" },
  { id: "reports", Icon: ReportsIcon, label: "Reports" },
  { id: "announcements", Icon: AnnouncementsIcon, label: "Announcements" },
];

// Map nav item ids to their routes
const navRoutes = {
  reports: "/reports",
  announcements: "/announcements",
};

export default function VerticalNavBar({ externalHelpOpen, onHelpOpenChange }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [internalHelpOpen, setInternalHelpOpen] = useState(false);
  const [helpResetKey, setHelpResetKey] = useState(0);

  // Use external control if provided, otherwise use internal state
  const isHelpOpen = externalHelpOpen !== undefined ? externalHelpOpen : internalHelpOpen;
  const setIsHelpOpen = onHelpOpenChange || setInternalHelpOpen;

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
    // Quick Tips state
    quickTipsOpen,
    setQuickTipsOpen,
    setQuickTipsExpandedSection,
    // Auth — used to gate the Logout icon. Guests have nothing to log out of,
    // so the icon only renders for registered (non-guest) users.
    loggedInUser,
    onLogout,
  } = useAppData();

  // Home is active when we're on the working ZipCodePage URL.
  const isHomeActive = location.pathname === "/find";

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
    if (id === "quicktips") {
      // Toggle Quick Tips panel, clear expanded section if opening fresh
      if (!quickTipsOpen) {
        setQuickTipsExpandedSection(null);
      }
      setQuickTipsOpen(!quickTipsOpen);
      return;
    }
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
    // Navigate to /find (the in-app ZipCodePage URL); / is the public HomePage now.
    navigate("/find");
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
        {/* Home icon — wrapper height matches NavBar1 so the icon's vertical
            center sits exactly on NavBar1's center, optically lining the icon
            up with the Send Email / Create PDF / Send Text buttons across the
            top header. The vertical nav starts at the same y as NavBar1, so
            equal heights guarantee equal centers. */}
        <div
          className="flex items-center justify-center"
          style={{ height: "var(--height-navbar1)" }}
        >
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

        {/* Logout icon — wrapper height matches NavBar2 so the icon centers
            on NavBar2's center, lining it up with the search-mode buttons
            (Ask a Question, etc.). Registered users only; guests have
            nothing to log out of and would otherwise see an inert icon. */}
        {loggedInUser && !loggedInUser.isGuest && onLogout && (
          <div
            className="flex items-center justify-center"
            style={{ height: "var(--height-navbar2)" }}
          >
            <Tooltip text="Logout" position="left">
              <button
                onClick={onLogout}
                className="transition-all duration-200 hover:brightness-125 focus:outline-none"
                aria-label="Logout"
              >
                <LogoutIcon size={35} />
              </button>
            </Tooltip>
          </div>
        )}

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
                  active={
                    getActiveItem() === id ||
                    (id === "information" && isHelpOpen) ||
                    (id === "quicktips" && quickTipsOpen)
                  }
                />
              </button>
            </Tooltip>
          ))}
        </div>
      </div>
    </div>

    {/* Help Panel */}
    <HelpPanel isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} resetKey={helpResetKey} />

    {/* Quick Tips Panel */}
    <QuickTipsPanel />
    </>
  );
}
