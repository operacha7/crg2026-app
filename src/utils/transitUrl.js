// Builds a Google Maps deep link with transit directions pre-filled.
// Origin is the user's geocoded address (from the Distance panel) when available;
// destination is the org's stored coordinates, falling back to its address.
// No API key, no quota — Google Maps handles all transit routing.
export function buildTransitDirectionsUrl(record, clientCoordinates) {
  const coords = record?.org_coordinates?.replace(/\s+/g, "");
  const destination = coords || `${record?.org_address1 || ""}, ${record?.org_city || ""}, ${record?.org_state || "TX"} ${record?.org_zip_code || ""}`.trim();

  const params = new URLSearchParams({
    api: "1",
    destination,
    travelmode: "transit",
  });
  if (clientCoordinates) {
    params.set("origin", clientCoordinates.replace(/\s+/g, ""));
  }
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}
