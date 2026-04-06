import { WeatherConditions, TideData, PaddlingConditions, LocationData, ExtendedForecast, DailyForecast, HourlyForecast, TideTime } from './types';
import { assessPaddlingDifficulty, assessPaddleDirections } from './difficulty';
import { WeatherService, windDegreesToCompass } from './api/weather-service';
import { TideService } from './api/tide-service';

export const ianShawPark: LocationData = {
  name: 'Ian Shaw Park',
  coordinates: { lat: -36.896944, lng: 174.872778 },
  idealWindDirections: ['NE', 'E', 'SE'],
  sheltered: true
};

export const sampleWeatherConditions: WeatherConditions[] = [
  {
    windSpeed: 5,
    windDirection: 'NE',
    gustSpeed: 8,
    temperature: 22,
    timestamp: new Date('2024-08-17T17:30:00')
  },
  {
    windSpeed: 15,
    windDirection: 'SW',
    gustSpeed: 25,
    temperature: 18,
    timestamp: new Date('2024-08-17T17:30:00')
  },
  {
    windSpeed: 25,
    windDirection: 'W',
    gustSpeed: 35,
    temperature: 16,
    timestamp: new Date('2024-08-17T17:30:00')
  },
  {
    windSpeed: 8,
    windDirection: 'E',
    gustSpeed: 12,
    temperature: 24,
    timestamp: new Date('2024-08-17T16:00:00')
  }
];

export const sampleTideData: TideData[] = [
  {
    height: 1.8,
    type: 'high',
    direction: 'slack',
    nextChange: new Date('2024-08-17T22:15:00'),
    timestamp: new Date('2024-08-17T17:30:00')
  },
  {
    height: 0.4,
    type: 'low',
    direction: 'outgoing',
    nextChange: new Date('2024-08-17T23:45:00'),
    timestamp: new Date('2024-08-17T17:30:00')
  },
  {
    height: 1.2,
    type: 'high',
    direction: 'incoming',
    nextChange: new Date('2024-08-17T21:00:00'),
    timestamp: new Date('2024-08-17T17:30:00')
  }
];

function generateRandomWeather(baseTime: Date, hour: number): WeatherConditions {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  
  // Use a seed based on the hour and date to ensure variety but consistency within the same forecast
  const seed = hour + baseTime.getDate() * 24 + baseTime.getMonth() * 744; // Month * hours per month
  
  // More dynamic wind calculation with seed-based randomness
  const baseWind = 8 + (Math.sin(seed * 0.1) * 15); // 8-23 km/h base range
  const windVariation = Math.sin((hour - 12) * Math.PI / 12) * 4; // Time of day variation
  const randomFactor = (Math.sin(seed * 0.3) + Math.cos(seed * 0.7)) * 3; // Seeded "randomness"
  const windSpeed = Math.max(3, Math.round(baseWind + windVariation + randomFactor));
  
  // Direction based on seeded index
  const directionIndex = Math.floor(Math.abs(Math.sin(seed * 0.2)) * directions.length);
  const windDirection = directions[directionIndex];
  
  // Temperature with more variation
  const baseTemp = 18 + Math.sin((hour - 6) * Math.PI / 12) * 6; // Daily temperature cycle
  const tempVariation = (Math.sin(seed * 0.15) + Math.cos(seed * 0.45)) * 3; // Seeded variation
  const temperature = Math.round(baseTemp + tempVariation);
  
  const windDeg = directionIndex * 22.5;
  const weather = {
    windSpeed: windSpeed,
    windDirection: windDirection,
    windDeg,
    gustSpeed: Math.round(windSpeed + 3 + Math.abs(Math.sin(seed * 0.5)) * 6),
    temperature: temperature,
    timestamp: new Date(baseTime.getTime() + hour * 60 * 60 * 1000)
  };
  
  console.log(`Generated weather for hour ${hour}: ${weather.windSpeed}km/h ${weather.windDirection}, ${weather.temperature}°C, gusts ${weather.gustSpeed}km/h`);
  return weather;
}


function compassToApproxDegrees(direction: string): number {
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const idx = directions.indexOf(direction);
  return idx >= 0 ? idx * 22.5 : 0;
}

/**
 * Half-cycle harmonic between consecutive NIWA highs/lows (linear is a poor fit for water level).
 */
function interpolateTideAtTime(targetTime: Date, tideTimes: TideTime[]): TideData {
  if (tideTimes.length === 0) {
    return {
      height: 1.0,
      type: 'high',
      direction: 'slack',
      nextChange: new Date(targetTime.getTime() + 6 * 60 * 60 * 1000),
      timestamp: targetTime
    };
  }

  const sortedTides = [...tideTimes].sort((a, b) => a.time.getTime() - b.time.getTime());
  const t = targetTime.getTime();
  const tFirst = sortedTides[0].time.getTime();
  const tLast = sortedTides[sortedTides.length - 1].time.getTime();

  if (t <= tFirst) {
    const e0 = sortedTides[0];
    return {
      height: e0.height,
      type: e0.type,
      direction: 'slack',
      nextChange: sortedTides.length > 1 ? sortedTides[1].time : new Date(t + 6 * 60 * 60 * 1000),
      timestamp: targetTime
    };
  }
  if (t >= tLast) {
    const en = sortedTides[sortedTides.length - 1];
    return {
      height: en.height,
      type: en.type,
      direction: 'slack',
      nextChange: new Date(t + 6 * 60 * 60 * 1000),
      timestamp: targetTime
    };
  }

  let beforeIdx = 0;
  for (let i = 0; i < sortedTides.length - 1; i++) {
    const a = sortedTides[i].time.getTime();
    const b = sortedTides[i + 1].time.getTime();
    if (a <= t && t <= b) {
      beforeIdx = i;
      break;
    }
  }

  const beforeTide = sortedTides[beforeIdx];
  const afterTide = sortedTides[beforeIdx + 1];

  if (beforeTide.time.getTime() === afterTide.time.getTime()) {
    return {
      height: beforeTide.height,
      type: beforeTide.type,
      direction: 'slack',
      nextChange: new Date(t + 6 * 60 * 60 * 1000),
      timestamp: targetTime
    };
  }

  const t0 = beforeTide.time.getTime();
  const t1 = afterTide.time.getTime();
  const H0 = beforeTide.height;
  const H1 = afterTide.height;
  const tau = (t - t0) / (t1 - t0);
  const clampedTau = Math.max(0, Math.min(1, tau));

  let height: number;
  let dhMs: number;

  if (beforeTide.type === 'high' && afterTide.type === 'low') {
    const mid = (H0 + H1) / 2;
    const amp = (H0 - H1) / 2;
    height = mid + amp * Math.cos(Math.PI * clampedTau);
    dhMs = -amp * (Math.PI / (t1 - t0)) * Math.sin(Math.PI * clampedTau);
  } else if (beforeTide.type === 'low' && afterTide.type === 'high') {
    const mid = (H0 + H1) / 2;
    const amp = (H1 - H0) / 2;
    height = mid - amp * Math.cos(Math.PI * clampedTau);
    dhMs = amp * (Math.PI / (t1 - t0)) * Math.sin(Math.PI * clampedTau);
  } else {
    height = H0 + (H1 - H0) * clampedTau;
    dhMs = (H1 - H0) / (t1 - t0);
  }

  // Slack = near a turning point on this segment (sin(πτ)→0). Do not use a fixed m/min
  // threshold: ebb/flood rates are ~0.002–0.01 m/min, so an absolute cutoff marked almost
  // the whole cycle as "slack".
  const sinPhase = Math.sin(Math.PI * clampedTau);
  const nearTurningPoint = Math.abs(sinPhase) < 0.14;

  let direction: 'incoming' | 'outgoing' | 'slack';
  if (nearTurningPoint) {
    direction = 'slack';
  } else if (dhMs > 0) {
    direction = 'incoming';
  } else {
    direction = 'outgoing';
  }

  const segMid = (H0 + H1) / 2;
  const type: 'high' | 'low' = height >= segMid ? 'high' : 'low';

  let nextChange = afterTide.time;
  for (const e of sortedTides) {
    if (e.time.getTime() > t) {
      nextChange = e.time;
      break;
    }
  }

  return {
    height: Math.round(height * 10) / 10,
    type,
    direction,
    nextChange,
    timestamp: targetTime
  };
}

/**
 * Linear blend of OWM 3-hourly samples; wind uses vector interpolation (direction + speed).
 */
function interpolateWeatherAtTime(forecast: WeatherConditions[], targetTime: Date): WeatherConditions {
  if (forecast.length === 0) {
    throw new Error('Empty weather forecast');
  }
  const sorted = [...forecast].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  const t = targetTime.getTime();

  if (sorted.length === 1) {
    return { ...sorted[0], timestamp: targetTime };
  }

  const firstT = sorted[0].timestamp.getTime();
  const lastT = sorted[sorted.length - 1].timestamp.getTime();
  if (t <= firstT) {
    return { ...sorted[0], timestamp: targetTime };
  }
  if (t >= lastT) {
    return { ...sorted[sorted.length - 1], timestamp: targetTime };
  }

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
      if (dirDeg < 0) {
        dirDeg += 360;
      }
      const gust = Math.round(w0.gustSpeed + (w1.gustSpeed - w0.gustSpeed) * a);
      const temp = Math.round(w0.temperature + (w1.temperature - w0.temperature) * a);
      return {
        windSpeed: Math.max(0, speed),
        windDirection: windDegreesToCompass(dirDeg),
        windDeg: dirDeg,
        gustSpeed: gust,
        temperature: temp,
        timestamp: targetTime
      };
    }
  }

  let best = sorted[0];
  let bestDiff = Math.abs(best.timestamp.getTime() - t);
  for (let i = 1; i < sorted.length; i++) {
    const diff = Math.abs(sorted[i].timestamp.getTime() - t);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = sorted[i];
    }
  }
  return { ...best, timestamp: targetTime };
}

async function generateDailyForecast(date: Date): Promise<DailyForecast> {
  try {
    return await generateRealDailyForecast(date);
  } catch (error) {
    console.warn('Failed to generate real forecast, using fallback:', error);
    return generateFallbackDailyForecast(date);
  }
}

async function generateRealDailyForecast(date: Date): Promise<DailyForecast> {
  const dayEnd = new Date(date);
  dayEnd.setHours(22, 0, 0, 0);
  const hoursToLastSlot = Math.ceil((dayEnd.getTime() - Date.now()) / (1000 * 60 * 60));
  const forecastHours = Math.min(120, Math.max(40, hoursToLastSlot + 6));

  const [weatherForecast, dailyTides] = await Promise.all([
    weatherService.getHourlyForecast(forecastHours),
    tideService.getDailyTides(date)
  ]);

  const hourlyForecasts: HourlyForecast[] = [];
  
  for (let hour = 6; hour <= 22; hour++) {
    const time = new Date(date);
    time.setHours(hour, 0, 0, 0);
    
    const weather = interpolateWeatherAtTime(weatherForecast, time);
    
    // Interpolate tide from daily tide times
    const tide = interpolateTideAtTime(time, dailyTides.tides);
    
    const conditions: PaddlingConditions = {
      weather,
      tide,
      timeOfDay: time,
      location: ianShawPark.name
    };
    
    const difficulty = assessPaddlingDifficulty(conditions);
    const paddleDirections = assessPaddleDirections(conditions);
    
    hourlyForecasts.push({
      time,
      weather,
      tide,
      difficulty,
      paddleDirections
    });
  }
  
  return buildDailySummary(date, hourlyForecasts);
}

function generateFallbackDailyForecast(date: Date): DailyForecast {
  console.log('generateFallbackDailyForecast called for', date.toDateString());
  // Generate realistic tide times for the day - use our own fallback instead of TideService
  const dailyTides = generateFallbackTideTimes(date);
  console.log('Using generated fallback tides:', dailyTides.tides.map(t => `${t.time.toLocaleTimeString()} ${t.height}m`));

  const hourlyForecasts: HourlyForecast[] = [];
  
  for (let hour = 6; hour <= 22; hour++) {
    const time = new Date(date);
    time.setHours(hour, 0, 0, 0);
    
    const weather = generateRandomWeather(date, hour);
    // Use interpolation for consistent tide data
    const tide = interpolateTideAtTime(time, dailyTides.tides);
    
    const conditions: PaddlingConditions = {
      weather,
      tide,
      timeOfDay: time,
      location: ianShawPark.name
    };
    
    const difficulty = assessPaddlingDifficulty(conditions);
    const paddleDirections = assessPaddleDirections(conditions);
    
    hourlyForecasts.push({
      time,
      weather,
      tide,
      difficulty,
      paddleDirections
    });
  }
  
  return buildDailySummary(date, hourlyForecasts);
}

function generateFallbackTideTimes(date: Date) {
  console.log('data.ts: Generating fallback tide times for', date.toDateString());
  const tides: TideTime[] = [];
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);

  // Generate realistic tide times (roughly every 6 hours with some variation)
  for (let i = 0; i < 4; i++) {
    const baseHour = i * 6 + 2; // Start at 2am, then 8am, 2pm, 8pm
    const variation = (Math.random() - 0.5) * 2; // ±1 hour variation
    const tideTime = new Date(startOfDay.getTime() + (baseHour + variation) * 60 * 60 * 1000);
    
    const isHigh = i % 2 === 0; // Alternate high/low
    const baseHeight = isHigh ? 1.5 : 0.2;
    const heightVariation = (Math.random() - 0.5) * 0.4;
    const finalHeight = Math.round((baseHeight + heightVariation) * 10) / 10;
    
    const tide = {
      time: tideTime,
      height: finalHeight,
      type: isHigh ? 'high' as const : 'low' as const
    };
    
    console.log(`data.ts: Generated tide ${i}: ${tide.time.toLocaleTimeString()} ${tide.height}m ${tide.type}`);
    tides.push(tide);
  }

  // Sort by time
  tides.sort((a, b) => a.time.getTime() - b.time.getTime());
  console.log('data.ts: Final fallback tides:', tides.map(t => `${t.time.toLocaleTimeString()} ${t.height}m ${t.type}`));

  return {
    date: date,
    tides: tides
  };
}

function buildDailySummary(date: Date, hourlyForecasts: HourlyForecast[]): DailyForecast {
  const bestHour = hourlyForecasts.reduce((best, current) => 
    current.difficulty.score > best.difficulty.score ? current : best
  );
  
  const worstHour = hourlyForecasts.reduce((worst, current) => 
    current.difficulty.score < worst.difficulty.score ? current : worst
  );
  
  const averageDifficulty = hourlyForecasts.reduce((sum, forecast) => 
    sum + forecast.difficulty.score, 0) / hourlyForecasts.length;
  
  const easyHours = hourlyForecasts.filter(f => f.difficulty.level === 'easy').length;
  const moderateHours = hourlyForecasts.filter(f => f.difficulty.level === 'moderate').length;
  
  let conditions: string;
  if (easyHours > moderateHours) {
    conditions = 'Generally good conditions throughout the day';
  } else if (moderateHours > easyHours) {
    conditions = 'Mixed conditions - timing will be important';
  } else {
    conditions = 'Challenging conditions expected';
  }
  
  return {
    date,
    hourlyForecasts,
    summary: {
      bestTime: bestHour.time,
      worstTime: worstHour.time,
      averageDifficulty: Math.round(averageDifficulty * 10) / 10,
      conditions
    }
  };
}

export async function getExtendedForecast(): Promise<ExtendedForecast> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  try {
    const [todayForecast, tomorrowForecast] = await Promise.all([
      generateDailyForecast(today),
      generateDailyForecast(tomorrow)
    ]);

    return {
      today: todayForecast,
      tomorrow: tomorrowForecast
    };
  } catch (error) {
    console.warn('Failed to get extended forecast, using fallback:', error);
    return {
      today: generateFallbackDailyForecast(today),
      tomorrow: generateFallbackDailyForecast(tomorrow)
    };
  }
}

const weatherService = new WeatherService();
const tideService = new TideService();

export async function getCurrentConditions(): Promise<PaddlingConditions> {
  try {
    const [weather, tide] = await Promise.all([
      weatherService.getCurrentWeather(),
      tideService.getCurrentTide()
    ]);

    return {
      weather,
      tide,
      timeOfDay: new Date(),
      location: ianShawPark.name
    };
  } catch (error) {
    console.warn('Failed to fetch current conditions, using fallback:', error);
    return getCurrentConditionsFallback();
  }
}

export function getCurrentConditionsFallback(weatherIndex: number = 0, tideIndex: number = 0): PaddlingConditions {
  return {
    weather: sampleWeatherConditions[weatherIndex] || sampleWeatherConditions[0],
    tide: sampleTideData[tideIndex] || sampleTideData[0],
    timeOfDay: new Date(),
    location: ianShawPark.name
  };
}