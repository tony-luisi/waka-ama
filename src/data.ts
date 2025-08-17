import { WeatherConditions, TideData, PaddlingConditions, LocationData, ExtendedForecast, DailyForecast, HourlyForecast, TideTime } from './types';
import { assessPaddlingDifficulty, assessPaddleDirections } from './difficulty';
import { WeatherService } from './api/weather-service';
import { TideService } from './api/tide-service';

export const ianShawPark: LocationData = {
  name: 'Ian Shaw Park',
  coordinates: { lat: -36.8485, lng: 174.7633 },
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
  
  const weather = {
    windSpeed: windSpeed,
    windDirection: windDirection,
    gustSpeed: Math.round(windSpeed + 3 + Math.abs(Math.sin(seed * 0.5)) * 6),
    temperature: temperature,
    timestamp: new Date(baseTime.getTime() + hour * 60 * 60 * 1000)
  };
  
  console.log(`Generated weather for hour ${hour}: ${weather.windSpeed}km/h ${weather.windDirection}, ${weather.temperature}°C, gusts ${weather.gustSpeed}km/h`);
  return weather;
}


function interpolateTideAtTime(targetTime: Date, tideTimes: TideTime[]): TideData {
  if (tideTimes.length === 0) {
    console.warn('No tide times available for interpolation');
    // Fallback if no tide data
    return {
      height: 1.0,
      type: 'high',
      direction: 'slack',
      nextChange: new Date(targetTime.getTime() + 6 * 60 * 60 * 1000),
      timestamp: targetTime
    };
  }

  // Sort tide times by time
  const sortedTides = [...tideTimes].sort((a, b) => a.time.getTime() - b.time.getTime());
  
  console.log('Interpolating for', targetTime.toLocaleTimeString(), 'with tides:', 
    sortedTides.map(t => `${t.time.toLocaleTimeString()} ${t.height}m ${t.type}`));
  console.log('Target time epoch:', targetTime.getTime());
  
  // Find the two tide times that bracket our target time
  let beforeTide: TideTime | null = null;
  let afterTide: TideTime | null = null;

  for (let i = 0; i < sortedTides.length; i++) {
    const tideTime = sortedTides[i].time.getTime();
    console.log(`Checking tide ${i}: ${sortedTides[i].time.toLocaleTimeString()} (${tideTime}) vs target (${targetTime.getTime()})`);
    
    if (tideTime <= targetTime.getTime()) {
      beforeTide = sortedTides[i];
      console.log(`  -> Set as beforeTide: ${beforeTide.time.toLocaleTimeString()} ${beforeTide.height}m`);
    }
    if (tideTime > targetTime.getTime() && !afterTide) {
      afterTide = sortedTides[i];
      console.log(`  -> Set as afterTide: ${afterTide.time.toLocaleTimeString()} ${afterTide.height}m`);
      break;
    }
  }
  
  console.log(`Final bracketing: before=${beforeTide?.time.toLocaleTimeString()} ${beforeTide?.height}m, after=${afterTide?.time.toLocaleTimeString()} ${afterTide?.height}m`);

  // If we don't have before/after, use closest available
  if (!beforeTide && afterTide) {
    beforeTide = afterTide;
  }
  if (!afterTide && beforeTide) {
    afterTide = beforeTide;
  }

  // If we still don't have tides, use first available
  if (!beforeTide || !afterTide) {
    const tide = sortedTides[0];
    console.warn('No proper tide bracketing found, using first tide:', tide);
    return {
      height: tide.height,
      type: tide.type,
      direction: 'slack',
      nextChange: new Date(targetTime.getTime() + 6 * 60 * 60 * 1000),
      timestamp: targetTime
    };
  }

  // If beforeTide and afterTide are the same, we have an issue with the data
  if (beforeTide.time.getTime() === afterTide.time.getTime()) {
    console.warn('beforeTide and afterTide are the same time - tide data issue!', beforeTide);
    // Generate a synthetic tide based on time of day
    const hour = targetTime.getHours();
    const tidePattern = Math.sin((hour + 3) * Math.PI / 6);
    const syntheticHeight = 1.0 + tidePattern * 0.8;
    const direction = tidePattern > 0 ? 'incoming' : 'outgoing';
    
    return {
      height: Math.round(syntheticHeight * 10) / 10,
      type: syntheticHeight > 1.2 ? 'high' : 'low',
      direction: direction,
      nextChange: new Date(targetTime.getTime() + 6 * 60 * 60 * 1000),
      timestamp: targetTime
    };
  }

  // Interpolate height between the two tide times
  const timeDiff = afterTide.time.getTime() - beforeTide.time.getTime();
  const targetDiff = targetTime.getTime() - beforeTide.time.getTime();
  const ratio = timeDiff > 0 ? targetDiff / timeDiff : 0;

  const interpolatedHeight = beforeTide.height + (afterTide.height - beforeTide.height) * ratio;

  // Determine direction based on whether tide is rising or falling
  let direction: 'incoming' | 'outgoing' | 'slack';
  const heightDiff = afterTide.height - beforeTide.height;
  if (Math.abs(heightDiff) < 0.1) {
    direction = 'slack';
  } else if (heightDiff > 0) {
    direction = 'incoming';
  } else {
    direction = 'outgoing';
  }

  // Determine type based on height relative to average
  const avgHeight = sortedTides.reduce((sum, t) => sum + t.height, 0) / sortedTides.length;
  const type: 'high' | 'low' = interpolatedHeight > avgHeight ? 'high' : 'low';

  console.log(`Interpolated: ${interpolatedHeight.toFixed(1)}m ${direction} between ${beforeTide.height}m and ${afterTide.height}m (ratio: ${ratio.toFixed(2)})`);

  return {
    height: Math.round(interpolatedHeight * 10) / 10,
    type: type,
    direction: direction,
    nextChange: afterTide.time,
    timestamp: targetTime
  };
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
  const hoursFromNow = Math.max(0, Math.floor((date.getTime() - Date.now()) / (1000 * 60 * 60)));
  const [weatherForecast, dailyTides] = await Promise.all([
    weatherService.getHourlyForecast(24 + hoursFromNow),
    tideService.getDailyTides(date)
  ]);

  const hourlyForecasts: HourlyForecast[] = [];
  
  for (let hour = 6; hour <= 22; hour++) {
    const time = new Date(date);
    time.setHours(hour, 0, 0, 0);
    
    const hourIndex = Math.floor((time.getTime() - Date.now()) / (1000 * 60 * 60));
    const weather = weatherForecast[Math.max(0, hourIndex)] || weatherForecast[0];
    
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