import { TideData, TideTime, DailyTides } from '../types';
import { API_CONFIG } from '../config';
import { formatLocalDateYMD } from '../local-date';

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
      return await this.getNIWADailyTides(date);
    } catch (error) {
      console.warn('Failed to fetch daily tide times, using fallback:', error);
      const fallbackTides = this.getFallbackDailyTides(date);
      fallbackTides.isFallback = true;
      return fallbackTides;
    }
  }

  private async getNIWATideData(): Promise<TideData> {
    const apiKey = API_CONFIG.niwa.apiKey;
    
    // In production, we use the API proxy which handles the key server-side
    if (!apiKey && API_CONFIG.niwa.apiUrl.includes('localhost')) {
      throw new Error('NIWA API key not configured');
    }

    const { lat, lng } = API_CONFIG.estuaryCentre;
    const now = new Date();
    
    const params = new URLSearchParams({
      lat: lat.toString(),
      long: lng.toString(),
      startDate: formatLocalDateYMD(now),
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

    const idx = this.findClosestTimeIndex(data.values, now);
    const currentValue = data.values[idx];
    const nextValues = data.values.slice(idx + 1, idx + 20);
    
    const isHigh = this.determineTideType(currentValue.value, nextValues);
    const direction = this.determineTideDirection(data.values, idx);
    const nextChange = this.findNextTideChange(data.values, idx);
    const currentSpeedKmh = this.estimateCurrentSpeed(data.values, idx);
    
    return {
      height: Math.round(currentValue.value * 10) / 10,
      type: isHigh ? 'high' : 'low',
      direction: direction,
      currentSpeedKmh,
      nextChange: nextChange,
      timestamp: new Date(currentValue.time)
    };
  }

  /** Index of the sample whose time is nearest to `target` (NIWA series may start at midnight). */
  private findClosestTimeIndex(
    values: Array<{ time: string; value: number }>,
    target: Date
  ): number {
    const t = target.getTime();
    let best = 0;
    let bestDiff = Infinity;
    for (let i = 0; i < values.length; i++) {
      const diff = Math.abs(new Date(values[i].time).getTime() - t);
      if (diff < bestDiff) {
        bestDiff = diff;
        best = i;
      }
    }
    return best;
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

    const { lat, lng } = API_CONFIG.estuaryCentre;
    const now = new Date();
    const numberOfDays = Math.ceil(hours / 24);
    
    const params = new URLSearchParams({
      lat: lat.toString(),
      long: lng.toString(),
      startDate: formatLocalDateYMD(now),
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
        currentSpeedKmh: this.estimateCurrentSpeed(data.values, index),
        nextChange: this.findNextTideChange(data.values, index),
        timestamp: new Date(value.time)
      };
    });
  }

  /**
   * Estimate tidal current speed (km/h) from the rate of height change between
   * consecutive NIWA samples. Uses the same amplification factor as the harmonic
   * interpolator in data.ts.
   */
  private estimateCurrentSpeed(
    values: Array<{ time: string; value: number }>,
    index: number
  ): number {
    if (values.length < 2) return 0;
    let dhMs: number;
    if (index < values.length - 1) {
      const dt = new Date(values[index + 1].time).getTime() - new Date(values[index].time).getTime();
      dhMs = dt > 0 ? (values[index + 1].value - values[index].value) / dt : 0;
    } else {
      const dt = new Date(values[index].time).getTime() - new Date(values[index - 1].time).getTime();
      dhMs = dt > 0 ? (values[index].value - values[index - 1].value) / dt : 0;
    }
    const dhMps = Math.abs(dhMs) * 1000; // m/s
    const rawKmh = dhMps * 3.6;
    return Math.min(4.0, Math.round(rawKmh * 7000 * 10) / 10);
  }

  /**
   * Estimate current speed from the fallback sine-wave tide model.
   */
  private estimateFallbackCurrentSpeed(hour: number): number {
    const phase = (hour + 3) * Math.PI / 6;
    const dhDhour = 0.8 * (Math.PI / 6) * Math.cos(phase);
    const dhMps = dhDhour / 3600;
    return Math.min(4.0, Math.round(Math.abs(dhMps) * 3.6 * 7000 * 10) / 10);
  }

  private determineTideType(currentHeight: number, nextValues: Array<{value: number}>): boolean {
    if (nextValues.length === 0) return currentHeight > 1.0;
    
    const avgNext = nextValues.reduce((sum, v) => sum + v.value, 0) / nextValues.length;
    return currentHeight >= avgNext;
  }

  private determineTideDirection(values: Array<{ value: number }>, currentIndex: number): 'incoming' | 'outgoing' | 'slack' {
    if (values.length < 2 || currentIndex >= values.length - 1) {
      return 'slack';
    }

    const current = values[currentIndex].value;
    const next = values[currentIndex + 1].value;
    const heightChange = next - current;
    const changeThreshold = 0.05; // 5cm over one sample (works for 10m or 60m spacing)

    if (heightChange > changeThreshold) {
      return 'incoming';
    }
    if (heightChange < -changeThreshold) {
      return 'outgoing';
    }
    return 'slack';
  }

  /** Next high or low (local extremum) at or after `fromIndex`. */
  private findNextTideChange(values: Array<{ time: string; value: number }>, fromIndex: number = 0): Date {
    const start = Math.max(1, fromIndex + 1);
    for (let i = start; i < values.length - 1; i++) {
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
    
    const currentSpeedKmh = this.estimateFallbackCurrentSpeed(hour);
    
    return {
      height: Math.round(height * 10) / 10,
      type: height > 1.2 ? 'high' : 'low',
      direction: direction,
      currentSpeedKmh,
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
        currentSpeedKmh: this.estimateFallbackCurrentSpeed(hour),
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

    const { lat, lng } = API_CONFIG.estuaryCentre;
    
    // Get tide data without interval to get high/low times only
    const params = new URLSearchParams({
      lat: lat.toString(),
      long: lng.toString(),
      startDate: formatLocalDateYMD(date),
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
    
    const tides: TideTime[] = data.values.map(value => {
      const tide = {
        time: new Date(value.time),
        height: Math.round(value.value * 10) / 10,
        type: this.isHighTide(value.value, data.values) ? 'high' as const : 'low' as const
      };
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