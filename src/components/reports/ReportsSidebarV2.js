// src/components/reports/ReportsSidebarV2.js
// Left sidebar for the Zip Code Maps v2 page.
//
// Layout (top → bottom):
//   • Mode tabs — Conditions / Resources / Compare (underline pattern,
//     mirrors NavBar2 Search mode buttons)
//   • Hairline divider
//   • Per-mode controls (different in each mode — see below)
//   • Spacer
//   • Action row — Clear (outlined) + Download (filled red) side-by-side
//
// Per-mode control rows:
//   • Conditions  → Condition slide-toggle (Distress/Evictions) + Where
//   • Resources   → Assistance buttons + View slide-toggle (Locations/Coverage)
//                   + Where + Who
//   • Compare     → Condition slide-toggle + Assistance buttons + Where + Who
//
// Design principle: each control on the panel must do meaningful work in the
// active mode. Assistance and Who are intentionally omitted from Conditions
// because the choropleth doesn't react to them — adding them would lie about
// what the panel can do. Compare carries the most controls because comparison
// is the most analytically complex view.

import { useEffect, useMemo } from "react";
import { useAppData } from "../../Contexts/AppDataContext";
import { buildParentDropdownOptions, matchesParentOrSubgroup } from "../../utils/orgFilters";
import { DownloadIcon } from "../../icons/DownloadIcon";

const MODE_OPTIONS = [
  { value: "conditions", label: "Conditions" },
  { value: "services", label: "Resources" },
  { value: "compare", label: "Compare" },
];

const CONDITION_OPTIONS = [
  { value: "distress", label: "Distress" },
  { value: "evictions", label: "Evictions" },
];

// V2 allow-list for assistance types. Sidebar order is driven by assist_id
// ascending from the Supabase assistance table, so adding a label here slots
// it into the right place automatically.
const V2_ASSISTANCE_ALLOWED = new Set(["Rent", "Utilities", "Food"]);

const SERVICES_VIEW_OPTIONS = [
  { value: "pins", label: "Locations" },
  { value: "coverage", label: "Coverage" },
];

// ----------------------------------------------------------------------------
// Section label (small uppercase caption above each control row)
// ----------------------------------------------------------------------------
function SectionLabel({ children }) {
  return (
    <div
      style={{
        fontFamily: "'Open Sans', sans-serif",
        fontSize: "11px",
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "var(--color-reports-sidebar-v2-section-label)",
        marginBottom: "8px",
      }}
    >
      {children}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Mode tabs — underline pattern (Conditions / Resources / Compare).
// Active: gold text + gold underline. Idle: off-white text, no underline.
// ----------------------------------------------------------------------------
function ModeTabs({ mode, onModeChange }) {
  return (
    <div style={{ display: "flex", gap: "20px", alignItems: "flex-end" }}>
      {MODE_OPTIONS.map((opt) => {
        const active = mode === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => onModeChange(opt.value)}
            className="font-opensans transition-all hover:brightness-125"
            style={{
              background: "transparent",
              border: "none",
              padding: "4px 0",
              cursor: "pointer",
              fontSize: "16px",
              fontWeight: 500,
              color: active
                ? "var(--color-reports-sidebar-v2-mode-active-text)"
                : "var(--color-reports-sidebar-v2-mode-inactive-text)",
              borderBottom: active
                ? "2px solid var(--color-reports-sidebar-v2-mode-active-text)"
                : "2px solid transparent",
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

// ----------------------------------------------------------------------------
// SlideToggle — two-option pill toggle with animated sliding background.
// Mirrors the Daily/Monthly toggle in NavBar2Reports / Search Chart so the
// visual language stays consistent across the Reports surface.
// ----------------------------------------------------------------------------
function SlideToggle({ options, value, onChange }) {
  const activeIndex = Math.max(0, options.findIndex((o) => o.value === value));
  const padding = 4;
  return (
    <div
      className="relative flex items-center rounded-full"
      style={{
        backgroundColor: "var(--color-reports-sidebar-v2-toggle-track-bg)",
        padding: `${padding}px`,
        height: "38px",
        width: "100%",
      }}
    >
      <div
        className="absolute rounded-full transition-all duration-300 ease-in-out"
        style={{
          backgroundColor: "var(--color-reports-sidebar-v2-toggle-pill-bg)",
          top: `${padding}px`,
          bottom: `${padding}px`,
          width: `calc((100% - ${padding * 2}px) / ${options.length})`,
          left: `calc(${padding}px + ((100% - ${padding * 2}px) / ${options.length}) * ${activeIndex})`,
        }}
      />
      {options.map((opt, i) => {
        const isActive = i === activeIndex;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className="relative z-10 flex-1 text-center font-opensans transition-colors duration-300"
            style={{
              fontSize: "14px",
              fontWeight: 500,
              color: isActive ? "#FFFFFF" : "rgba(255, 255, 255, 0.7)",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: 0,
              height: "100%",
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

// ----------------------------------------------------------------------------
// AssistanceButton — outlined idle, gold-fill when active.
// Stacked one per row (full width).
// ----------------------------------------------------------------------------
function AssistanceButton({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className="font-opensans transition-all hover:brightness-125"
      style={{
        display: "block",
        width: "100%",
        textAlign: "left",
        fontSize: "15px",
        fontWeight: 500,
        padding: "10px 14px",
        borderRadius: "6px",
        backgroundColor: active
          ? "var(--color-reports-sidebar-v2-assistance-active-bg)"
          : "transparent",
        color: active
          ? "var(--color-reports-sidebar-v2-assistance-active-text)"
          : "var(--color-reports-sidebar-v2-text)",
        border: `1px solid ${
          active
            ? "var(--color-reports-sidebar-v2-assistance-active-bg)"
            : "var(--color-reports-sidebar-v2-outline-border)"
        }`,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

// ----------------------------------------------------------------------------
// OutlinedDropdown — native <select> with transparent bg + light-gray border.
// Text color flips to gold when a non-default value is selected (so users can
// see at a glance which dropdowns are filtering).
// ----------------------------------------------------------------------------
function OutlinedDropdown({ items, value, onChange, defaultLabel, defaultValue, ariaLabel }) {
  const isFiltering = value !== defaultValue && value !== "" && value != null;
  return (
    <select
      aria-label={ariaLabel}
      value={value || defaultValue}
      onChange={(e) => onChange(e.target.value === defaultValue ? "" : e.target.value)}
      className="hover:brightness-125 transition-all"
      style={{
        width: "100%",
        fontFamily: "'Open Sans', sans-serif",
        fontSize: "15px",
        fontWeight: 500,
        padding: "9px 12px",
        borderRadius: "6px",
        backgroundColor: "transparent",
        color: isFiltering
          ? "var(--color-reports-sidebar-v2-text-active)"
          : "var(--color-reports-sidebar-v2-text)",
        border: "1px solid var(--color-reports-sidebar-v2-outline-border)",
        cursor: "pointer",
        appearance: "none",
        backgroundImage:
          "url(\"data:image/svg+xml;charset=US-ASCII,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8' fill='none'%3E%3Cpath d='M1 1.5L6 6.5L11 1.5' stroke='%23FDF6E3' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "right 12px center",
        paddingRight: "32px",
      }}
    >
      <option value={defaultValue} style={{ color: "#000000" }}>{defaultLabel}</option>
      {items.map((item) => (
        <option key={item.value} value={item.value} style={{ color: "#000000" }}>
          {item.label}
        </option>
      ))}
    </select>
  );
}

// ----------------------------------------------------------------------------
// Main sidebar
// ----------------------------------------------------------------------------
export default function ReportsSidebarV2({
  mode,
  onModeChange,
  baseMap,                 // shared Distress/Evictions state — drives both Conditions and Compare
  onBaseMapChange,
  assistance,
  onAssistanceChange,
  servicesView,
  onServicesViewChange,
  county,
  onCountyChange,
  parentOrg,
  onParentOrgChange,
  organization,
  onOrganizationChange,
  onReset,
  onDownload,
}) {
  const { zipCodes, assistance: assistanceTable, directory } = useAppData();

  // Assistance options — assistance table filtered by allow-list, sorted by
  // assist_id ascending so the order in the sidebar matches the rest of the app.
  const assistanceOptions = useMemo(() => {
    if (!assistanceTable) return [];
    return assistanceTable
      .filter((a) => a.assistance && V2_ASSISTANCE_ALLOWED.has(a.assistance))
      .slice()
      .sort((a, b) => Number(a.assist_id) - Number(b.assist_id))
      .map((a) => ({ value: a.assistance, label: a.assistance }));
  }, [assistanceTable]);

  // County → Set<zip_code> for every Houston-area county. Powers the County
  // dropdown and the Who-dropdown narrowing.
  const houstonZipsByCounty = useMemo(() => {
    const byCounty = {};
    if (!zipCodes) return byCounty;
    zipCodes.forEach((z) => {
      if (z.county && z.houston_area === "Y") {
        if (!byCounty[z.county]) byCounty[z.county] = new Set();
        byCounty[z.county].add(z.zip_code);
      }
    });
    return byCounty;
  }, [zipCodes]);

  // Wildcard "99999" (serves all zips) always matches a county filter.
  const recordServesCounty = (r, countyZipSet) => {
    if (!countyZipSet) return true;
    const clientZips = Array.isArray(r.client_zip_codes) ? r.client_zip_codes : [];
    if (clientZips.includes("99999")) return true;
    return clientZips.some((z) => countyZipSet.has(z));
  };

  const countyZipSetForActive = county && county !== "All Counties"
    ? houstonZipsByCounty[county] || null
    : null;

  // Cross-cutting narrowing: each dropdown's options are filtered by every
  // OTHER active filter. Mirrors v1's NavBar2 behaviour so the dropdown set
  // always reflects what's actually drawable on the map.
  const counties = useMemo(() => {
    if (!zipCodes || !directory) return [];
    const baseSet = new Set();
    Object.keys(houstonZipsByCounty).forEach((c) => baseSet.add(c));
    if (!assistance && !parentOrg && !organization) {
      return Array.from(baseSet).sort();
    }
    let filtered = directory.filter((r) => r.status_id === 1);
    if (assistance) filtered = filtered.filter((r) => r.assistance === assistance);
    if (parentOrg) filtered = filtered.filter((r) => matchesParentOrSubgroup(r, parentOrg));
    if (organization) filtered = filtered.filter((r) => r.organization === organization);
    const reachableCounties = new Set();
    filtered.forEach((r) => {
      const clientZips = Array.isArray(r.client_zip_codes) ? r.client_zip_codes : [];
      if (clientZips.includes("99999")) {
        Object.keys(houstonZipsByCounty).forEach((c) => reachableCounties.add(c));
        return;
      }
      Object.entries(houstonZipsByCounty).forEach(([c, zipSet]) => {
        if (clientZips.some((z) => zipSet.has(z))) reachableCounties.add(c);
      });
    });
    return Array.from(reachableCounties).sort();
  }, [zipCodes, directory, houstonZipsByCounty, assistance, parentOrg, organization]);

  const parentOrgOptions = useMemo(() => {
    if (!directory) return [];
    let filtered = directory.filter((r) => r.status_id === 1);
    if (assistance) filtered = filtered.filter((r) => r.assistance === assistance);
    if (organization) filtered = filtered.filter((r) => r.organization === organization);
    if (countyZipSetForActive) filtered = filtered.filter((r) => recordServesCounty(r, countyZipSetForActive));
    return buildParentDropdownOptions(filtered, parentOrg);
  }, [directory, assistance, organization, parentOrg, countyZipSetForActive]);

  const organizationOptions = useMemo(() => {
    if (!directory) return [];
    let filtered = directory.filter((r) => r.status_id === 1);
    if (assistance) filtered = filtered.filter((r) => r.assistance === assistance);
    if (parentOrg) filtered = filtered.filter((r) => matchesParentOrSubgroup(r, parentOrg));
    if (countyZipSetForActive) filtered = filtered.filter((r) => recordServesCounty(r, countyZipSetForActive));
    const names = [...new Set(filtered.map((r) => r.organization).filter(Boolean))];
    return names.sort().map((n) => ({ value: n, label: n }));
  }, [directory, assistance, parentOrg, countyZipSetForActive]);

  // Auto-clear stale Who / county selections when a sibling filter narrows
  // them out — without this the map would render an empty overlay while the
  // sidebar still shows a phantom selection.
  useEffect(() => {
    if (parentOrg && !parentOrgOptions.some((o) => o.value === parentOrg)) {
      onParentOrgChange?.("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parentOrgOptions]);

  useEffect(() => {
    if (organization && !organizationOptions.some((o) => o.value === organization)) {
      onOrganizationChange?.("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationOptions]);

  useEffect(() => {
    if (county && county !== "All Counties" && !counties.includes(county)) {
      onCountyChange?.("All Counties");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [counties]);

  const showAssistance = mode === "services" || mode === "compare";
  const showWho = mode === "services" || mode === "compare";
  const showCondition = mode === "conditions" || mode === "compare";
  const showServicesView = mode === "services";

  return (
    <aside
      style={{
        width: "var(--width-reports-sidebar-v2)",
        flexShrink: 0,
        backgroundColor: "var(--color-reports-sidebar-v2-bg)",
        color: "var(--color-reports-sidebar-v2-text)",
        padding: "20px",
        display: "flex",
        flexDirection: "column",
        gap: "22px",
        overflowY: "auto",
      }}
    >
      {/* Mode tabs */}
      <div>
        <SectionLabel>Mode</SectionLabel>
        <ModeTabs mode={mode} onModeChange={onModeChange} />
      </div>

      {/* Hairline divider between Mode and the rest of the controls */}
      <div
        style={{
          height: "1px",
          backgroundColor: "var(--color-reports-sidebar-v2-divider)",
          margin: "-6px 0 -6px 0",
        }}
      />

      {/* CONDITION — visible in Conditions and Compare. Same state object so
          switching between the two modes preserves the user's choice. */}
      {showCondition && (
        <div>
          <SectionLabel>Condition</SectionLabel>
          <SlideToggle
            options={CONDITION_OPTIONS}
            value={baseMap}
            onChange={onBaseMapChange}
          />
        </div>
      )}

      {/* ASSISTANCE — visible in Resources and Compare. */}
      {showAssistance && (
        <div>
          <SectionLabel>Assistance</SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {assistanceOptions.map((opt) => (
              <AssistanceButton
                key={opt.value}
                label={opt.label}
                active={assistance === opt.value}
                onClick={() => onAssistanceChange(opt.value)}
              />
            ))}
          </div>
        </div>
      )}

      {/* VIEWS — Resources only. Locations (pins) vs Coverage (choropleth). */}
      {showServicesView && (
        <div>
          <SectionLabel>Views</SectionLabel>
          <SlideToggle
            options={SERVICES_VIEW_OPTIONS}
            value={servicesView}
            onChange={onServicesViewChange}
          />
        </div>
      )}

      {/* WHERE — always visible across modes (county filter applies everywhere). */}
      <div>
        <SectionLabel>Where</SectionLabel>
        <OutlinedDropdown
          ariaLabel="County filter"
          value={county || "All Counties"}
          onChange={onCountyChange}
          defaultLabel="All Counties"
          defaultValue="All Counties"
          items={counties.map((c) => ({ value: c, label: c }))}
        />
      </div>

      {/* WHO — Resources and Compare only. The dropdown default text
          ("All Parents" / "All Organizations") doubles as the section label,
          so the small "Parent" / "Organization" sub-labels were removed. */}
      {showWho && (
        <div>
          <SectionLabel>Who</SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <OutlinedDropdown
              ariaLabel="Parent organization filter"
              value={parentOrg || "All Parents"}
              onChange={onParentOrgChange}
              defaultLabel="All Parents"
              defaultValue="All Parents"
              items={parentOrgOptions}
            />
            <OutlinedDropdown
              ariaLabel="Organization filter"
              value={organization || "All Organizations"}
              onChange={onOrganizationChange}
              defaultLabel="All Organizations"
              defaultValue="All Organizations"
              items={organizationOptions}
            />
          </div>
        </div>
      )}

      {/* Spacer pushes action buttons to the bottom of the rail */}
      <div style={{ flex: 1 }} />

      {/* Action row — Clear (outlined) + Download (filled dark red) side-by-side. */}
      <div style={{ display: "flex", gap: "10px" }}>
        <button
          onClick={onReset}
          className="font-opensans transition-all duration-200 hover:brightness-110"
          style={{
            flex: 1,
            background: "transparent",
            color: "var(--color-reports-sidebar-v2-text)",
            border: "1px solid var(--color-reports-sidebar-v2-outline-border)",
            height: "var(--height-panel-btn)",
            borderRadius: "var(--radius-panel-btn)",
            fontSize: "var(--font-size-panel-btn)",
            letterSpacing: "var(--letter-spacing-panel-btn)",
            cursor: "pointer",
          }}
        >
          Clear
        </button>
        <button
          onClick={onDownload}
          className="flex items-center justify-center gap-2 transition-all duration-200 hover:brightness-125"
          style={{
            flex: 1,
            background: "var(--color-reports-sidebar-v2-btn-download-bg)",
            border: "none",
            borderRadius: "var(--radius-panel-btn)",
            height: "var(--height-panel-btn)",
            cursor: "pointer",
            color: "#FFFFFF",
            whiteSpace: "nowrap",
          }}
          title="Download map as PNG"
        >
          <DownloadIcon size={18} color="#FFFFFF" />
          <span className="font-opensans" style={{ fontSize: "16px", fontWeight: 400 }}>
            Download
          </span>
        </button>
      </div>
    </aside>
  );
}
