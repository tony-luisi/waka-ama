export interface WeatherConditions {
  windSpeed: number;
  windDirection: string;
  /** Degrees wind comes FROM (met convention). */
  windDeg?: number;
  gustSpeed: number;
  temperature: number;
  rainMm: number;
  rainProbability: number;
  timestamp: Date;
}

export interface TideData {
  height: number;
  type: 'high' | 'low';
  direction: 'incoming' | 'outgoing' | 'slack';
  /** Estimated tidal current speed (km/h). Positive magnitude only; direction field gives sign context. */
  currentSpeedKmh: number;
  nextChange: Date;
  timestamp: Date;
}

export interface TideTime {
  time: Date;
  height: number;
  type: 'high' | 'low';
}

export interface DailyTides {
  date: Date;
  tides: TideTime[];
  isFallback?: boolean;
}

export interface LocationProfile {
  nickname: string;
  coordinates: { lat: number; lng: number };
  exposure: 'sheltered' | 'moderate' | 'exposed';
  /** Approximate fetch distance (km) for each 16-point wind direction. */
  fetchByDirection: Record<string, number>;
}

export interface RouteSegment {
  from: string;
  to: string;
  bearingDeg: number;
  distanceKm: number;
}

export interface ChopConditions {
  height: number; // metres
  fetchKm: number;
}

/**
 * Net-assessment for a single segment.
 * All impact fields are in km/h. Positive = helps you, negative = works against you.
 */
export interface SegmentConditions {
  segment: RouteSegment;
  windImpactKmh: number;
  tideImpactKmh: number;
  chopImpactKmh: number;
  chopHeightCm: number;
  rainImpactKmh: number;
  netAssistanceKmh: number;
  level: 'easy' | 'moderate' | 'difficult';
}

export interface HourlyTripAssessment {
  time: Date;
  weather: WeatherConditions;
  tide: TideData;
  outboundSegments: SegmentConditions[];
  returnSegments: SegmentConditions[];
  outboundNetKmh: number;
  returnNetKmh: number;
  outboundLevel: 'easy' | 'moderate' | 'difficult';
  returnLevel: 'easy' | 'moderate' | 'difficult';
  roundTripNetKmh: number;
}

export interface TripDayForecast {
  date: Date;
  hourlyAssessments: HourlyTripAssessment[];
  bestWindow: { start: Date; end: Date; netAssistanceKmh: number } | null;
  worstWindow: { start: Date; end: Date; netAssistanceKmh: number } | null;
}

export interface AISynthesis {
  narrative: string;
  bestWindow: string;
  routeRecommendation: string;
  safetyAlerts: string[];
  perSegmentNotes: Record<string, string>;
}
