// src/data/newsCategories.js
// Topical buckets for the Opportunity Scan news feed. The ORDER here drives the
// section order on the News page and the Admin Review page.
//
// Mirrors CATEGORY_ENUM in functions/_lib/scan-pipeline.js (the values Claude
// assigns) — keep the two in sync when categories are tuned.
//
// `icon`   — a name from src/icons/iconMap.js (the same assistance-type icons
//            used throughout the app).
// `image`  — an <img> src, used INSTEAD of `icon` (e.g. the CRG logo).
// `accent` — the panel-header tint, drawn from the existing assistance group
//            palette where a category maps naturally to one.
// `fg`     — panel-header foreground (icon + text) color; defaults to #222831.
//            Set it when the accent is dark enough that #222831 would vanish.
//
// TODO: `disaster` and `news_policy` have no natural icon in the current set and
// fall back to OtherIcon — they each want their own (and Admin needs one too).
//
// NOTE: `crg_updates` is CRG-authored (manual adds via /admin only) — it is
// deliberately NOT in CATEGORY_ENUM, so Claude never auto-tags news into it.
// It's pinned first so it always sits above the topical categories.

export const NEWS_CATEGORIES = [
  { key: "crg_updates",    label: "CRG Updates",                image: "/images/CRG Logo 2025.webp", accent: "#222831", fg: "#FFFFFF" },
  { key: "food",           label: "Food",                       icon: "FoodPantriesIcon",        accent: "var(--color-assistance-group1)" },
  { key: "housing",        label: "Housing, Rent & Eviction",   icon: "HousingIcon",             accent: "var(--color-assistance-group5)" },
  { key: "utilities",      label: "Utilities & Bill Help",      icon: "UtilitiesIcon",           accent: "var(--color-assistance-group4)" },
  { key: "health",         label: "Health & Insurance",         icon: "MedicalPrimaryCareIcon",  accent: "var(--color-assistance-group3)" },
  { key: "mother_child",   label: "Mother & Child",             icon: "ChildcareIcon",           accent: "#F7C6D9" },
  { key: "jobs_education", label: "Jobs, Training & Education", icon: "JobsIcon",                accent: "var(--color-assistance-group2)" },
  { key: "seasonal",       label: "Back-to-School & Seasonal",  icon: "SeasonalIcon",            accent: "var(--color-assistance-group6)" },
  { key: "disaster",       label: "Disaster Relief",            icon: "OtherIcon",               accent: "#FFB3A7" },
  { key: "news_policy",    label: "News & Policy",              icon: "OtherIcon",               accent: "#CFC9BE" },
  { key: "other",          label: "Other",                      icon: "OtherIcon",               accent: "#DDD9D0" },
];

export const NEWS_CATEGORY_LABELS = Object.fromEntries(
  NEWS_CATEGORIES.map((c) => [c.key, c.label])
);

// Time-sensitive items (anything with a deadline) float to the top of their
// panel; the rest fall back to newest-first.
function sortForFeed(a, b) {
  const aDated = a.deadline ? 0 : 1;
  const bDated = b.deadline ? 0 : 1;
  if (aDated !== bDated) return aDated - bDated;
  return new Date(b.created_at) - new Date(a.created_at);
}

/** Group feed items into ordered [{key, label, icon, accent, items}] panels, skipping empties. */
export function groupByCategory(items) {
  const byKey = {};
  for (const item of items || []) {
    const key = NEWS_CATEGORY_LABELS[item.category] ? item.category : "other";
    (byKey[key] ||= []).push(item);
  }
  return NEWS_CATEGORIES.filter((c) => byKey[c.key]?.length).map((c) => ({
    ...c,
    items: byKey[c.key].sort(sortForFeed),
  }));
}
