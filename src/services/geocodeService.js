// src/services/geocodeService.js
// Service for geocoding addresses via Cloudflare Function

/**
 * Geocode an address to coordinates
 * @param {string} address - The address to geocode
 * @returns {Promise<{success: boolean, coordinates?: string, latitude?: number, longitude?: number, formattedAddress?: string, message?: string}>}
 */
export async function geocodeAddress(address) {
  try {
    // Determine the API endpoint based on environment
    // In development, Cloudflare Pages dev server proxies /geocode
    // In production, it's the same domain
    const endpoint = "/geocode";

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ address }),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      return {
        success: false,
        message: data.message || "Geocoding failed",
      };
    }

    return {
      success: true,
      coordinates: data.coordinates,
      latitude: data.latitude,
      longitude: data.longitude,
      formattedAddress: data.formattedAddress,
      accuracy: data.accuracy,
      accuracyType: data.accuracyType,
    };
  } catch (error) {
    console.error("Geocoding error:", error);
    return {
      success: false,
      message: "Network error. Please try again.",
    };
  }
}