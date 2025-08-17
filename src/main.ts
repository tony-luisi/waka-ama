import { getCurrentConditions, getExtendedForecast } from './data';
import { assessPaddlingDifficulty } from './difficulty';
import { WindMap } from './map';
import { updateForecastDisplay } from './forecast';
import { TideService } from './api/tide-service';
import { DailyTides, TideTime } from './types';

async function updateUI() {
  try {
    const conditions = await getCurrentConditions();
    const assessment = assessPaddlingDifficulty(conditions);
  
  const difficultyLevel = document.getElementById('difficultyLevel');
  const difficultyScore = document.getElementById('difficultyScore');
  const tideStatus = document.getElementById('tideStatus');
  const windStatus = document.getElementById('windStatus');
  const gustStatus = document.getElementById('gustStatus');
  const tempStatus = document.getElementById('tempStatus');
  const timeStatus = document.getElementById('timeStatus');
  const recommendation = document.getElementById('recommendation');
  
  if (difficultyLevel) {
    difficultyLevel.textContent = assessment.level.toUpperCase();
    difficultyLevel.className = `difficulty-level ${assessment.level}`;
  }
  
  if (difficultyScore) {
    difficultyScore.textContent = `${assessment.score}/10`;
  }
  
  if (tideStatus) {
    const directionEmoji = conditions.tide.direction === 'incoming' ? '⬆️' : 
                          conditions.tide.direction === 'outgoing' ? '⬇️' : '➡️';
    const directionText = conditions.tide.direction === 'incoming' ? 'Rising' :
                         conditions.tide.direction === 'outgoing' ? 'Falling' : 'Slack';
    tideStatus.textContent = `${conditions.tide.type === 'high' ? 'High' : 'Low'} (${conditions.tide.height}m) ${directionEmoji} ${directionText}`;
  }
  
  if (windStatus) {
    windStatus.textContent = `${conditions.weather.windSpeed} km/h ${conditions.weather.windDirection}`;
  }
  
  if (gustStatus) {
    gustStatus.textContent = `${conditions.weather.gustSpeed} km/h`;
  }
  
  if (tempStatus) {
    tempStatus.textContent = `${conditions.weather.temperature}°C`;
  }
  
  if (timeStatus) {
    const timeString = conditions.timeOfDay.toLocaleTimeString('en-NZ', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
    timeStatus.textContent = timeString;
  }
  
    if (recommendation) {
      recommendation.textContent = assessment.recommendation;
    }

    return conditions;
  } catch (error) {
    console.error('Failed to update UI:', error);
    return null;
  }
}

function updateTideTimesDisplay(dailyTides: DailyTides): void {
  const tidesContainer = document.getElementById('tidesContainer');
  if (!tidesContainer) return;
  
  tidesContainer.innerHTML = '';
  
  const now = new Date();
  
  dailyTides.tides.forEach(tide => {
    const tideElement = document.createElement('div');
    tideElement.className = 'tide-time';
    
    // Check if this is the current or next tide
    const timeDiff = tide.time.getTime() - now.getTime();
    const isWithinNextHour = timeDiff > 0 && timeDiff <= 60 * 60 * 1000;
    
    if (isWithinNextHour) {
      tideElement.classList.add('current');
    }
    
    const timeString = tide.time.toLocaleTimeString('en-NZ', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
    
    tideElement.innerHTML = `
      <span class="tide-type ${tide.type}">${tide.type === 'high' ? 'High' : 'Low'}</span>
      <span class="tide-time-value">${timeString}</span>
      <span class="tide-height">${tide.height}m</span>
    `;
    
    tidesContainer.appendChild(tideElement);
  });
}

let windMap: WindMap;
const tideService = new TideService();

document.addEventListener('DOMContentLoaded', async () => {
  const conditions = await updateUI();
  
  try {
    windMap = new WindMap('map');
    if (conditions) {
      windMap.updateWind(conditions.weather);
    }
  } catch (error) {
    console.error('Failed to initialize map:', error);
  }
  
  try {
    const forecast = await getExtendedForecast();
    
    // Get tide data for today and tomorrow
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const [todayTides, tomorrowTides] = await Promise.all([
      tideService.getDailyTides(today),
      tideService.getDailyTides(tomorrow)
    ]);
    
    updateForecastDisplay(forecast, todayTides, tomorrowTides);
    updateTideTimesDisplay(todayTides);
  } catch (error) {
    console.error('Failed to load forecast or tide data:', error);
  }
  
  setInterval(async () => {
    const conditions = await updateUI();
    if (windMap && conditions) {
      windMap.updateWind(conditions.weather);
    }
  }, 60000);
});