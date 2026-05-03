import { WeatherConditions, ChopConditions, LocationProfile } from '../types';

const DIRECTIONS = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];

function windDegToCompass(deg: number): string {
  const idx = Math.round(((deg % 360) + 360) % 360 / 22.5) % 16;
  return DIRECTIONS[idx];
}

/**
 * Estimate chop height at a location based on wind speed, fetch distance,
 * and exposure. Tuned for a small enclosed estuary — max ~30cm.
 *
 * Formula: chop = windSpeedKmH * fetchKm * exposureMult * 0.00006
 * With exposureMult: sheltered 0.6, moderate 0.85, exposed 1.1
 */
export function estimateChop(weather: WeatherConditions, profile: LocationProfile): ChopConditions {
  const windDir = windDegToCompass(weather.windDeg ?? 0);
  const fetchKm = profile.fetchByDirection[windDir] ?? 2.0;

  const exposureMult = {
    sheltered: 0.6,
    moderate: 0.85,
    exposed: 1.1
  }[profile.exposure];

  // Base chop from wind speed and fetch
  let chop = weather.windSpeed * fetchKm * exposureMult * 0.00006;

  // Gust boost: stronger gusts create steeper chop
  const gustSpread = weather.gustSpeed - weather.windSpeed;
  if (gustSpread > 10) chop *= 1.15;
  else if (gustSpread > 5) chop *= 1.08;

  // Cap at 30cm for the Tāmaki Estuary
  chop = Math.min(0.30, chop);

  return {
    height: Math.round(chop * 100) / 100, // metres, rounded to 1cm
    fetchKm: Math.round(fetchKm * 10) / 10
  };
}
