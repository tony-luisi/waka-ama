import type { LocationProfile, RouteSegment } from './types';

// Determine if we're running in production (Vercel) or development
const isProduction = typeof window !== 'undefined' && window.location.hostname !== 'localhost';

export const API_CONFIG = {
  apiBaseUrl: isProduction ? '' : 'http://localhost:5173',

  niwa: {
    baseUrl: 'https://tides.niwa.co.nz',
    apiUrl: isProduction ? '/api/niwa-tides' : 'https://forecast-v2.metservice.com/niwa/tide',
    apiKey: isProduction ? undefined : import.meta.env.VITE_NIWA_API_KEY || 'yWcExmYHoto0wFcQC6hIwSZtSv0oSeGy'
  },

  openWeatherMap: {
    baseUrl: isProduction ? '/api/weather' : 'https://api.openweathermap.org/data/2.5',
    apiKey: isProduction ? undefined : import.meta.env.VITE_OPENWEATHER_API_KEY || 'e897cab153a2616dff2c7e0563c8e50e'
  },

  openAI: {
    apiUrl: isProduction ? '/api/forecast-synthesis' : 'http://localhost:5173/api/forecast-synthesis',
    apiKey: isProduction ? undefined : import.meta.env.VITE_OPENAI_API_KEY
  },

  /** Estuary centre for weather/tide API calls. */
  estuaryCentre: {
    lat: -36.899,
    lng: 174.880,
    name: 'Tāmaki Estuary'
  }
};

/** 11 waypoints along the Tāmaki Estuary paddling route, west to east. */
export const WAYPOINTS = [
  { nickname: 'The Ramp',     lat: -36.922974, lng: 174.860742 },
  { nickname: 'Rayglass',     lat: -36.918057, lng: 174.858269 },
  { nickname: 'Red Pole',     lat: -36.915903, lng: 174.857414 },
  { nickname: 'Second Bridge',lat: -36.907844, lng: 174.858737 },
  { nickname: 'Tamaki',       lat: -36.903573, lng: 174.869101 },
  { nickname: 'St Kents',     lat: -36.902355, lng: 174.873527 },
  { nickname: 'The Kat',      lat: -36.896021, lng: 174.875629 },
  { nickname: 'First Red',    lat: -36.886970, lng: 174.874164 },
  { nickname: 'Third Red',    lat: -36.880993, lng: 174.879123 },
  { nickname: 'Half Moon Bay',lat: -36.879359, lng: 174.894642 },
  { nickname: 'No 9',         lat: -36.875439, lng: 174.899879 },
] as const;

/** Compute bearing (degrees, 0=North) from point A to point B. */
function bearing(from: { lat: number; lng: number }, to: { lat: number; lng: number }): number {
  const toRad = Math.PI / 180;
  const φ1 = from.lat * toRad;
  const φ2 = to.lat * toRad;
  const Δλ = (to.lng - from.lng) * toRad;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  let θ = Math.atan2(y, x);
  θ = (θ * 180 / Math.PI + 360) % 360;
  return θ;
}

/** Compute distance (km) between two points using haversine. */
function distance(from: { lat: number; lng: number }, to: { lat: number; lng: number }): number {
  const R = 6371;
  const toRad = Math.PI / 180;
  const Δφ = (to.lat - from.lat) * toRad;
  const Δλ = (to.lng - from.lng) * toRad;
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(from.lat * toRad) * Math.cos(to.lat * toRad) * Math.sin(Δλ / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** The 10 route segments from The Ramp to No 9. */
export const ROUTE_SEGMENTS: RouteSegment[] = WAYPOINTS.slice(0, -1).map((from, i) => {
  const to = WAYPOINTS[i + 1];
  return {
    from: from.nickname,
    to: to.nickname,
    bearingDeg: Math.round(bearing(from, to)),
    distanceKm: Math.round(distance(from, to) * 100) / 100
  };
});

/**
 * Fetch distance (km) for each 16-point wind direction at each waypoint.
 * These are estimates based on the estuary geography — how much open water
 * the wind blows across to reach this spot.
 */
const DIRECTIONS = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'] as const;

function makeFetch(exposures: Partial<Record<typeof DIRECTIONS[number], number>>): Record<string, number> {
  const defaults: Record<string, number> = {};
  for (const d of DIRECTIONS) {
    defaults[d] = exposures[d] ?? 2.0;
  }
  return defaults;
}

export const LOCATION_PROFILES: LocationProfile[] = [
  {
    nickname: 'The Ramp',
    coordinates: { lat: WAYPOINTS[0].lat, lng: WAYPOINTS[0].lng },
    exposure: 'exposed' as const,
    fetchByDirection: makeFetch({ N: 3, NE: 4, E: 5, SE: 3, S: 2, SW: 5, W: 3, NW: 2 })
  },
  {
    nickname: 'Rayglass',
    coordinates: { lat: WAYPOINTS[1].lat, lng: WAYPOINTS[1].lng },
    exposure: 'exposed' as const,
    fetchByDirection: makeFetch({ N: 3, NE: 4, E: 4, SE: 3, S: 2, SW: 4, W: 2, NW: 2 })
  },
  {
    nickname: 'Red Pole',
    coordinates: { lat: WAYPOINTS[2].lat, lng: WAYPOINTS[2].lng },
    exposure: 'moderate' as const,
    fetchByDirection: makeFetch({ N: 2, NE: 3, E: 4, SE: 3, S: 2, SW: 3, W: 2, NW: 2 })
  },
  {
    nickname: 'Second Bridge',
    coordinates: { lat: WAYPOINTS[3].lat, lng: WAYPOINTS[3].lng },
    exposure: 'moderate' as const,
    fetchByDirection: makeFetch({ N: 2, NE: 3, E: 3, SE: 2, S: 2, SW: 3, W: 2, NW: 2 })
  },
  {
    nickname: 'Tamaki',
    coordinates: { lat: WAYPOINTS[4].lat, lng: WAYPOINTS[4].lng },
    exposure: 'moderate' as const,
    fetchByDirection: makeFetch({ N: 2, NE: 3, E: 3, SE: 2, S: 2, SW: 2, W: 2, NW: 2 })
  },
  {
    nickname: 'St Kents',
    coordinates: { lat: WAYPOINTS[5].lat, lng: WAYPOINTS[5].lng },
    exposure: 'moderate' as const,
    fetchByDirection: makeFetch({ N: 2, NE: 3, E: 3, SE: 2, S: 2, SW: 2, W: 2, NW: 2 })
  },
  {
    nickname: 'The Kat',
    coordinates: { lat: WAYPOINTS[6].lat, lng: WAYPOINTS[6].lng },
    exposure: 'moderate' as const,
    fetchByDirection: makeFetch({ N: 2, NE: 3, E: 3, SE: 2, S: 2, SW: 2, W: 2, NW: 2 })
  },
  {
    nickname: 'First Red',
    coordinates: { lat: WAYPOINTS[7].lat, lng: WAYPOINTS[7].lng },
    exposure: 'moderate' as const,
    fetchByDirection: makeFetch({ N: 2, NE: 3, E: 3, SE: 2, S: 2, SW: 2, W: 2, NW: 2 })
  },
  {
    nickname: 'Third Red',
    coordinates: { lat: WAYPOINTS[8].lat, lng: WAYPOINTS[8].lng },
    exposure: 'moderate' as const,
    fetchByDirection: makeFetch({ N: 2, NE: 3, E: 4, SE: 3, S: 2, SW: 2, W: 2, NW: 2 })
  },
  {
    nickname: 'Half Moon Bay',
    coordinates: { lat: WAYPOINTS[9].lat, lng: WAYPOINTS[9].lng },
    exposure: 'sheltered' as const,
    fetchByDirection: makeFetch({ N: 2, NE: 3, E: 3, SE: 2, S: 1, SW: 1, W: 2, NW: 2 })
  },
  {
    nickname: 'No 9',
    coordinates: { lat: WAYPOINTS[10].lat, lng: WAYPOINTS[10].lng },
    exposure: 'sheltered' as const,
    fetchByDirection: makeFetch({ N: 2, NE: 3, E: 3, SE: 2, S: 1, SW: 1, W: 2, NW: 2 })
  }
];
