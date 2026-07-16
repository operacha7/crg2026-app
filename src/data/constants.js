// src/data/constants.js
export const LOGO_URL_Email = "https://res.cloudinary.com/du8tvrzd4/image/upload/v1746483103/logo-email_bqaxrc.png";
export const BUS_ICON_URL = "https://res.cloudinary.com/du8tvrzd4/image/upload/bus_route_icon_uklbzn.png";

// Support contact number for the "text me" option on the Contact Support page.
// Inherently public (it's encoded into the displayed QR code). Currently a
// personal number by choice; swap to a Google Voice line here if it ever needs
// to change — this constant is the single source of truth.
export const SUPPORT_PHONE_DISPLAY = "713-857-7399";
export const SUPPORT_PHONE_E164 = "+17138577399";

// The CRG administrator's registered_organizations.account_id. Gates the Admin
// Review page + its nav icon. Client-side this is cosmetic only — the real gate
// is server-side in functions/admin-findings.js (mirrored in functions/config.js,
// since client and Functions are separate bundles).
export const ADMIN_ACCOUNT_ID = 10000;
