import { HourlyForecast, DailyForecast, ExtendedForecast, DailyTides, PaddleDirectionAssessment } from './types';
import { arrowRotationFromWindFromLabel } from './wind-display';
import { tideMovementLabel } from './tide-display';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function paddleGuidanceHtml(forecast: HourlyForecast): string {
  const { headline, paragraphs } = forecast.paddleGuidance;
  const body = paragraphs.map((p) => `<p class="paddle-guidance-p">${escapeHtml(p)}</p>`).join('');
  return `<p class="paddle-guidance-headline">${escapeHtml(headline)}</p>${body}`;
}

function difficultyCellHtml(forecast: HourlyForecast): string {
  const { score, level } = forecast.difficulty;
  const label = `Overall difficulty ${score} out of 10 (${level})`;
  return `<div class="hour-difficulty ${level}" aria-label="${escapeHtml(label)}">${score}/10</div>`;
}

/** HIGH/LOW badge only on the same local clock-hour as the extremum (avoids "HIGH" at :00 when HW was :59). */
function getTideTimeIndicator(forecast: HourlyForecast, dailyTides?: DailyTides): string {
  if (!dailyTides) return '';

  const ft = forecast.time;
  const matchingTide = dailyTides.tides.find(tide => {
    if (tide.time.getFullYear() !== ft.getFullYear() || tide.time.getMonth() !== ft.getMonth() || tide.time.getDate() !== ft.getDate()) {
      return false;
    }
    if (tide.time.getHours() !== ft.getHours()) {
      return false;
    }
    return Math.abs(forecast.time.getTime() - tide.time.getTime()) <= 55 * 60 * 1000;
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

  const tideMoveLabel = tideMovementLabel(forecast.tide, dailyTides?.tides);

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
      <div class="hour-difficulty-wrap">
        ${difficultyCellHtml(forecast)}
      </div>
      <div class="hour-wind">
        <span class="wind-arrow" style="transform: rotate(${arrowRotationFromWindFromLabel(forecast.weather.windDirection)}deg)">↑</span>
        ${forecast.weather.windSpeed}km/h
      </div>
      <div class="hour-gusts">
        ${forecast.weather.gustSpeed}km/h
      </div>
      <div class="hour-tide">
        ${forecast.tide.height}m
        <span class="tide-direction ${forecast.tide.direction}" aria-label="${tideMoveLabel} tide">${tideMoveLabel}</span>
      </div>
      <div class="hour-temp">${forecast.weather.temperature}°C</div>
    </div>
    <div class="hourly-details" id="${itemId}-details" style="display: none;">
      <div class="paddle-direction-explanation">
        ${paddleGuidanceHtml(forecast)}
      </div>
    </div>
  `;
  
  return element;
}

function getPaddleDirectionIndicatorClickable(paddleDirections: PaddleDirectionAssessment, itemId: string): string {
  const { recommended, outgoing, incoming } = paddleDirections;
  
  let text = '';
  let shortText = '';
  let className = '';
  
  if (recommended === 'both') {
    text = 'Both ✓';
    shortText = 'Both ✓';
    className = 'both';
  } else if (recommended === 'outgoing') {
    text = 'Outgoing ✓';
    shortText = 'Out ✓';
    className = 'outgoing';
  } else if (recommended === 'incoming') {
    text = 'Incoming ✓';
    shortText = 'In ✓';
    className = 'incoming';
  } else if (recommended === 'neither') {
    text = 'Avoid ✗';
    shortText = 'No ✗';
    className = 'neither';
  } else {
    // Fallback - show better of the two
    const betterDirection = outgoing.score >= incoming.score ? 'outgoing' : 'incoming';
    if (betterDirection === 'outgoing') {
      text = 'Outgoing ✓';
      shortText = 'Out ✓';
      className = 'outgoing';
    } else {
      text = 'Incoming ✓';
      shortText = 'In ✓';
      className = 'incoming';
    }
  }
  
  return `<button class="paddle-direction-btn ${className}" onclick="toggleHourlyDetails('${itemId}')" aria-label="Show conditions and paddle guidance">
    <span class="btn-full-text">${text}</span>
    <span class="btn-short-text">${shortText}</span>
  </button>`;
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
        <div>Difficulty</div>
        <div>Wind</div>
        <div>Gusts</div>
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