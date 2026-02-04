// Cloudflare Pages Function: POST /distance
// Endpoint: http(s)://<host>/distance
// Calculates driving distances from origin to multiple destinations using Google Distance Matrix API

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

  console.log("📍 Incoming distance request...");
  console.log(
    "🔐 Using Google API Key:",
    env.GOOGLE_MAPS_API_KEY ? "✅ Set" : "❌ Missing"
  );

  if (!env.GOOGLE_MAPS_API_KEY) {
    return new Response(
      JSON.stringify({
        success: false,
        message: "Distance service not configured"
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  try {
    const { origin, destinations } = await request.json();

    // Validate origin - can be address string or "lat,lng" coordinates
    if (!origin || typeof origin !== "string" || origin.trim() === "") {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Origin is required"
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Validate destinations - array of coordinate strings "lat,lng"
    if (!destinations || !Array.isArray(destinations) || destinations.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Destinations array is required"
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Google Distance Matrix API allows up to 25 destinations per request
    // For more, we need to batch (but for now, let's handle the common case)
    if (destinations.length > 25) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Maximum 25 destinations per request"
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`📦 Origin: ${origin}`);
    console.log(`📦 Destinations count: ${destinations.length}`);

    // Build destinations string (pipe-separated)
    const destinationsStr = destinations.join("|");

    // Call Google Distance Matrix API
    const googleUrl = new URL("https://maps.googleapis.com/maps/api/distancematrix/json");
    googleUrl.searchParams.set("origins", origin.trim());
    googleUrl.searchParams.set("destinations", destinationsStr);
    googleUrl.searchParams.set("mode", "driving");
    googleUrl.searchParams.set("units", "imperial"); // Get miles instead of km
    googleUrl.searchParams.set("key", env.GOOGLE_MAPS_API_KEY);

    const res = await fetch(googleUrl.toString(), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("❌ Google API error:", data);
      return new Response(
        JSON.stringify({
          success: false,
          message: data.error_message || "Distance calculation failed",
        }),
        {
          status: res.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check API-level status
    if (data.status !== "OK") {
      console.error("❌ Google API status error:", data.status, data.error_message);
      return new Response(
        JSON.stringify({
          success: false,
          message: data.error_message || `API error: ${data.status}`,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Parse results - data.rows[0].elements contains distances for each destination
    // Each element has: status, distance { text, value }, duration { text, value }
    const elements = data.rows[0]?.elements || [];

    const distances = elements.map((element, index) => {
      if (element.status === "OK") {
        return {
          index,
          status: "OK",
          distance: {
            text: element.distance.text,        // e.g., "5.2 mi"
            meters: element.distance.value,     // distance in meters
            miles: element.distance.value / 1609.344, // convert to miles
          },
          duration: {
            text: element.duration.text,        // e.g., "12 mins"
            seconds: element.duration.value,    // duration in seconds
          },
        };
      } else {
        // Element-level error (e.g., "ZERO_RESULTS", "NOT_FOUND")
        return {
          index,
          status: element.status,
          distance: null,
          duration: null,
        };
      }
    });

    console.log(`✅ Distance calculation complete: ${distances.filter(d => d.status === "OK").length}/${destinations.length} successful`);

    return new Response(
      JSON.stringify({
        success: true,
        origin: data.origin_addresses?.[0] || origin,
        destinations: data.destination_addresses || [],
        distances,
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
