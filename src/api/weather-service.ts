import { WeatherConditions } from '../types';
import { API_CONFIG } from '../config';

export interface MetServiceObservation {
  station: string;
  time: string;
  temperature: number;
  windSpeed: number;
  windDirection: string;
  gustSpeed?: number;
  humidity?: number;
  pressure?: number;
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
  dt: number;
}

export class WeatherService {
  
  async getCurrentWeather(): Promise<WeatherConditions> {
    try {
      return await this.getOpenWeatherMapData();
    } catch (error) {
      console.warn('Failed to fetch real weather data, using fallback:', error);
      return this.getFallbackWeather();
    }
  }

  private async getOpenWeatherMapData(): Promise<WeatherConditions> {
    const { lat, lng } = API_CONFIG.locations.ianShawPark;
    const apiKey = API_CONFIG.fallback.openWeatherMap.apiKey;
    
    // In production, API key is handled by the server proxy
    if (!apiKey && !API_CONFIG.fallback.openWeatherMap.baseUrl.startsWith('/api')) {
      throw new Error('OpenWeatherMap API key not configured');
    }

    const url = `${API_CONFIG.fallback.openWeatherMap.baseUrl}?lat=${lat}&lon=${lng}${apiKey ? `&appid=${apiKey}` : ''}&units=metric`;
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Weather API error: ${response.status}`);
    }

    const data: OpenWeatherMapResponse = await response.json();
    
    return {
      windSpeed: Math.round(data.wind.speed * 3.6),
      windDirection: this.degreesToCompass(data.wind.deg),
      gustSpeed: data.wind.gust ? Math.round(data.wind.gust * 3.6) : Math.round(data.wind.speed * 3.6 * 1.3),
      temperature: Math.round(data.main.temp),
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
    const { lat, lng } = API_CONFIG.locations.ianShawPark;
    const apiKey = API_CONFIG.fallback.openWeatherMap.apiKey;
    
    // In production, API key is handled by the server proxy
    if (!apiKey && !API_CONFIG.fallback.openWeatherMap.baseUrl.startsWith('/api')) {
      throw new Error('OpenWeatherMap API key not configured');
    }

    const url = `${API_CONFIG.fallback.openWeatherMap.baseUrl}?lat=${lat}&lon=${lng}&type=forecast${apiKey ? `&appid=${apiKey}` : ''}&units=metric`;
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Forecast API error: ${response.status}`);
    }

    const data = await response.json();
    
    return data.list.slice(0, Math.ceil(hours / 3)).map((item: any) => ({
      windSpeed: Math.round(item.wind.speed * 3.6),
      windDirection: this.degreesToCompass(item.wind.deg),
      gustSpeed: item.wind.gust ? Math.round(item.wind.gust * 3.6) : Math.round(item.wind.speed * 3.6 * 1.3),
      temperature: Math.round(item.main.temp),
      timestamp: new Date(item.dt * 1000)
    }));
  }

  private degreesToCompass(degrees: number): string {
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const index = Math.round(degrees / 22.5) % 16;
    return directions[index];
  }

  private getFallbackWeather(): WeatherConditions {
    return {
      windSpeed: 8 + Math.round(Math.random() * 12),
      windDirection: ['NE', 'E', 'SE', 'S', 'SW'][Math.floor(Math.random() * 5)],
      gustSpeed: 12 + Math.round(Math.random() * 15),
      temperature: 18 + Math.round(Math.random() * 8),
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
        timestamp: time
      });
    }
    
    return forecasts;
  }
}