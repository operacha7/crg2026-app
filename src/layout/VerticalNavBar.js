// src/layout/VerticalNavBar.js
// Vertical navigation bar with accent stripe and icon buttons
// Icons have active/inactive states with hover effects

import { useState } from "react";
import {
  InformationIcon,
  ReportsIcon,
  AnnouncementsIcon,
  PrivacyPolicyIcon,
  ContactSupportIcon,
  USFlagIcon,
} from "../icons";
import Tooltip from "../components/Tooltip";

const navItems = [
  { id: "information", Icon: InformationIcon, label: "Information" },
  { id: "reports", Icon: ReportsIcon, label: "Reports" },
  { id: "announcements", Icon: AnnouncementsIcon, label: "Announcements" },
  { id: "privacy", Icon: PrivacyPolicyIcon, label: "Privacy Policy" },
  { id: "contact", Icon: ContactSupportIcon, label: "Contact Support" },
];

export default function VerticalNavBar() {
  const [activeItem, setActiveItem] = useState(null);

  const handleClick = (id) => {
    setActiveItem(activeItem === id ? null : id);
  };

  return (
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
        {/* US Flag at top */}
        <div className="flex justify-center mt-[10px]">
          <USFlagIcon size={30} />
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
                  active={activeItem === id}
                />
              </button>
            </Tooltip>
          ))}
        </div>
      </div>
    </div>
  );
}
