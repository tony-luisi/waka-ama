import { WeatherConditions } from '../types';
import { API_CONFIG } from '../config';

/** 16-point compass from meteorological degrees (direction wind comes FROM). */
export function windDegreesToCompass(degrees: number): string {
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const index = Math.round(((degrees % 360) + 360) % 360 / 22.5) % 16;
  return directions[index];
}

export interface OpenWeatherMapResponse {
  main: {
    temp: number;
    humidity: number;
    pressure: number;
  };
  wind: {
    speed: number;
    deg: number;
    gust?: number;
  };
  rain?: {
    '1h'?: number;
    '3h'?: number;
  };
  dt: number;
}

export interface OpenWeatherMapForecastResponse {
  list: Array<{
    main: {
      temp: number;
      humidity: number;
    };
    wind: {
      speed: number;
      deg: number;
      gust?: number;
    };
    rain?: {
      '3h'?: number;
    };
    pop: number;
    dt: number;
  }>;
}

export class WeatherService {
  private buildUrl(kind: 'current' | 'forecast', lat: number, lng: number, apiKey: string | undefined): string {
    const base = API_CONFIG.openWeatherMap.baseUrl;
    const query = new URLSearchParams({
      lat: String(lat),
      lon: String(lng),
      units: 'metric'
    });
    if (apiKey) query.set('appid', apiKey);
    if (base.startsWith('/api')) {
      if (kind === 'forecast') query.set('type', 'forecast');
      return `${base}?${query}`;
    }
    const path = kind === 'forecast' ? 'forecast' : 'weather';
    return `${base}/${path}?${query}`;
  }

  async getCurrentWeather(): Promise<WeatherConditions> {
    try {
      return await this.getOpenWeatherMapData();
    } catch (error) {
      console.warn('Failed to fetch real weather data, using fallback:', error);
      return this.getFallbackWeather();
    }
  }

  private async getOpenWeatherMapData(): Promise<WeatherConditions> {
    const { lat, lng } = API_CONFIG.estuaryCentre;
    const apiKey = API_CONFIG.openWeatherMap.apiKey;
    if (!apiKey && !API_CONFIG.openWeatherMap.baseUrl.startsWith('/api')) {
      throw new Error('OpenWeatherMap API key not configured');
    }

    const url = this.buildUrl('current', lat, lng, apiKey);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Weather API error: ${response.status}`);

    const data: OpenWeatherMapResponse = await response.json();
    const deg = data.wind?.deg ?? 0;
    return {
      windSpeed: Math.round((data.wind?.speed ?? 0) * 3.6),
      windDirection: windDegreesToCompass(deg),
      windDeg: deg,
      gustSpeed: data.wind?.gust ? Math.round(data.wind.gust * 3.6) : Math.round((data.wind?.speed ?? 0) * 3.6 * 1.3),
      temperature: Math.round(data.main.temp),
      rainMm: data.rain?.['1h'] ?? data.rain?.['3h'] ?? 0,
      rainProbability: 0,
      timestamp: new Date(data.dt * 1000)
    };
  }

  async getHourlyForecast(hours: number = 24): Promise<WeatherConditions[]> {
    try {
      return await this.getOpenWeatherMapForecast(hours);
    } catch (error) {
      console.warn('Failed to fetch forecast data, using fallback:', error);
      return this.getFallbackForecast(hours);
    }
  }

  private async getOpenWeatherMapForecast(hours: number): Promise<WeatherConditions[]> {
    const { lat, lng } = API_CONFIG.estuaryCentre;
    const apiKey = API_CONFIG.openWeatherMap.apiKey;
    if (!apiKey && !API_CONFIG.openWeatherMap.baseUrl.startsWith('/api')) {
      throw new Error('OpenWeatherMap API key not configured');
    }

    const url = this.buildUrl('forecast', lat, lng, apiKey);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Forecast API error: ${response.status}`);

    const data: OpenWeatherMapForecastResponse = await response.json();
    return data.list.slice(0, Math.ceil(hours / 3)).map((item) => {
      const deg = item.wind?.deg ?? 0;
      return {
        windSpeed: Math.round(item.wind.speed * 3.6),
        windDirection: windDegreesToCompass(deg),
        windDeg: deg,
        gustSpeed: item.wind.gust ? Math.round(item.wind.gust * 3.6) : Math.round(item.wind.speed * 3.6 * 1.3),
        temperature: Math.round(item.main.temp),
        rainMm: item.rain?.['3h'] ?? 0,
        rainProbability: Math.round((item.pop ?? 0) * 100),
        timestamp: new Date(item.dt * 1000)
      };
    });
  }

  private getFallbackWeather(): WeatherConditions {
    return {
      windSpeed: 8 + Math.round(Math.random() * 12),
      windDirection: ['NE', 'E', 'SE', 'S', 'SW'][Math.floor(Math.random() * 5)],
      gustSpeed: 12 + Math.round(Math.random() * 15),
      temperature: 18 + Math.round(Math.random() * 8),
      rainMm: 0,
      rainProbability: 0,
      timestamp: new Date()
    };
  }

  private getFallbackForecast(hours: number): WeatherConditions[] {
    const forecasts: WeatherConditions[] = [];
    const now = new Date();
    for (let i = 0; i < hours; i++) {
      const time = new Date(now.getTime() + i * 60 * 60 * 1000);
      forecasts.push({
        windSpeed: 5 + Math.round(Math.random() * 15),
        windDirection: ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.floor(Math.random() * 8)],
        gustSpeed: 8 + Math.round(Math.random() * 20),
        temperature: 16 + Math.round(Math.random() * 10 + Math.sin((i - 6) * Math.PI / 12) * 4),
        rainMm: Math.random() > 0.7 ? Math.round(Math.random() * 5 * 10) / 10 : 0,
        rainProbability: Math.random() > 0.7 ? Math.round(Math.random() * 100) : 0,
        timestamp: time
      });
    }
    return forecasts;
  }
}
