import { PaddlingConditions, DifficultyAssessment, PaddleDirectionAssessment, WeatherConditions, TideData } from './types';

function calculateWindScore(weather: WeatherConditions, paddleDirection: 'outgoing' | 'incoming'): number {
  const { windSpeed, windDirection, gustSpeed } = weather;
  
  let score = 0;
  
  if (windSpeed <= 10) score += 3;
  else if (windSpeed <= 20) score += 2;
  else score += 1;
  
  if (gustSpeed - windSpeed <= 5) score += 2;
  else if (gustSpeed - windSpeed <= 15) score += 1;
  
  // Wind direction scoring based on paddle direction
  // Outgoing: NE winds (towards Bucklands Beach) are ideal
  // Incoming: SW winds (towards Ian Shaw Park) are ideal
  if (paddleDirection === 'outgoing') {
    if (['NE', 'ENE', 'E'].includes(windDirection)) {
      score += 2; // Tailwind for outgoing
    } else if (['SW', 'WSW', 'W'].includes(windDirection)) {
      score -= 1; // Headwind for outgoing
    } else if (['N', 'S', 'SE', 'NW'].includes(windDirection)) {
      score += 1; // Cross wind
    }
  } else { // incoming
    if (['SW', 'WSW', 'W'].includes(windDirection)) {
      score += 2; // Tailwind for incoming
    } else if (['NE', 'ENE', 'E'].includes(windDirection)) {
      score -= 1; // Headwind for incoming
    } else if (['N', 'S', 'SE', 'NW'].includes(windDirection)) {
      score += 1; // Cross wind
    }
  }
  
  return Math.max(1, Math.min(5, score));
}

function calculateTideScore(tide: TideData, paddleDirection: 'outgoing' | 'incoming'): number {
  const { height, type, direction } = tide;
  
  let score = 0;
  
  // Base score for tide height (absolute water depth)
  if (height >= 1.5) score += 2;
  else if (height >= 1.0) score += 1.5;
  else if (height >= 0.5) score += 1;
  else score += 0.5;
  
  // Bonus for high tide (easier entry/exit)
  if (type === 'high') score += 0.5;
  
  // Tide direction scoring based on paddle direction
  if (paddleDirection === 'outgoing') {
    if (direction === 'outgoing') {
      score += 2; // Outgoing tide helps paddle out to Bucklands Beach
    } else if (direction === 'slack') {
      score += 1; // Neutral conditions
    } else if (direction === 'incoming') {
      score += 0; // Incoming tide works against outgoing paddle
    }
  } else { // incoming
    if (direction === 'incoming') {
      score += 2; // Incoming tide helps paddle back to Ian Shaw Park
    } else if (direction === 'slack') {
      score += 1; // Neutral conditions
    } else if (direction === 'outgoing') {
      score += 0; // Outgoing tide works against incoming paddle
    }
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

function generateRecommendation(conditions: PaddlingConditions, assessment: DifficultyAssessment, paddleDirection: 'outgoing' | 'incoming'): string {
  const { weather, tide } = conditions;
  const { level, factors } = assessment;
  
  const directionText = paddleDirection === 'outgoing' ? 'towards Bucklands Beach' : 'back to Ian Shaw Park';
  const recommendations: string[] = [];
  
  if (level === 'easy') {
    recommendations.push(`Perfect conditions for paddling ${directionText}!`);
    
    if (factors.wind >= 4) {
      const windHelp = paddleDirection === 'outgoing' ? 
        (['NE', 'ENE', 'E'].includes(weather.windDirection) ? 'tailwind' : 'favorable wind') :
        (['SW', 'WSW', 'W'].includes(weather.windDirection) ? 'tailwind' : 'favorable wind');
      recommendations.push(`${weather.windDirection} winds provide a ${windHelp}.`);
    }
    if (factors.tide >= 4) {
      const tideHelp = (paddleDirection === 'outgoing' && tide.direction === 'outgoing') ||
                      (paddleDirection === 'incoming' && tide.direction === 'incoming');
      if (tideHelp) {
        recommendations.push(`${tide.direction} tide assists your paddle ${directionText}.`);
      } else {
        recommendations.push(`Good tide conditions with ${tide.height}m depth.`);
      }
    }
  } else if (level === 'moderate') {
    recommendations.push(`Moderate conditions for paddling ${directionText}.`);
    
    if (factors.wind < 3) {
      const windChallenge = paddleDirection === 'outgoing' ? 
        (['SW', 'WSW', 'W'].includes(weather.windDirection) ? 'headwind' : 'challenging wind') :
        (['NE', 'ENE', 'E'].includes(weather.windDirection) ? 'headwind' : 'challenging wind');
      recommendations.push(`${weather.windDirection} winds create a ${windChallenge}.`);
    }
    if (factors.tide < 3) {
      const tideChallenge = (paddleDirection === 'outgoing' && tide.direction === 'incoming') ||
                           (paddleDirection === 'incoming' && tide.direction === 'outgoing');
      if (tideChallenge) {
        recommendations.push(`${tide.direction} tide works against your paddle ${directionText}.`);
      }
    }
  } else {
    recommendations.push(`Challenging conditions for paddling ${directionText} - consider avoiding.`);
    
    if (factors.wind < 2) {
      recommendations.push(`Strong ${weather.windDirection} winds (${weather.windSpeed}km/h) with gusts to ${weather.gustSpeed}km/h make paddling difficult.`);
    }
    if (factors.tide < 2) {
      recommendations.push(`Tide conditions are poor for paddling ${directionText}.`);
    }
  }
  
  return recommendations.join(' ');
}

function createDifficultyAssessment(conditions: PaddlingConditions, paddleDirection: 'outgoing' | 'incoming'): DifficultyAssessment {
  const windScore = calculateWindScore(conditions.weather, paddleDirection);
  const tideScore = calculateTideScore(conditions.tide, paddleDirection);
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
  
  assessment.recommendation = generateRecommendation(conditions, assessment, paddleDirection);
  
  return assessment;
}

export function assessPaddlingDifficulty(conditions: PaddlingConditions): DifficultyAssessment {
  // Return the better of the two directions for backward compatibility
  const directionAssessment = assessPaddleDirections(conditions);
  return directionAssessment.outgoing.score >= directionAssessment.incoming.score ? 
    directionAssessment.outgoing : directionAssessment.incoming;
}

function generateDirectionReasoning(conditions: PaddlingConditions, outgoing: DifficultyAssessment, incoming: DifficultyAssessment, recommended: string): string {
  const { weather, tide } = conditions;
  const reasons: string[] = [];
  
  // Wind analysis
  const windDirection = weather.windDirection;
  const windSpeed = weather.windSpeed;
  
  if (['NE', 'ENE', 'E'].includes(windDirection)) {
    reasons.push(`${windDirection} winds (${windSpeed}km/h) favor outgoing paddle to Bucklands Beach`);
  } else if (['SW', 'WSW', 'W'].includes(windDirection)) {
    reasons.push(`${windDirection} winds (${windSpeed}km/h) favor incoming paddle to Ian Shaw Park`);
  } else {
    reasons.push(`${windDirection} winds (${windSpeed}km/h) create crosswind conditions`);
  }
  
  // Tide analysis
  if (tide.direction === 'outgoing') {
    reasons.push(`Outgoing tide (${tide.height}m) assists paddle toward Bucklands Beach`);
  } else if (tide.direction === 'incoming') {
    reasons.push(`Incoming tide (${tide.height}m) assists return to Ian Shaw Park`);
  } else {
    reasons.push(`Slack tide (${tide.height}m) provides neutral conditions`);
  }
  
  // Recommendation explanation
  let conclusion = '';
  if (recommended === 'both') {
    conclusion = `Both directions score well (Out: ${outgoing.score}/10, In: ${incoming.score}/10) - excellent conditions for round trip`;
  } else if (recommended === 'outgoing') {
    conclusion = `Outgoing performs better (${outgoing.score}/10 vs ${incoming.score}/10) - ideal for paddling out`;
  } else if (recommended === 'incoming') {
    conclusion = `Incoming performs better (${incoming.score}/10 vs ${outgoing.score}/10) - better for returning`;
  } else {
    conclusion = `Both directions challenging (Out: ${outgoing.score}/10, In: ${incoming.score}/10) - consider postponing`;
  }
  
  return `${reasons.join('. ')}. ${conclusion}.`;
}

export function assessPaddleDirections(conditions: PaddlingConditions): PaddleDirectionAssessment {
  const outgoing = createDifficultyAssessment(conditions, 'outgoing');
  const incoming = createDifficultyAssessment(conditions, 'incoming');
  
  let recommended: 'outgoing' | 'incoming' | 'both' | 'neither';
  
  if (outgoing.level === 'easy' && incoming.level === 'easy') {
    recommended = 'both';
  } else if (outgoing.level === 'difficult' && incoming.level === 'difficult') {
    recommended = 'neither';
  } else if (outgoing.score > incoming.score) {
    recommended = 'outgoing';
  } else {
    recommended = 'incoming';
  }
  
  const reasoning = generateDirectionReasoning(conditions, outgoing, incoming, recommended);
  
  return {
    outgoing,
    incoming,
    recommended,
    reasoning
  };
}