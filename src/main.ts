import { getCurrentConditions, getExtendedForecast } from './data';
import { assessPaddlingDifficulty, assessPaddleDirections } from './difficulty';
// import { WindMap } from './map'; // Map temporarily removed
import { updateForecastDisplay } from './forecast';
import { TideService } from './api/tide-service';
import { DailyTides, PaddleDirectionAssessment } from './types';

async function updateUI() {
  try {
    const conditions = await getCurrentConditions();
    const assessment = assessPaddlingDifficulty(conditions);
    const directionAssessment = assessPaddleDirections(conditions);
  
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
  
  // Update paddle direction assessments
  updatePaddleDirectionDisplay(directionAssessment);
  
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

function updatePaddleDirectionDisplay(directionAssessment: PaddleDirectionAssessment): void {
  const outgoingContainer = document.getElementById('outgoingAssessment');
  const incomingContainer = document.getElementById('incomingAssessment');
  const recommendedDirection = document.getElementById('recommendedDirection');
  
  if (outgoingContainer) {
    outgoingContainer.innerHTML = `
      <div class="direction-header">
        <span class="direction-label">🚣‍♂️ Outgoing (to Bucklands Beach)</span>
        <span class="direction-score ${directionAssessment.outgoing.level}">${directionAssessment.outgoing.score}/10</span>
      </div>
      <p class="direction-recommendation">${directionAssessment.outgoing.recommendation}</p>
    `;
  }
  
  if (incomingContainer) {
    incomingContainer.innerHTML = `
      <div class="direction-header">
        <span class="direction-label">🏠 Incoming (back to Ian Shaw Park)</span>
        <span class="direction-score ${directionAssessment.incoming.level}">${directionAssessment.incoming.score}/10</span>
      </div>
      <p class="direction-recommendation">${directionAssessment.incoming.recommendation}</p>
    `;
  }
  
  if (recommendedDirection) {
    const recommendedText = {
      'outgoing': '🚣‍♂️ Outgoing paddle is more favorable',
      'incoming': '🏠 Incoming paddle is more favorable',
      'both': '✅ Both directions are good',
      'neither': '⚠️ Consider avoiding paddling right now'
    };
    
    recommendedDirection.innerHTML = `
      <div class="recommended-text">${recommendedText[directionAssessment.recommended]}</div>
      <div class="direction-reasoning">${directionAssessment.reasoning}</div>
    `;
    recommendedDirection.className = `recommended-direction ${directionAssessment.recommended}`;
  }
}

// let windMap: WindMap; // Map temporarily removed
const tideService = new TideService();

document.addEventListener('DOMContentLoaded', async () => {
  // const conditions = await updateUI(); // Map temporarily removed
  await updateUI();
  
  // Map temporarily removed
  // try {
  //   windMap = new WindMap('map');
  //   if (conditions) {
  //     windMap.updateWind(conditions.weather);
  //   }
  // } catch (error) {
  //   console.error('Failed to initialize map:', error);
  // }
  
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
    await updateUI();
    // Map temporarily removed
    // const conditions = await updateUI();
    // if (windMap && conditions) {
    //   windMap.updateWind(conditions.weather);
    // }
  }, 60000);
});

// Global function for toggling hourly details
(window as any).toggleHourlyDetails = function(itemId: string) {
  const detailsElement = document.getElementById(`${itemId}-details`);
  if (detailsElement) {
    const isVisible = detailsElement.style.display !== 'none';
    detailsElement.style.display = isVisible ? 'none' : 'block';
  }
};