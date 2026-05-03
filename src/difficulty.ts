import { SegmentConditions, RouteSegment, WeatherConditions, TideData, ChopConditions } from './types';

/** Convert 16-point compass label to approximate degrees. */
function compassToDegrees(direction: string): number {
  const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
  const idx = dirs.indexOf(direction);
  return idx >= 0 ? idx * 22.5 : 0;
}

/**
 * Estimate wind speed impact on a segment (km/h).
 * Positive = tailwind helps, negative = headwind hurts.
 * Headwind penalty is larger than tailwind benefit because drag is asymmetric.
 */
function windImpactKmh(wind: WeatherConditions, segment: RouteSegment): number {
  const windFromDeg = wind.windDeg ?? compassToDegrees(wind.windDirection);
  const windTowardDeg = (windFromDeg + 180) % 360;

  let angleDiff = Math.abs(segment.bearingDeg - windTowardDeg);
  if (angleDiff > 180) angleDiff = 360 - angleDiff;

  // cos(0°)=1 full tailwind, cos(90°)=0 crosswind, cos(180°)=-1 full headwind
  const component = Math.cos((angleDiff * Math.PI) / 180);

  if (component >= 0) {
    // Tailwind helps less than headwind hurts
    return Math.round(component * wind.windSpeed * 0.03 * 10) / 10;
  }
  // Headwind
  return Math.round(component * wind.windSpeed * 0.08 * 10) / 10;
}

/**
 * Estimate tide current impact on a segment (km/h).
 * Positive = following current helps, negative = opposing current hurts.
 */
function tideImpactKmh(tide: TideData, isOutbound: boolean): number {
  // outgoing (ebb) flows west→east → assists outbound
  // incoming (flood) flows east→west → assists return
  const assists =
    (isOutbound && tide.direction === 'outgoing') ||
    (!isOutbound && tide.direction === 'incoming');

  const opposes =
    (isOutbound && tide.direction === 'incoming') ||
    (!isOutbound && tide.direction === 'outgoing');

  if (assists) return tide.currentSpeedKmh;
  if (opposes) return -tide.currentSpeedKmh;
  return 0;
}

/**
 * Estimate chop drag impact (km/h).
 * Chop is always negative — it creates pitching drag and reduces efficiency.
 */
function chopImpactKmh(chop: ChopConditions): number {
  return -Math.round(chop.height * 3 * 10) / 10;
}

/**
 * Estimate rain impact (km/h).
 * Rain is always negative — reduced visibility, grip, and morale.
 */
function rainImpactKmh(weather: WeatherConditions): number {
  if (weather.rainProbability === 0 && weather.rainMm === 0) return 0;
  if (weather.rainProbability <= 30 && weather.rainMm <= 1) return -0.2;
  if (weather.rainProbability <= 60 && weather.rainMm <= 5) return -0.5;
  return -0.8;
}

function levelFromNet(net: number): 'easy' | 'moderate' | 'difficult' {
  if (net >= 0.5) return 'easy';
  if (net >= -1.0) return 'moderate';
  return 'difficult';
}

/**
 * Assess conditions for a single route segment.
 * Returns net assistance in km/h (positive = helps, negative = opposes)
 * and a qualitative level.
 */
export function assessSegment(
  segment: RouteSegment,
  weather: WeatherConditions,
  tide: TideData,
  chop: ChopConditions,
  isOutbound: boolean
): SegmentConditions {
  const w = windImpactKmh(weather, segment);
  const t = tideImpactKmh(tide, isOutbound);
  const c = chopImpactKmh(chop);
  const r = rainImpactKmh(weather);

  const net = Math.round((w + t + c + r) * 10) / 10;

  return {
    segment,
    windImpactKmh: w,
    tideImpactKmh: t,
    chopImpactKmh: c,
    chopHeightCm: Math.round(chop.height * 100),
    rainImpactKmh: r,
    netAssistanceKmh: net,
    level: levelFromNet(net)
  };
}
