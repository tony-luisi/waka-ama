import { TideData, TideTime, DailyTides } from '../types';
import { API_CONFIG } from '../config';

export interface NIWATideResponse {
  metadata: {
    datum: string;
    site: string;
    units: string;
  };
  values: Array<{
    time: string;
    value: number;
    quality: string;
  }>;
}

export interface NIWATidePrediction {
  time: string;
  height: number;
  type: 'high' | 'low';
}

export class TideService {
  
  async getCurrentTide(): Promise<TideData> {
    try {
      return await this.getNIWATideData();
    } catch (error) {
      console.warn('Failed to fetch real tide data, using fallback:', error);
      return this.getFallbackTide();
    }
  }

  async getDailyTides(date: Date = new Date()): Promise<DailyTides> {
    try {
      console.log('Attempting to get NIWA daily tides for', date.toDateString());
      return await this.getNIWADailyTides(date);
    } catch (error) {
      console.warn('Failed to fetch daily tide times, using fallback:', error);
      return this.getFallbackDailyTides(date);
    }
  }

  private async getNIWATideData(): Promise<TideData> {
    const apiKey = API_CONFIG.niwa.apiKey;
    
    // In production, we use the API proxy which handles the key server-side
    if (!apiKey && API_CONFIG.niwa.apiUrl.includes('localhost')) {
      throw new Error('NIWA API key not configured');
    }

    const { lat, lng } = API_CONFIG.locations.ianShawPark;
    const now = new Date();
    
    const params = new URLSearchParams({
      lat: lat.toString(),
      long: lng.toString(),
      startDate: now.toISOString().split('T')[0],
      numberOfDays: '1',
      interval: '10',
      datum: 'MSL'
    });

    const url = `${API_CONFIG.niwa.apiUrl}?${params}`;
    
    const headers: Record<string, string> = {
      'Accept': 'application/json'
    };
    
    // Only add API key header in development
    if (apiKey) {
      headers['x-apikey'] = apiKey;
    }
    
    const response = await fetch(url, { headers });

    if (!response.ok) {
      throw new Error(`NIWA API error: ${response.status}`);
    }

    const data: NIWATideResponse = await response.json();
    
    if (!data.values || data.values.length === 0) {
      throw new Error('No tide data available');
    }

    const currentValue = data.values[0];
    const nextValues = data.values.slice(1, 20);
    
    const isHigh = this.determineTideType(currentValue.value, nextValues);
    const direction = this.determineTideDirection(data.values, 0);
    const nextChange = this.findNextTideChange(data.values);
    
    return {
      height: Math.round(currentValue.value * 10) / 10,
      type: isHigh ? 'high' : 'low',
      direction: direction,
      nextChange: nextChange,
      timestamp: new Date(currentValue.time)
    };
  }

  async getTideForecast(hours: number = 24): Promise<TideData[]> {
    try {
      return await this.getNIWATideForecast(hours);
    } catch (error) {
      console.warn('Failed to fetch tide forecast, using fallback:', error);
      return this.getFallbackTideForecast(hours);
    }
  }

  private async getNIWATideForecast(hours: number): Promise<TideData[]> {
    const apiKey = API_CONFIG.niwa.apiKey;
    
    // In production, we use the API proxy which handles the key server-side
    if (!apiKey && API_CONFIG.niwa.apiUrl.includes('localhost')) {
      throw new Error('NIWA API key not configured');
    }

    const { lat, lng } = API_CONFIG.locations.ianShawPark;
    const now = new Date();
    const numberOfDays = Math.ceil(hours / 24);
    
    const params = new URLSearchParams({
      lat: lat.toString(),
      long: lng.toString(),
      startDate: now.toISOString().split('T')[0],
      numberOfDays: numberOfDays.toString(),
      interval: '60',
      datum: 'MSL'
    });

    const url = `${API_CONFIG.niwa.apiUrl}?${params}`;
    
    const headers: Record<string, string> = {
      'Accept': 'application/json'
    };
    
    // Only add API key header in development
    if (apiKey) {
      headers['x-apikey'] = apiKey;
    }
    
    const response = await fetch(url, { headers });

    if (!response.ok) {
      throw new Error(`NIWA API error: ${response.status}`);
    }

    const data: NIWATideResponse = await response.json();
    
    return data.values.map((value, index) => {
      const nextValues = data.values.slice(index + 1, index + 4);
      const isHigh = this.determineTideType(value.value, nextValues);
      const direction = this.determineTideDirection(data.values, index);
      
      return {
        height: Math.round(value.value * 10) / 10,
        type: isHigh ? 'high' : 'low',
        direction: direction,
        nextChange: this.findNextTideChange(data.values.slice(index)),
        timestamp: new Date(value.time)
      };
    });
  }

  private determineTideType(currentHeight: number, nextValues: Array<{value: number}>): boolean {
    if (nextValues.length === 0) return currentHeight > 1.0;
    
    const avgNext = nextValues.reduce((sum, v) => sum + v.value, 0) / nextValues.length;
    return currentHeight >= avgNext;
  }

  private determineTideDirection(values: Array<{value: number}>, currentIndex: number): 'incoming' | 'outgoing' | 'slack' {
    // Need at least a few data points to determine direction
    if (values.length < 3 || currentIndex >= values.length - 2) {
      return 'slack';
    }

    const current = values[currentIndex].value;
    const nextNext = values[currentIndex + 2].value;

    // Calculate the trend over the next 20 minutes (2 data points at 10min intervals)
    const heightChange = nextNext - current;
    const changeThreshold = 0.05; // 5cm change threshold

    if (heightChange > changeThreshold) {
      return 'incoming'; // Tide is rising
    } else if (heightChange < -changeThreshold) {
      return 'outgoing'; // Tide is falling
    } else {
      return 'slack'; // Tide is relatively stable (slack water)
    }
  }

  private findNextTideChange(values: Array<{time: string, value: number}>): Date {
    for (let i = 1; i < values.length - 1; i++) {
      const prev = values[i - 1].value;
      const current = values[i].value;
      const next = values[i + 1].value;
      
      if ((prev < current && current > next) || (prev > current && current < next)) {
        return new Date(values[i].time);
      }
    }
    
    return new Date(Date.now() + 6 * 60 * 60 * 1000);
  }

  private getFallbackTide(): TideData {
    const now = new Date();
    const hour = now.getHours();
    
    const tidePattern = Math.sin((hour + 3) * Math.PI / 6);
    const height = 1.0 + tidePattern * 0.8 + (Math.random() - 0.5) * 0.3;
    
    // Calculate direction based on derivative of sine wave
    const nextHour = hour + 0.5;
    const nextTidePattern = Math.sin((nextHour + 3) * Math.PI / 6);
    const nextHeight = 1.0 + nextTidePattern * 0.8;
    
    let direction: 'incoming' | 'outgoing' | 'slack';
    const heightDiff = nextHeight - height;
    if (heightDiff > 0.1) direction = 'incoming';
    else if (heightDiff < -0.1) direction = 'outgoing';
    else direction = 'slack';
    
    return {
      height: Math.round(height * 10) / 10,
      type: height > 1.2 ? 'high' : 'low',
      direction: direction,
      nextChange: new Date(now.getTime() + (6 - (hour % 6)) * 60 * 60 * 1000),
      timestamp: now
    };
  }

  private getFallbackTideForecast(hours: number): TideData[] {
    const forecasts: TideData[] = [];
    const now = new Date();
    
    for (let i = 0; i < hours; i++) {
      const time = new Date(now.getTime() + i * 60 * 60 * 1000);
      const hour = time.getHours();
      
      const tidePattern = Math.sin((hour + 3) * Math.PI / 6);
      const height = 1.0 + tidePattern * 0.8 + (Math.random() - 0.5) * 0.2;
      
      // Calculate direction for fallback forecast
      const nextHour = hour + 0.5;
      const nextTidePattern = Math.sin((nextHour + 3) * Math.PI / 6);
      const nextHeight = 1.0 + nextTidePattern * 0.8;
      
      let direction: 'incoming' | 'outgoing' | 'slack';
      const heightDiff = nextHeight - height;
      if (heightDiff > 0.1) direction = 'incoming';
      else if (heightDiff < -0.1) direction = 'outgoing';
      else direction = 'slack';
      
      forecasts.push({
        height: Math.round(height * 10) / 10,
        type: height > 1.2 ? 'high' : 'low',
        direction: direction,
        nextChange: new Date(time.getTime() + 6 * 60 * 60 * 1000),
        timestamp: time
      });
    }
    
    return forecasts;
  }

  private async getNIWADailyTides(date: Date): Promise<DailyTides> {
    const apiKey = API_CONFIG.niwa.apiKey;
    
    // In production, we use the API proxy which handles the key server-side
    if (!apiKey && API_CONFIG.niwa.apiUrl.includes('localhost')) {
      throw new Error('NIWA API key not configured');
    }

    const { lat, lng } = API_CONFIG.locations.ianShawPark;
    
    // Get tide data without interval to get high/low times only
    const params = new URLSearchParams({
      lat: lat.toString(),
      long: lng.toString(),
      startDate: date.toISOString().split('T')[0],
      numberOfDays: '1',
      datum: 'MSL'
      // No interval parameter = high/low tide times only
    });

    const url = `${API_CONFIG.niwa.apiUrl}?${params}`;
    
    const headers: Record<string, string> = {
      'Accept': 'application/json'
    };
    
    // Only add API key header in development
    if (apiKey) {
      headers['x-apikey'] = apiKey;
    }
    
    const response = await fetch(url, { headers });

    if (!response.ok) {
      throw new Error(`NIWA API error: ${response.status}`);
    }

    const data: NIWATideResponse = await response.json();
    console.log('NIWA daily tides response:', {
      metadata: data.metadata,
      valueCount: data.values?.length,
      firstValue: data.values?.[0],
      lastValue: data.values?.[data.values?.length - 1]
    });
    
    const tides: TideTime[] = data.values.map(value => {
      const tide = {
        time: new Date(value.time),
        height: Math.round(value.value * 10) / 10,
        type: this.isHighTide(value.value, data.values) ? 'high' as const : 'low' as const
      };
      console.log(`NIWA tide: ${tide.time.toLocaleTimeString()} ${tide.height}m ${tide.type}`);
      return tide;
    });

    return {
      date: date,
      tides: tides
    };
  }

  private getFallbackDailyTides(date: Date): DailyTides {
    console.log('Generating fallback daily tides for', date.toDateString());
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
      
      console.log(`Generated fallback tide ${i}: ${tide.time.toLocaleTimeString()} ${tide.height}m ${tide.type}`);
      tides.push(tide);
    }

    // Sort by time
    tides.sort((a, b) => a.time.getTime() - b.time.getTime());
    console.log('Final fallback tides:', tides.map(t => `${t.time.toLocaleTimeString()} ${t.height}m ${t.type}`));

    return {
      date: date,
      tides: tides
    };
  }

  private isHighTide(currentValue: number, allValues: Array<{value: number}>): boolean {
    // For determining high/low from tide times data, we compare with nearby values
    const avg = allValues.reduce((sum, v) => sum + v.value, 0) / allValues.length;
    return currentValue > avg;
  }
}