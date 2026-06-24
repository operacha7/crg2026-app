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
import { getHomeOrigin } from "../utils/homeOrigin";

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

export default function VerticalNavBar({
  externalHelpOpen,
  onHelpOpenChange,
  // When a parent (PageLayout) owns the Help panel so it can also be opened from
  // the mobile hamburger, it passes onRequestHelp (open + reset) and sets
  // renderHelpPanel=false so we don't render a duplicate. Standalone pages pass
  // neither and stay fully self-contained (internal state + own HelpPanel).
  onRequestHelp,
  renderHelpPanel = true,
}) {
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
    // Auth — onLogout clears the user (registered or guest) and returns to /.
    loggedInUser,
    onLogout,
  } = useAppData();

  // Reports requires a registered organization account (it surfaces usage
  // analytics across orgs). Guests see the icon grayed out and get the same
  // "You need an account. Contact Support." treatment used by Send Email,
  // Create PDF, and Send Text in NavBar1. Announcements is intentionally
  // NOT gated — guests can view audience-code-1 announcements; the audience
  // filtering already happens server-side in AnnouncementService.
  const isGuest = loggedInUser?.isGuest === true;
  const GUEST_GATED_IDS = new Set(["reports"]);

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
    // Guests can't use Reports — same alert treatment as the gated NavBar1
    // buttons. Stop before the route navigation so the login panel doesn't
    // get re-shown as the previous fallback behavior would.
    if (isGuest && GUEST_GATED_IDS.has(id)) {
      alert("You need an account. Contact Support.");
      return;
    }
    if (id === "quicktips") {
      // Toggle Quick Tips panel, clear expanded section if opening fresh
      if (!quickTipsOpen) {
        setQuickTipsExpandedSection(null);
      }
      setQuickTipsOpen(!quickTipsOpen);
      return;
    }
    if (id === "information") {
      // Parent-owned panel (PageLayout): let it handle open + conversation reset.
      if (onRequestHelp) {
        onRequestHelp();
        return;
      }
      // Self-contained: always increment reset key to clear conversation, whether panel is open or not
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
    // Return to the primary page the user came from (e.g. arrived at Contact
    // Support from /find → back to /find; from the marketing home → back to /).
    // Falls back to /find — the in-app home — since this bar only renders inside
    // the app. The resets above are harmless when the origin isn't /find.
    navigate(getHomeOrigin("/find"));
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
            (Ask a Question, etc.). Shown to guests as well as registered
            users: a guest clicking it clears the auto-created guest state
            and returns to the marketing homepage, matching the user-facing
            mental model that "logout = leave the app." */}
        {onLogout && (
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
          {navItems.map(({ id, Icon, label }) => {
            const isGated = isGuest && GUEST_GATED_IDS.has(id);
            const tooltipText = isGated ? "You need an account. Contact Support." : label;
            return (
              <Tooltip key={id} text={tooltipText} position="left">
                <button
                  onClick={() => handleClick(id)}
                  className="transition-all duration-200 hover:brightness-125 focus:outline-none"
                  aria-label={label}
                  // Same opacity treatment as the gated NavBar1 buttons (0.6).
                  // We deliberately keep the button clickable so the alert can
                  // fire — matching how Send Email / Create PDF / Send Text
                  // behave for guests.
                  style={{ opacity: isGated ? 0.6 : 1 }}
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
            );
          })}
        </div>
      </div>
    </div>

    {/* Help Panel — only when self-contained. When a parent owns the panel
        (PageLayout, so the mobile hamburger can open it too) this is skipped. */}
    {renderHelpPanel && (
      <HelpPanel isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} resetKey={helpResetKey} />
    )}

    {/* Quick Tips Panel */}
    <QuickTipsPanel />
    </>
  );
}
