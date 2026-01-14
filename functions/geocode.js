// Cloudflare Pages Function: POST /geocode
// Endpoint: http(s)://<host>/geocode
// Converts an address to coordinates using Geocodio API

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
    env.GEOCODIO_API_KEY ? "✅ Set" : "❌ Missing"
  );

  if (!env.GEOCODIO_API_KEY) {
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

    // Call Geocodio API
    const encodedAddress = encodeURIComponent(address.trim());
    const geocodioUrl = `https://api.geocod.io/v1.7/geocode?q=${encodedAddress}&api_key=${env.GEOCODIO_API_KEY}`;

    const res = await fetch(geocodioUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("❌ Geocodio error:", data);
      return new Response(
        JSON.stringify({
          success: false,
          message: data.error || "Geocoding failed",
        }),
        {
          status: res.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check if we got results
    if (!data.results || data.results.length === 0) {
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

    // Get the best result (first one, highest accuracy)
    const bestResult = data.results[0];
    const { lat, lng } = bestResult.location;
    const accuracy = bestResult.accuracy;
    const accuracyType = bestResult.accuracy_type;
    const formattedAddress = bestResult.formatted_address;

    console.log(`✅ Geocoded successfully: ${lat}, ${lng} (${accuracyType}: ${accuracy})`);

    return new Response(
      JSON.stringify({
        success: true,
        coordinates: `${lat}, ${lng}`,
        latitude: lat,
        longitude: lng,
        formattedAddress: formattedAddress,
        accuracy: accuracy,
        accuracyType: accuracyType,
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