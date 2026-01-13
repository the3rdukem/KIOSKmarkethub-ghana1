/**
 * Google Maps Location Service
 *
 * Provides location-based features across the platform.
 * Credentials are managed from Admin → API Management.
 *
 * PRODUCTION-READY: Features properly gated based on API status.
 * Credentials fetched from database (server) or API (client).
 *
 * Capabilities:
 * - Street-level address autocomplete
 * - Signup location capture
 * - Vendor store location
 * - "Products near me" search
 * - Distance-based filtering
 */

// Google Maps enablement check - synchronous, based on env var or cached API key

export interface PlacePrediction {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
  types: string[];
}

export interface PlaceDetails {
  placeId: string;
  name: string;
  formattedAddress: string;
  latitude: number;
  longitude: number;
  city?: string;
  region?: string;
  country?: string;
  postalCode?: string;
}

export interface DistanceResult {
  originPlaceId: string;
  destinationPlaceId: string;
  distanceMeters: number;
  distanceText: string;
  durationSeconds: number;
  durationText: string;
}

export interface NearbySearchResult {
  placeId: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  distanceMeters?: number;
}

export interface MapsServiceResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  integrationDisabled?: boolean;
}

// Cached Google Maps script loader
let mapsScriptPromise: Promise<void> | null = null;
let mapsScriptLoaded = false;

// Cached API key
let cachedApiKey: string | null = null;
let apiKeyFetchPromise: Promise<string | null> | null = null;

/**
 * Get the Maps API key from the database (server-side)
 */
export const getMapsApiKeyServer = (): string | null => {
  if (typeof window !== 'undefined') {
    return null;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getGoogleMapsCredentials } = require('@/lib/db/dal/integrations');
    const credentials = getGoogleMapsCredentials();

    if (!credentials || !credentials.isConfigured || !credentials.isEnabled) {
      return null;
    }

    return credentials.apiKey || null;
  } catch (error) {
    console.error('[GOOGLE_MAPS] Failed to get server credentials:', error);
    return null;
  }
};

/**
 * Get the Maps API key (client-side uses cache, server uses DB)
 */
export const getMapsApiKey = (): string | null => {
  // On server, use database directly
  if (typeof window === 'undefined') {
    return getMapsApiKeyServer();
  }

  // Return cached if available
  return cachedApiKey;
};

/**
 * Fetch Maps API key from server (client-side)
 * Uses public endpoint - no authentication required
 * Security enforced via HTTP referrer restrictions in Google Cloud Console
 */
export const fetchMapsApiKey = async (): Promise<string | null> => {
  if (typeof window === 'undefined') {
    return getMapsApiKeyServer();
  }

  if (cachedApiKey) {
    return cachedApiKey;
  }

  if (apiKeyFetchPromise) {
    return apiKeyFetchPromise;
  }

  apiKeyFetchPromise = (async () => {
    try {
      const response = await fetch('/api/integrations/maps-key', { credentials: 'include' });
      if (!response.ok) {
        return null;
      }

      const data = await response.json();

      if (!data.success || !data.apiKey) {
        return null;
      }

      cachedApiKey = data.apiKey;
      return cachedApiKey;
    } catch (error) {
      console.error('[GOOGLE_MAPS] Failed to fetch API key:', error);
      return null;
    } finally {
      apiKeyFetchPromise = null;
    }
  })();

  return apiKeyFetchPromise;
};

/**
 * Clear cached Maps API key
 */
export const clearMapsApiKeyCache = (): void => {
  cachedApiKey = null;
  apiKeyFetchPromise = null;
};

/**
 * Check if Google Maps is available
 * Uses cached API key - must be fetched first via fetchMapsApiKey()
 * This is a synchronous check for performance
 */
export const isMapsEnabled = (): boolean => {
  // On server, check database credentials
  if (typeof window === 'undefined') {
    return getMapsApiKeyServer() !== null;
  }
  // On client, check if API key was fetched and cached
  return cachedApiKey !== null;
};

/**
 * Get Google Maps status for UI display
 */
export const getMapsStatus = (): {
  available: boolean;
  message: string;
} => {
  const available = isMapsEnabled();
  return {
    available,
    message: available ? 'Location services available' : 'Location services not configured',
  };
};

/**
 * Load the Google Maps JavaScript API
 */
export const loadMapsScript = async (): Promise<void> => {
  if (mapsScriptPromise) {
    return mapsScriptPromise;
  }

  // Try to get cached key first, then fetch if needed
  let apiKey = getMapsApiKey();
  if (!apiKey) {
    apiKey = await fetchMapsApiKey();
  }

  if (!apiKey) {
    throw new Error('Google Maps not configured. Please contact administrator.');
  }

  mapsScriptPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('Window not available'));
      return;
    }

    // Check if already loaded
    if ((window as unknown as { google?: { maps?: unknown } }).google?.maps) {
      mapsScriptLoaded = true;
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;
    script.defer = true;

    script.onload = () => {
      mapsScriptLoaded = true;
      resolve();
    };
    script.onerror = () => {
      mapsScriptPromise = null;
      reject(new Error('Failed to load Google Maps. Please check your API key.'));
    };

    document.head.appendChild(script);
  });

  return mapsScriptPromise;
};

/**
 * Address autocomplete for search inputs
 * Returns error when Maps is not enabled (no fallback data)
 */
export const getAddressPredictions = async (
  input: string,
  options?: {
    types?: string[];
    componentRestrictions?: { country: string | string[] };
  }
): Promise<MapsServiceResult<PlacePrediction[]>> => {
  if (!isMapsEnabled()) {
    const status = getMapsStatus();
    return {
      success: false,
      error: status.message || 'Location services not available',
      integrationDisabled: true,
    };
  }

  if (!input || input.length < 3) {
    return { success: true, data: [] };
  }

  try {
    await loadMapsScript();

    return new Promise((resolve) => {
      const google = (window as unknown as { google: { maps: { places: { AutocompleteService: new () => { getPlacePredictions: (opts: unknown, cb: (predictions: Array<{ place_id: string; description: string; structured_formatting: { main_text: string; secondary_text: string }; types: string[] }> | null, status: string) => void) => void } } } } }).google;
      const service = new google.maps.places.AutocompleteService();

      service.getPlacePredictions(
        {
          input,
          types: options?.types || ['address'],
          componentRestrictions: options?.componentRestrictions || { country: 'gh' },
        },
        (predictions: Array<{ place_id: string; description: string; structured_formatting: { main_text: string; secondary_text: string }; types: string[] }> | null, status: string) => {
          if (status !== 'OK' || !predictions) {
            resolve({ success: true, data: [] });
            return;
          }

          resolve({
            success: true,
            data: predictions.map((p) => ({
              placeId: p.place_id,
              description: p.description,
              mainText: p.structured_formatting.main_text,
              secondaryText: p.structured_formatting.secondary_text,
              types: p.types,
            })),
          });
        }
      );
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Address search failed';
    console.error('[GOOGLE_MAPS] Address search error:', errorMessage);

    return {
      success: false,
      error: errorMessage,
    };
  }
};

/**
 * Get detailed place information
 */
export const getPlaceDetails = async (placeId: string): Promise<MapsServiceResult<PlaceDetails>> => {
  if (!isMapsEnabled()) {
    const status = getMapsStatus();
    return {
      success: false,
      error: status.message || 'Location services not available',
      integrationDisabled: true,
    };
  }

  try {
    await loadMapsScript();

    return new Promise((resolve) => {
      const google = (window as unknown as { google: { maps: { places: { PlacesService: new (div: HTMLDivElement) => { getDetails: (opts: { placeId: string; fields: string[] }, cb: (place: { place_id: string; name: string; formatted_address: string; geometry: { location: { lat: () => number; lng: () => number } }; address_components?: Array<{ types: string[]; long_name: string }> } | null, status: string) => void) => void } } } } }).google;
      const service = new google.maps.places.PlacesService(
        document.createElement('div')
      );

      service.getDetails(
        {
          placeId,
          fields: ['place_id', 'name', 'formatted_address', 'geometry', 'address_components'],
        },
        (place: { place_id: string; name: string; formatted_address: string; geometry: { location: { lat: () => number; lng: () => number } }; address_components?: Array<{ types: string[]; long_name: string }> } | null, status: string) => {
          if (status !== 'OK' || !place) {
            resolve({
              success: false,
              error: 'Failed to get place details',
            });
            return;
          }

          const getComponent = (types: string[]): string | undefined => {
            const component = place.address_components?.find((c) =>
              types.some((t) => c.types.includes(t))
            );
            return component?.long_name;
          };

          resolve({
            success: true,
            data: {
              placeId: place.place_id,
              name: place.name,
              formattedAddress: place.formatted_address,
              latitude: place.geometry.location.lat(),
              longitude: place.geometry.location.lng(),
              city: getComponent(['locality', 'administrative_area_level_2']),
              region: getComponent(['administrative_area_level_1']),
              country: getComponent(['country']),
              postalCode: getComponent(['postal_code']),
            },
          });
        }
      );
    });
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get place details',
    };
  }
};

/**
 * Calculate distance between two locations
 * Falls back to Haversine calculation ONLY if Maps is enabled but Distance API fails
 */
export const calculateDistance = async (
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number
): Promise<MapsServiceResult<{ distanceKm: number; durationMinutes: number }>> => {
  // If Maps is not enabled, still provide Haversine as it's pure math (not an API call)
  // This is acceptable because it doesn't require any API and is a mathematical calculation
  if (!isMapsEnabled()) {
    const haversine = calculateHaversineDistance(originLat, originLng, destLat, destLng);
    return {
      success: true,
      data: haversine,
    };
  }

  try {
    await loadMapsScript();

    return new Promise((resolve) => {
      const google = (window as unknown as { google: { maps: { DistanceMatrixService: new () => { getDistanceMatrix: (opts: unknown, cb: (response: { rows: Array<{ elements: Array<{ status: string; distance: { value: number }; duration: { value: number } }> }> } | null, status: string) => void) => void }; LatLng: new (lat: number, lng: number) => unknown; TravelMode: { DRIVING: string } } } }).google;
      const service = new google.maps.DistanceMatrixService();

      service.getDistanceMatrix(
        {
          origins: [new google.maps.LatLng(originLat, originLng)],
          destinations: [new google.maps.LatLng(destLat, destLng)],
          travelMode: google.maps.TravelMode.DRIVING,
        },
        (response: { rows: Array<{ elements: Array<{ status: string; distance: { value: number }; duration: { value: number } }> }> } | null, status: string) => {
          if (status !== 'OK' || !response) {
            // Fallback to Haversine on API failure
            const haversine = calculateHaversineDistance(originLat, originLng, destLat, destLng);
            resolve({ success: true, data: haversine });
            return;
          }

          const element = response.rows[0]?.elements[0];
          if (element?.status !== 'OK') {
            const haversine = calculateHaversineDistance(originLat, originLng, destLat, destLng);
            resolve({ success: true, data: haversine });
            return;
          }

          resolve({
            success: true,
            data: {
              distanceKm: element.distance.value / 1000,
              durationMinutes: Math.ceil(element.duration.value / 60),
            },
          });
        }
      );
    });
  } catch (error) {
    // Fallback to Haversine on error
    const haversine = calculateHaversineDistance(originLat, originLng, destLat, destLng);
    return { success: true, data: haversine };
  }
};

/**
 * Get current user location
 * This uses browser's geolocation API, not Google Maps
 */
export const getCurrentLocation = (): Promise<{
  latitude: number;
  longitude: number;
} | null> => {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      resolve(null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      () => {
        resolve(null);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000, // 5 minutes
      }
    );
  });
};

/**
 * Reverse geocode coordinates to address
 */
export const reverseGeocode = async (
  latitude: number,
  longitude: number
): Promise<MapsServiceResult<PlaceDetails>> => {
  if (!isMapsEnabled()) {
    const status = getMapsStatus();
    return {
      success: false,
      error: status.message || 'Location services not available',
      integrationDisabled: true,
    };
  }

  try {
    await loadMapsScript();

    return new Promise((resolve) => {
      const google = (window as unknown as { google: { maps: { Geocoder: new () => { geocode: (opts: { location: { lat: number; lng: number } }, cb: (results: Array<{ place_id: string; formatted_address: string; address_components: Array<{ types: string[]; long_name: string }> }> | null, status: string) => void) => void } } } }).google;
      const geocoder = new google.maps.Geocoder();

      geocoder.geocode(
        { location: { lat: latitude, lng: longitude } },
        (results: Array<{ place_id: string; formatted_address: string; address_components: Array<{ types: string[]; long_name: string }> }> | null, status: string) => {
          if (status !== 'OK' || !results?.[0]) {
            resolve({
              success: false,
              error: 'Could not find address for this location',
            });
            return;
          }

          const place = results[0];
          const getComponent = (types: string[]): string | undefined => {
            const component = place.address_components?.find((c) =>
              types.some((t) => c.types.includes(t))
            );
            return component?.long_name;
          };

          resolve({
            success: true,
            data: {
              placeId: place.place_id,
              name: place.formatted_address,
              formattedAddress: place.formatted_address,
              latitude,
              longitude,
              city: getComponent(['locality', 'administrative_area_level_2']),
              region: getComponent(['administrative_area_level_1']),
              country: getComponent(['country']),
              postalCode: getComponent(['postal_code']),
            },
          });
        }
      );
    });
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Reverse geocoding failed',
    };
  }
};

// ============ Pure Math Functions (No API Required) ============

/**
 * Haversine formula for distance calculation
 * This is a pure mathematical calculation, not an API call
 */
const calculateHaversineDistance = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): { distanceKm: number; durationMinutes: number } => {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distanceKm = R * c;

  // Estimate duration assuming average speed of 40 km/h in Ghana traffic
  const durationMinutes = Math.ceil((distanceKm / 40) * 60);

  return { distanceKm: Math.round(distanceKm * 10) / 10, durationMinutes };
};

/**
 * Export Haversine for use when Maps is disabled but distance needed
 */
export const calculateStraightLineDistance = calculateHaversineDistance;

/**
 * Check if coordinates are valid
 */
export const isValidCoordinates = (lat: number, lng: number): boolean => {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    !isNaN(lat) &&
    !isNaN(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
};

/**
 * Format coordinates for display
 */
export const formatCoordinates = (lat: number, lng: number): string => {
  const latDir = lat >= 0 ? 'N' : 'S';
  const lngDir = lng >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(6)}°${latDir}, ${Math.abs(lng).toFixed(6)}°${lngDir}`;
};
