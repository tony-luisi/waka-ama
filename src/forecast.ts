import { HourlyForecast, DailyForecast, ExtendedForecast, DailyTides, PaddleDirectionAssessment } from './types';

function getTideTimeIndicator(forecast: HourlyForecast, dailyTides?: DailyTides): string {
  if (!dailyTides) return '';
  
  // Check if this hour matches any tide time (within 30 minutes)
  const currentTime = forecast.time.getTime();
  const matchingTide = dailyTides.tides.find(tide => {
    const tideTime = tide.time.getTime();
    const timeDiff = Math.abs(currentTime - tideTime);
    return timeDiff <= 30 * 60 * 1000; // Within 30 minutes
  });
  
  if (matchingTide) {
    return `<div class="tide-time-indicator">${matchingTide.type.toUpperCase()}</div>`;
  }
  
  return '';
}

export function createHourlyForecastElement(forecast: HourlyForecast, dailyTides?: DailyTides): HTMLElement {
  const element = document.createElement('div');
  element.className = 'hourly-item';
  
  const time = forecast.time.toLocaleTimeString('en-NZ', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: false 
  });
  
  const tideTimeIndicator = getTideTimeIndicator(forecast, dailyTides);
  
  // Generate unique ID for this hourly item
  const itemId = `hourly-${forecast.time.getTime()}`;
  
  element.innerHTML = `
    <div class="hourly-main">
      <div class="hour-time">
        ${time}
        ${tideTimeIndicator}
      </div>
      <div class="hour-paddle-direction">
        ${getPaddleDirectionIndicatorClickable(forecast.paddleDirections, itemId)}
      </div>
      <div class="hour-wind">
        <span class="wind-arrow" style="transform: rotate(${getWindRotation(forecast.weather.windDirection)}deg)">↑</span>
        ${forecast.weather.windSpeed}km/h
      </div>
      <div class="hour-tide">
        ${forecast.tide.height}m
        <span class="tide-direction ${forecast.tide.direction}">
          ${forecast.tide.direction === 'incoming' ? '⬆️' : forecast.tide.direction === 'outgoing' ? '⬇️' : '➡️'}
        </span>
      </div>
      <div class="hour-temp">${forecast.weather.temperature}°C</div>
    </div>
    <div class="hourly-details" id="${itemId}-details" style="display: none;">
      <div class="paddle-direction-explanation">
        ${forecast.paddleDirections.reasoning}
      </div>
    </div>
  `;
  
  return element;
}

function getWindRotation(direction: string): number {
  const directions = {
    'N': 0, 'NNE': 22.5, 'NE': 45, 'ENE': 67.5,
    'E': 90, 'ESE': 112.5, 'SE': 135, 'SSE': 157.5,
    'S': 180, 'SSW': 202.5, 'SW': 225, 'WSW': 247.5,
    'W': 270, 'WNW': 292.5, 'NW': 315, 'NNW': 337.5
  };
  return directions[direction as keyof typeof directions] || 0;
}


function getPaddleDirectionIndicatorClickable(paddleDirections: PaddleDirectionAssessment, itemId: string): string {
  const { recommended, outgoing, incoming } = paddleDirections;
  
  let text = '';
  let className = '';
  
  if (recommended === 'both') {
    text = 'Both ✓';
    className = 'both';
  } else if (recommended === 'outgoing') {
    text = 'Outgoing ✓';
    className = 'outgoing';
  } else if (recommended === 'incoming') {
    text = 'Incoming ✓';
    className = 'incoming';
  } else if (recommended === 'neither') {
    text = 'Avoid ✗';
    className = 'neither';
  } else {
    // Fallback - show better of the two
    const betterDirection = outgoing.score >= incoming.score ? 'outgoing' : 'incoming';
    if (betterDirection === 'outgoing') {
      text = 'Outgoing ✓';
      className = 'outgoing';
    } else {
      text = 'Incoming ✓';
      className = 'incoming';
    }
  }
  
  return `<button class="paddle-direction-btn ${className}" onclick="toggleHourlyDetails('${itemId}')" aria-label="Show paddle direction details">${text}</button>`;
}

export function createDailyForecastElement(forecast: DailyForecast, title: string, dailyTides?: DailyTides): HTMLElement {
  const element = document.createElement('div');
  element.className = 'daily-forecast';
  
  const bestTime = forecast.summary.bestTime.toLocaleTimeString('en-NZ', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: true 
  });
  
  const worstTime = forecast.summary.worstTime.toLocaleTimeString('en-NZ', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: true 
  });
  
  // Generate tide times summary if available
  let tidesHTML = '';
  if (dailyTides && dailyTides.tides.length > 0) {
    const tidesList = dailyTides.tides.map(tide => {
      const timeStr = tide.time.toLocaleTimeString('en-NZ', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
      });
      const typeWord = tide.type === 'high' ? 'High' : 'Low';
      return `${typeWord} ${timeStr} (${tide.height}m)`;
    }).join(' • ');
    
    tidesHTML = `
      <div class="tide-summary">
        <h4>🌊 Tide Times</h4>
        <p class="tide-times">${tidesList}</p>
      </div>
    `;
  }

  element.innerHTML = `
    <h3>${title}</h3>
    <div class="daily-summary">
      <div class="summary-item">
        <span class="label">Best Time:</span>
        <span class="value">${bestTime}</span>
      </div>
      <div class="summary-item">
        <span class="label">Worst Time:</span>
        <span class="value">${worstTime}</span>
      </div>
      <div class="summary-item">
        <span class="label">Avg Difficulty:</span>
        <span class="value">${forecast.summary.averageDifficulty}/10</span>
      </div>
    </div>
    ${tidesHTML}
    <p class="daily-conditions">${forecast.summary.conditions}</p>
    
    <div class="hourly-forecast">
      <div class="hourly-header">
        <div>Time</div>
        <div>Paddling Direction</div>
        <div>Wind</div>
        <div>Tide</div>
        <div>Temp</div>
      </div>
      <div class="hourly-list" id="${title.toLowerCase()}-hourly">
      </div>
    </div>
  `;
  
  const hourlyList = element.querySelector(`#${title.toLowerCase()}-hourly`) as HTMLElement;
  
  forecast.hourlyForecasts
    .filter(f => f.time.getHours() >= 14 && f.time.getHours() <= 20)
    .forEach(hourlyForecast => {
      hourlyList.appendChild(createHourlyForecastElement(hourlyForecast, dailyTides));
    });
  
  return element;
}

export function updateForecastDisplay(forecast: ExtendedForecast, todayTides?: DailyTides, tomorrowTides?: DailyTides): void {
  const forecastContainer = document.getElementById('forecastContainer');
  if (!forecastContainer) return;
  
  forecastContainer.innerHTML = '';
  
  forecastContainer.appendChild(createDailyForecastElement(forecast.today, 'Today', todayTides));
  forecastContainer.appendChild(createDailyForecastElement(forecast.tomorrow, 'Tomorrow', tomorrowTides));
}