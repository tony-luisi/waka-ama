import { WeatherConditions, TideData, TideTime, TripDayForecast, HourlyTripAssessment, SegmentConditions, RouteSegment } from './types';
import { assessSegment } from './difficulty';
import { estimateChop } from './api/chop-service';
import { WeatherService, windDegreesToCompass } from './api/weather-service';
import { TideService } from './api/tide-service';
import { LOCATION_PROFILES, ROUTE_SEGMENTS } from './config';

const weatherService = new WeatherService();
const tideService = new TideService();

function compassToApproxDegrees(direction: string): number {
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const idx = directions.indexOf(direction);
  return idx >= 0 ? idx * 22.5 : 0;
}

/**
 * Linear blend of OWM 3-hourly samples; wind uses vector interpolation.
 */
function interpolateWeatherAtTime(forecast: WeatherConditions[], targetTime: Date): WeatherConditions {
  if (forecast.length === 0) throw new Error('Empty weather forecast');
  const sorted = [...forecast].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  const t = targetTime.getTime();

  if (sorted.length === 1) return { ...sorted[0], timestamp: targetTime };

  const firstT = sorted[0].timestamp.getTime();
  const lastT = sorted[sorted.length - 1].timestamp.getTime();
  if (t <= firstT) return { ...sorted[0], timestamp: targetTime };
  if (t >= lastT) return { ...sorted[sorted.length - 1], timestamp: targetTime };

  for (let j = 0; j < sorted.length - 1; j++) {
    const t0 = sorted[j].timestamp.getTime();
    const t1 = sorted[j + 1].timestamp.getTime();
    if (t0 <= t && t <= t1) {
      const a = (t - t0) / (t1 - t0);
      const w0 = sorted[j];
      const w1 = sorted[j + 1];
      const deg0 = w0.windDeg ?? compassToApproxDegrees(w0.windDirection);
      const deg1 = w1.windDeg ?? compassToApproxDegrees(w1.windDirection);
      const u0 = -w0.windSpeed * Math.sin((deg0 * Math.PI) / 180);
      const v0 = -w0.windSpeed * Math.cos((deg0 * Math.PI) / 180);
      const u1 = -w1.windSpeed * Math.sin((deg1 * Math.PI) / 180);
      const v1 = -w1.windSpeed * Math.cos((deg1 * Math.PI) / 180);
      const u = u0 + (u1 - u0) * a;
      const v = v0 + (v1 - v0) * a;
      const speed = Math.round(Math.sqrt(u * u + v * v));
      let dirDeg = (Math.atan2(-u, -v) * 180) / Math.PI;
      if (dirDeg < 0) dirDeg += 360;
      return {
        windSpeed: Math.max(0, speed),
        windDirection: windDegreesToCompass(dirDeg),
        windDeg: dirDeg,
        gustSpeed: Math.round(w0.gustSpeed + (w1.gustSpeed - w0.gustSpeed) * a),
        temperature: Math.round(w0.temperature + (w1.temperature - w0.temperature) * a),
        rainMm: Math.round((w0.rainMm + (w1.rainMm - w0.rainMm) * a) * 10) / 10,
        rainProbability: Math.round(w0.rainProbability + (w1.rainProbability - w0.rainProbability) * a),
        timestamp: targetTime
      };
    }
  }

  let best = sorted[0];
  let bestDiff = Math.abs(best.timestamp.getTime() - t);
  for (let i = 1; i < sorted.length; i++) {
    const diff = Math.abs(sorted[i].timestamp.getTime() - t);
    if (diff < bestDiff) { bestDiff = diff; best = sorted[i]; }
  }
  return { ...best, timestamp: targetTime };
}

/**
 * Estimate tidal current speed (km/h) from the rate of height change.
 * dhMs is metres per millisecond from harmonic interpolation.
 * The Tāmaki Estuary is relatively narrow, so current is amplified
 * relative to the open-water rate of height change.
 */
function estimateCurrentKmh(dhMs: number): number {
  const dhMps = Math.abs(dhMs) * 1000; // metres per second
  const rawKmh = dhMps * 3.6; // convert m/s → km/h
  // Empirical amplification: narrow estuary channels concentrate flow.
  // Calibrated so that a typical mid-tide peak produces ~2.5–3.5 km/h.
  const amplified = rawKmh * 7000;
  return Math.min(4.0, Math.round(amplified * 10) / 10);
}

/**
 * Half-cycle harmonic tide interpolation.
 */
function interpolateTideAtTime(targetTime: Date, tideTimes: TideTime[]): TideData {
  if (tideTimes.length === 0) {
    return {
      height: 1.0,
      type: 'high',
      direction: 'slack',
      currentSpeedKmh: 0,
      nextChange: new Date(targetTime.getTime() + 6 * 60 * 60 * 1000),
      timestamp: targetTime
    };
  }

  const sorted = [...tideTimes].sort((a, b) => a.time.getTime() - b.time.getTime());
  const t = targetTime.getTime();
  const tFirst = sorted[0].time.getTime();
  const tLast = sorted[sorted.length - 1].time.getTime();

  if (t <= tFirst) {
    const e0 = sorted[0];
    return {
      height: e0.height,
      type: e0.type,
      direction: 'slack',
      currentSpeedKmh: 0,
      nextChange: sorted.length > 1 ? sorted[1].time : new Date(t + 6 * 60 * 60 * 1000),
      timestamp: targetTime
    };
  }
  if (t >= tLast) {
    const en = sorted[sorted.length - 1];
    return {
      height: en.height,
      type: en.type,
      direction: 'slack',
      currentSpeedKmh: 0,
      nextChange: new Date(t + 6 * 60 * 60 * 1000),
      timestamp: targetTime
    };
  }

  let beforeIdx = 0;
  for (let i = 0; i < sorted.length - 1; i++) {
    if (sorted[i].time.getTime() <= t && t <= sorted[i + 1].time.getTime()) {
      beforeIdx = i; break;
    }
  }

  const before = sorted[beforeIdx];
  const after = sorted[beforeIdx + 1];
  const t0 = before.time.getTime();
  const t1 = after.time.getTime();
  const H0 = before.height;
  const H1 = after.height;
  const tau = Math.max(0, Math.min(1, (t - t0) / (t1 - t0)));

  let height: number;
  let dhMs: number;
  if (before.type === 'high' && after.type === 'low') {
    const mid = (H0 + H1) / 2, amp = (H0 - H1) / 2;
    height = mid + amp * Math.cos(Math.PI * tau);
    dhMs = -amp * (Math.PI / (t1 - t0)) * Math.sin(Math.PI * tau);
  } else if (before.type === 'low' && after.type === 'high') {
    const mid = (H0 + H1) / 2, amp = (H1 - H0) / 2;
    height = mid - amp * Math.cos(Math.PI * tau);
    dhMs = amp * (Math.PI / (t1 - t0)) * Math.sin(Math.PI * tau);
  } else {
    height = H0 + (H1 - H0) * tau;
    dhMs = (H1 - H0) / (t1 - t0);
  }

  const nearTurningPoint = Math.abs(Math.sin(Math.PI * tau)) < 0.14;
  let direction: 'incoming' | 'outgoing' | 'slack';
  if (nearTurningPoint) direction = 'slack';
  else if (dhMs > 0) direction = 'incoming';
  else direction = 'outgoing';

  let nextChange = after.time;
  for (const e of sorted) {
    if (e.time.getTime() > t) { nextChange = e.time; break; }
  }

  return {
    height: Math.round(height * 10) / 10,
    type: height >= (H0 + H1) / 2 ? 'high' : 'low',
    direction,
    currentSpeedKmh: estimateCurrentKmh(dhMs),
    nextChange,
    timestamp: targetTime
  };
}

/**
 * Compute conditions for all segments of a trip at a given hour.
 */
function computeHourlyAssessment(
  time: Date,
  weather: WeatherConditions,
  tide: TideData
): HourlyTripAssessment {
  // Outbound segments (The Ramp → No 9)
  const outboundSegments: SegmentConditions[] = ROUTE_SEGMENTS.map(seg => {
    const profile = LOCATION_PROFILES.find(p => p.nickname === seg.from)!;
    const chop = estimateChop(weather, profile);
    return assessSegment(seg, weather, tide, chop, true);
  });

  // Return segments (No 9 → The Ramp) — reverse order, reverse bearing
  const returnSegments: SegmentConditions[] = [...ROUTE_SEGMENTS].reverse().map(seg => {
    const reverseSeg: RouteSegment = {
      from: seg.to,
      to: seg.from,
      bearingDeg: (seg.bearingDeg + 180) % 360,
      distanceKm: seg.distanceKm
    };
    const profile = LOCATION_PROFILES.find(p => p.nickname === reverseSeg.from)!;
    const chop = estimateChop(weather, profile);
    return assessSegment(reverseSeg, weather, tide, chop, false);
  });

  const avg = (segs: SegmentConditions[]) =>
    Math.round((segs.reduce((s, seg) => s + seg.netAssistanceKmh, 0) / segs.length) * 10) / 10;

  const outboundNetKmh = avg(outboundSegments);
  const returnNetKmh = avg(returnSegments);
  const roundTripNetKmh = Math.round(((outboundNetKmh + returnNetKmh) / 2) * 10) / 10;

  const level = (net: number) => net >= 0.5 ? 'easy' : net >= -1.0 ? 'moderate' : 'difficult';

  return {
    time,
    weather,
    tide,
    outboundSegments,
    returnSegments,
    outboundNetKmh,
    returnNetKmh,
    outboundLevel: level(outboundNetKmh),
    returnLevel: level(returnNetKmh),
    roundTripNetKmh
  };
}

/**
 * Generate a day forecast for the Tāmaki Estuary round trip.
 * Hours 9am–9pm (inclusive).
 */
export async function getTripForecast(date: Date = new Date()): Promise<TripDayForecast> {
  try {
    return await getRealTripForecast(date);
  } catch (error) {
    console.warn('Failed to generate real forecast, using fallback:', error);
    return getFallbackTripForecast(date);
  }
}

async function getRealTripForecast(date: Date): Promise<TripDayForecast> {
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);

  const hoursNeeded = Math.ceil((dayEnd.getTime() - Date.now()) / (1000 * 60 * 60)) + 6;
  const forecastHours = Math.min(120, Math.max(40, hoursNeeded));

  const [weatherForecast, dailyTides] = await Promise.all([
    weatherService.getHourlyForecast(forecastHours),
    tideService.getDailyTides(date)
  ]);

  const hourlyAssessments: HourlyTripAssessment[] = [];

  for (let hour = 9; hour <= 21; hour++) {
    const time = new Date(date);
    time.setHours(hour, 0, 0, 0);

    const weather = interpolateWeatherAtTime(weatherForecast, time);
    const tide = interpolateTideAtTime(time, dailyTides.tides);

    hourlyAssessments.push(computeHourlyAssessment(time, weather, tide));
  }

  return buildTripDayForecast(date, hourlyAssessments);
}

function getFallbackTripForecast(date: Date): TripDayForecast {
  const hourlyAssessments: HourlyTripAssessment[] = [];

  for (let hour = 9; hour <= 21; hour++) {
    const time = new Date(date);
    time.setHours(hour, 0, 0, 0);

    const weather: WeatherConditions = {
      windSpeed: 8 + Math.round(Math.sin((hour - 12) * Math.PI / 12) * 6 + Math.random() * 4),
      windDirection: 'SW',
      windDeg: 225,
      gustSpeed: 14 + Math.round(Math.random() * 8),
      temperature: 20 + Math.round(Math.sin((hour - 14) * Math.PI / 12) * 5),
      rainMm: 0,
      rainProbability: hour > 17 ? Math.round((hour - 17) * 10) : 0,
      timestamp: time
    };

    // Fallback tide: sine wave with ~2.9 km/h peak current
    const phase = (hour + 3) * Math.PI / 6;
    const height = 1.0 + Math.sin(phase) * 0.8;
    const dhDhour = 0.8 * (Math.PI / 6) * Math.cos(phase); // m/hour
    const dhMps = dhDhour / 3600; // m/s
    const currentSpeedKmh = Math.min(4.0, Math.round(Math.abs(dhMps) * 3.6 * 7000 * 10) / 10);

    const tide: TideData = {
      height: Math.round(height * 10) / 10,
      type: hour % 12 < 6 ? 'high' : 'low',
      direction: hour % 12 < 6 ? 'outgoing' : 'incoming',
      currentSpeedKmh,
      nextChange: new Date(time.getTime() + 3 * 60 * 60 * 1000),
      timestamp: time
    };

    hourlyAssessments.push(computeHourlyAssessment(time, weather, tide));
  }

  return buildTripDayForecast(date, hourlyAssessments);
}

function buildTripDayForecast(date: Date, hourlyAssessments: HourlyTripAssessment[]): TripDayForecast {
  let bestWindow: { start: Date; end: Date; netAssistanceKmh: number } | null = null;
  let worstWindow: { start: Date; end: Date; netAssistanceKmh: number } | null = null;

  for (let i = 0; i <= hourlyAssessments.length - 2; i++) {
    const windowNet = (hourlyAssessments[i].roundTripNetKmh + hourlyAssessments[i + 1].roundTripNetKmh) / 2;
    const start = hourlyAssessments[i].time;
    const end = hourlyAssessments[i + 1].time;

    if (!bestWindow || windowNet > bestWindow.netAssistanceKmh) {
      bestWindow = { start, end, netAssistanceKmh: windowNet };
    }
    if (!worstWindow || windowNet < worstWindow.netAssistanceKmh) {
      worstWindow = { start, end, netAssistanceKmh: windowNet };
    }
  }

  return {
    date,
    hourlyAssessments,
    bestWindow,
    worstWindow
  };
}
