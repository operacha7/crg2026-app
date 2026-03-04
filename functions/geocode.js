// Cloudflare Pages Function: POST /geocode
// Endpoint: http(s)://<host>/geocode
// Converts an address to coordinates using Google Maps Geocoding API

export async function onRequest({ request, env }) {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  // Preflight
  if (request.method === "OPTIONS") {
    return new Response("", { status: 200, headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  console.log("📍 Incoming geocode request...");
  console.log(
    "🔐 Using API Key:",
    env.GOOGLE_MAPS_API_KEY ? "✅ Set" : "❌ Missing"
  );

  if (!env.GOOGLE_MAPS_API_KEY) {
    return new Response(
      JSON.stringify({
        success: false,
        message: "Geocoding service not configured"
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  try {
    const { address } = await request.json();

    if (!address || typeof address !== "string" || address.trim() === "") {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Address is required"
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("📦 Address:", address);

    // Call Google Maps Geocoding API
    const encodedAddress = encodeURIComponent(address.trim());
    const googleUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${env.GOOGLE_MAPS_API_KEY}`;

    const res = await fetch(googleUrl, {
      method: "GET",
    });

    const data = await res.json();

    if (!res.ok || data.status === "REQUEST_DENIED") {
      console.error("❌ Google Geocoding error:", data);
      return new Response(
        JSON.stringify({
          success: false,
          message: data.error_message || "Geocoding failed",
        }),
        {
          status: res.ok ? 403 : res.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check if we got results
    if (data.status === "ZERO_RESULTS" || !data.results || data.results.length === 0) {
      console.log("⚠️ No results found for address");
      return new Response(
        JSON.stringify({
          success: false,
          message: "Address not found. Please check the address and try again.",
        }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get the best result (first one)
    const bestResult = data.results[0];
    const { lat, lng } = bestResult.geometry.location;
    const locationType = bestResult.geometry.location_type; // ROOFTOP, RANGE_INTERPOLATED, GEOMETRIC_CENTER, APPROXIMATE
    const formattedAddress = bestResult.formatted_address;

    console.log(`✅ Geocoded successfully: ${lat}, ${lng} (${locationType})`);

    // Return same response shape as before so client code doesn't change
    return new Response(
      JSON.stringify({
        success: true,
        coordinates: `${lat}, ${lng}`,
        latitude: lat,
        longitude: lng,
        formattedAddress: formattedAddress,
        accuracy: locationType === "ROOFTOP" ? 1 : locationType === "RANGE_INTERPOLATED" ? 0.8 : 0.5,
        accuracyType: locationType,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("🚨 Function error:", error);
    return new Response(
      JSON.stringify({ success: false, message: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
}
