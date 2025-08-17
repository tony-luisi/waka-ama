import { PaddlingConditions, DifficultyAssessment, WeatherConditions, TideData } from './types';
import { ianShawPark } from './data';

function calculateWindScore(weather: WeatherConditions): number {
  const { windSpeed, windDirection, gustSpeed } = weather;
  
  let score = 0;
  
  if (windSpeed <= 10) score += 3;
  else if (windSpeed <= 20) score += 2;
  else score += 1;
  
  if (gustSpeed - windSpeed <= 5) score += 2;
  else if (gustSpeed - windSpeed <= 15) score += 1;
  
  if (ianShawPark.idealWindDirections.includes(windDirection)) {
    score += 2;
  } else if (['N', 'S'].includes(windDirection)) {
    score += 1;
  }
  
  return Math.max(1, Math.min(5, score));
}

function calculateTideScore(tide: TideData): number {
  const { height, type, direction } = tide;
  
  let score = 0;
  
  // Base score for tide height (absolute water depth)
  if (height >= 1.5) score += 2;
  else if (height >= 1.0) score += 1.5;
  else if (height >= 0.5) score += 1;
  else score += 0.5;
  
  // Bonus for high tide (easier entry/exit)
  if (type === 'high') score += 0.5;
  
  // Key factor: Tide direction for return journey
  if (direction === 'incoming') {
    score += 2; // Incoming tide helps paddle back to shore
  } else if (direction === 'slack') {
    score += 1; // Neutral tide conditions
  } else if (direction === 'outgoing') {
    score += 0; // Outgoing tide makes return more difficult
  }
  
  return Math.max(1, Math.min(5, score));
}

function calculateTimeScore(timeOfDay: Date): number {
  const hour = timeOfDay.getHours();
  
  if (hour >= 16 && hour <= 19) return 5;
  if (hour >= 15 && hour <= 20) return 4;
  if (hour >= 14 && hour <= 21) return 3;
  if (hour >= 10 && hour <= 22) return 2;
  return 1;
}

function calculateTemperatureScore(temperature: number): number {
  if (temperature >= 20 && temperature <= 26) return 5;
  if (temperature >= 18 && temperature <= 28) return 4;
  if (temperature >= 15 && temperature <= 30) return 3;
  if (temperature >= 12 && temperature <= 32) return 2;
  return 1;
}

function generateRecommendation(conditions: PaddlingConditions, assessment: DifficultyAssessment): string {
  const { weather, tide } = conditions;
  const { level, factors } = assessment;
  
  const recommendations: string[] = [];
  
  if (level === 'easy') {
    recommendations.push('Perfect conditions for paddling!');
    
    if (factors.wind >= 4) {
      recommendations.push(`Light ${weather.windDirection} winds are ideal.`);
    }
    if (factors.tide >= 4) {
      if (tide.direction === 'incoming') {
        recommendations.push(`${tide.type === 'high' ? 'High' : 'Low'} tide is incoming - perfect for easy return paddle.`);
      } else {
        recommendations.push(`${tide.type === 'high' ? 'High' : 'Low'} tide provides excellent water depth.`);
      }
    }
    if (factors.temperature >= 4) {
      recommendations.push('Water temperature is comfortable.');
    }
  } else if (level === 'moderate') {
    recommendations.push('Good conditions with some considerations.');
    
    if (factors.wind < 3) {
      recommendations.push(`${weather.windDirection} winds at ${weather.windSpeed}km/h may be challenging.`);
    }
    if (factors.tide < 3) {
      if (tide.direction === 'outgoing') {
        recommendations.push('Outgoing tide will make the return paddle more challenging.');
      } else {
        recommendations.push('Consider tide timing for optimal depth.');
      }
    }
    if (factors.temperature < 3) {
      recommendations.push('Dress appropriately for the temperature.');
    }
  } else {
    recommendations.push('Challenging conditions - consider postponing.');
    
    if (factors.wind < 2) {
      recommendations.push(`Strong ${weather.windDirection} winds (${weather.windSpeed}km/h) with gusts to ${weather.gustSpeed}km/h.`);
    }
    if (factors.tide < 2) {
      if (tide.direction === 'outgoing') {
        recommendations.push('Strong outgoing tide makes return very difficult - avoid paddling.');
      } else {
        recommendations.push('Poor tide conditions for paddling.');
      }
    }
  }
  
  return recommendations.join(' ');
}

export function assessPaddlingDifficulty(conditions: PaddlingConditions): DifficultyAssessment {
  const windScore = calculateWindScore(conditions.weather);
  const tideScore = calculateTideScore(conditions.tide);
  const timeScore = calculateTimeScore(conditions.timeOfDay);
  const tempScore = calculateTemperatureScore(conditions.weather.temperature);
  
  const factors = {
    wind: windScore,
    tide: tideScore,
    time: timeScore,
    temperature: tempScore
  };
  
  const totalScore = windScore + tideScore + timeScore + tempScore;
  const normalizedScore = Math.round((totalScore / 20) * 10);
  
  let level: 'easy' | 'moderate' | 'difficult';
  if (normalizedScore >= 7) level = 'easy';
  else if (normalizedScore >= 4) level = 'moderate';
  else level = 'difficult';
  
  const assessment: DifficultyAssessment = {
    score: normalizedScore,
    level,
    recommendation: '',
    factors
  };
  
  assessment.recommendation = generateRecommendation(conditions, assessment);
  
  return assessment;
}