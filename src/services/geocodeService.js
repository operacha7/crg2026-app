// src/services/geocodeService.js
// Service for geocoding addresses and calculating driving distances via Cloudflare Functions

// Module-level cache to prevent duplicate API calls (persists across StrictMode remounts)
const geocodeCache = new Map();
const pendingRequests = new Map();

// Cache for driving distances (key: origin + destinations hash)
const distanceCache = new Map();
const pendingDistanceRequests = new Map();

/**
 * Geocode an address to coordinates
 * @param {string} address - The address to geocode
 * @returns {Promise<{success: boolean, coordinates?: string, latitude?: number, longitude?: number, formattedAddress?: string, message?: string}>}
 */
export async function geocodeAddress(address) {
  // Normalize address for cache key
  const cacheKey = address.trim().toLowerCase();

  // Return cached result if available
  if (geocodeCache.has(cacheKey)) {
    console.log(`📍 Geocode cache hit for: ${address}`);
    return geocodeCache.get(cacheKey);
  }

  // If a request is already in progress for this address, wait for it
  if (pendingRequests.has(cacheKey)) {
    console.log(`📍 Waiting for pending geocode request: ${address}`);
    return pendingRequests.get(cacheKey);
  }

  // Create the request promise and store it
  const requestPromise = doGeocodeRequest(address, cacheKey);
  pendingRequests.set(cacheKey, requestPromise);

  try {
    const result = await requestPromise;
    return result;
  } finally {
    pendingRequests.delete(cacheKey);
  }
}

async function doGeocodeRequest(address, cacheKey) {
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

    const result = {
      success: true,
      coordinates: data.coordinates,
      latitude: data.latitude,
      longitude: data.longitude,
      formattedAddress: data.formattedAddress,
      accuracy: data.accuracy,
      accuracyType: data.accuracyType,
    };

    // Cache successful results
    geocodeCache.set(cacheKey, result);
    return result;
  } catch (error) {
    console.error("Geocoding error:", error);
    return {
      success: false,
      message: "Network error. Please try again.",
    };
  }
}

/**
 * Calculate driving distances from an origin to multiple destinations
 * Uses Google Distance Matrix API via Cloudflare Function
 *
 * @param {string} origin - Origin address or coordinates ("lat,lng")
 * @param {Array<{id: string|number, coordinates: string}>} destinations - Array of destinations with id and coordinates
 * @returns {Promise<{success: boolean, distances?: Map<string|number, number>, message?: string}>}
 *          Returns a Map of destination id -> distance in miles
 */
export async function getDrivingDistances(origin, destinations) {
  if (!origin || !destinations || destinations.length === 0) {
    return { success: false, message: "Origin and destinations are required" };
  }

  // Filter out destinations without valid coordinates
  const validDestinations = destinations.filter(d => d.coordinates && d.coordinates.includes(","));

  if (validDestinations.length === 0) {
    return { success: false, message: "No valid destination coordinates" };
  }

  // Create cache key from origin and sorted destination coordinates
  const destCoords = validDestinations.map(d => d.coordinates.replace(/\s/g, "")).sort();
  const cacheKey = `${origin.trim().toLowerCase()}|${destCoords.join("|")}`;

  // Return cached result if available
  if (distanceCache.has(cacheKey)) {
    console.log(`🚗 Distance cache hit for ${validDestinations.length} destinations`);
    return distanceCache.get(cacheKey);
  }

  // If a request is already in progress, wait for it
  if (pendingDistanceRequests.has(cacheKey)) {
    console.log(`🚗 Waiting for pending distance request`);
    return pendingDistanceRequests.get(cacheKey);
  }

  // Create the request promise
  const requestPromise = doDistanceRequest(origin, validDestinations, cacheKey);
  pendingDistanceRequests.set(cacheKey, requestPromise);

  try {
    const result = await requestPromise;
    return result;
  } finally {
    pendingDistanceRequests.delete(cacheKey);
  }
}

async function doDistanceRequest(origin, destinations, cacheKey) {
  try {
    const endpoint = "/distance";
    const BATCH_SIZE = 25; // Google Distance Matrix API limit

    // Build a Map of destination id -> distance in miles
    const distanceMap = new Map();
    let lastOrigin = null;

    // Batch destinations into chunks of 25
    for (let i = 0; i < destinations.length; i += BATCH_SIZE) {
      const batch = destinations.slice(i, i + BATCH_SIZE);
      const destinationCoords = batch.map(d => d.coordinates.replace(/\s/g, ""));

      console.log(`🚗 Fetching batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(destinations.length / BATCH_SIZE)} (${batch.length} destinations)`);

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          origin,
          destinations: destinationCoords,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        console.error(`Batch ${Math.floor(i / BATCH_SIZE) + 1} failed:`, data.message);
        // Continue with other batches, mark these as null
        batch.forEach(dest => distanceMap.set(dest.id, null));
        continue;
      }

      lastOrigin = data.origin;

      // Add results from this batch to the map
      data.distances.forEach((distResult, index) => {
        if (index < batch.length) {
          const destId = batch[index].id;
          if (distResult.status === "OK" && distResult.distance) {
            // Round to 1 decimal place
            distanceMap.set(destId, parseFloat(distResult.distance.miles.toFixed(1)));
          } else {
            distanceMap.set(destId, null);
          }
        }
      });
    }

    const result = {
      success: true,
      distances: distanceMap,
      origin: lastOrigin,
    };

    // Cache successful results
    distanceCache.set(cacheKey, result);
    console.log(`🚗 Driving distances calculated: ${distanceMap.size} destinations`);

    return result;
  } catch (error) {
    console.error("Distance calculation error:", error);
    return {
      success: false,
      message: "Network error. Please try again.",
    };
  }
}