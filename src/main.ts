import { getTripForecast } from './data';
import { TripDayForecast, HourlyTripAssessment, AISynthesis, SegmentConditions } from './types';
import { API_CONFIG } from './config';
import { WindMap } from './map';

let windMap: WindMap | null = null;
let segmentDirection: 'outbound' | 'return' = 'outbound';

async function loadData() {
  try {
    const today = new Date();
    const forecast = await getTripForecast(today);

    renderAll(forecast);

    fetchAISynthesis(forecast).then(synthesis => {
      if (synthesis) {
        renderAISynthesis(synthesis);
      }
    }).catch(err => {
      console.warn('AI synthesis failed:', err);
    });
  } catch (error) {
    console.error('Failed to load forecast:', error);
    document.getElementById('aiNarrative')!.textContent = 'Failed to load conditions. Please try again later.';
  }
}

async function fetchAISynthesis(forecast: TripDayForecast): Promise<AISynthesis | null> {
  const apiKey = API_CONFIG.openAI.apiKey;
  if (!apiKey && !API_CONFIG.openAI.apiUrl.startsWith('/api')) {
    console.log('No OpenAI API key, skipping synthesis');
    return null;
  }

  try {
    const response = await fetch(API_CONFIG.openAI.apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ forecast: serializeForecast(forecast) })
    });

    if (!response.ok) {
      console.warn('AI synthesis API error:', response.status);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.warn('AI synthesis fetch failed:', error);
    return null;
  }
}

function serializeForecast(forecast: TripDayForecast): Record<string, unknown> {
  return {
    date: forecast.date.toISOString(),
    hourlyAssessments: forecast.hourlyAssessments.map(ha => ({
      time: ha.time.toISOString(),
      outboundNetKmh: ha.outboundNetKmh,
      returnNetKmh: ha.returnNetKmh,
      roundTripNetKmh: ha.roundTripNetKmh,
      outboundLevel: ha.outboundLevel,
      returnLevel: ha.returnLevel,
      weather: {
        windSpeed: ha.weather.windSpeed,
        windDirection: ha.weather.windDirection,
        gustSpeed: ha.weather.gustSpeed,
        temperature: ha.weather.temperature,
        rainProbability: ha.weather.rainProbability,
        rainMm: ha.weather.rainMm
      },
      tide: {
        height: ha.tide.height,
        direction: ha.tide.direction,
        type: ha.tide.type,
        currentSpeedKmh: ha.tide.currentSpeedKmh
      },
      outboundSegments: ha.outboundSegments.map(s => ({
        from: s.segment.from,
        to: s.segment.to,
        netAssistanceKmh: s.netAssistanceKmh,
        windImpactKmh: s.windImpactKmh,
        tideImpactKmh: s.tideImpactKmh,
        chopImpactKmh: s.chopImpactKmh,
        rainImpactKmh: s.rainImpactKmh
      }))
    })),
    bestWindow: forecast.bestWindow ? {
      start: forecast.bestWindow.start.toISOString(),
      end: forecast.bestWindow.end.toISOString(),
      netAssistanceKmh: forecast.bestWindow.netAssistanceKmh
    } : null,
    worstWindow: forecast.worstWindow ? {
      start: forecast.worstWindow.start.toISOString(),
      end: forecast.worstWindow.end.toISOString(),
      netAssistanceKmh: forecast.worstWindow.netAssistanceKmh
    } : null
  };
}

function renderAll(forecast: TripDayForecast) {
  const now = new Date();
  const currentHour = now.getHours();
  const currentAssessment = forecast.hourlyAssessments.find(ha => ha.time.getHours() === currentHour)
    || forecast.hourlyAssessments[0];

  renderCurrentConditions(currentAssessment);
  renderTimeline(forecast);
  renderConditionsPanel(forecast);
  renderSegments(currentAssessment);
  renderMap(currentAssessment);
}

function renderAISynthesis(synthesis: AISynthesis) {
  const card = document.getElementById('aiCard');
  const windowTime = document.getElementById('aiWindowTime');
  const narrative = document.getElementById('aiNarrative');
  const safety = document.getElementById('aiSafety');

  if (card) card.style.display = 'block';
  if (windowTime) windowTime.textContent = synthesis.bestWindow || '—';
  if (narrative) narrative.textContent = synthesis.narrative || '—';

  if (safety) {
    if (synthesis.safetyAlerts && synthesis.safetyAlerts.length > 0) {
      safety.style.display = 'block';
      safety.innerHTML = synthesis.safetyAlerts.map(a => `⚠️ ${a}`).join('<br>');
    } else {
      safety.style.display = 'none';
    }
  }
}

function renderCurrentConditions(assessment: HourlyTripAssessment) {
  const outScore = document.getElementById('outScore');
  const outLabel = document.getElementById('outLabel');
  const outFactors = document.getElementById('outFactors');
  const retScore = document.getElementById('retScore');
  const retLabel = document.getElementById('retLabel');
  const retFactors = document.getElementById('retFactors');

  const outNet = formatNet(assessment.outboundNetKmh);
  const retNet = formatNet(assessment.returnNetKmh);

  if (outScore) {
    outScore.textContent = outNet;
    outScore.className = `leg-score ${assessment.outboundLevel}`;
  }
  if (outLabel) outLabel.textContent = assessment.outboundLevel.toUpperCase();
  if (outFactors) {
    outFactors.innerHTML = breakdownHtml(assessment.outboundSegments, assessment, true);
  }

  if (retScore) {
    retScore.textContent = retNet;
    retScore.className = `leg-score ${assessment.returnLevel}`;
  }
  if (retLabel) retLabel.textContent = assessment.returnLevel.toUpperCase();
  if (retFactors) {
    retFactors.innerHTML = breakdownHtml(assessment.returnSegments, assessment, false);
  }
}

function formatNet(kmh: number): string {
  const rounded = Math.round(kmh * 10) / 10;
  const sign = rounded > 0 ? '+' : '';
  return `${sign}${rounded} km/h`;
}

function breakdownHtml(segments: SegmentConditions[], assessment: HourlyTripAssessment, outbound: boolean): string {
  const avgWind = segments.reduce((s, seg) => s + seg.windImpactKmh, 0) / segments.length;
  const avgTide = segments.reduce((s, seg) => s + seg.tideImpactKmh, 0) / segments.length;
  const avgChop = segments.reduce((s, seg) => s + seg.chopImpactKmh, 0) / segments.length;
  const avgRain = segments.reduce((s, seg) => s + seg.rainImpactKmh, 0) / segments.length;

  const windDir = outbound ? 'east' : 'west';
  const windDesc = avgWind > 0.2 ? `tailwind` : avgWind > -0.3 ? `crosswind` : `headwind`;

  return `
    <div class="factor">
      <div class="factor-raw">💨 ${assessment.weather.windSpeed} km/h ${assessment.weather.windDirection} · ${windDesc} (paddling ${windDir})</div>
      <div class="factor-impact">→ ${formatNet(avgWind)}</div>
    </div>
    <div class="factor">
      <div class="factor-raw">🌊 Tide ${assessment.tide.currentSpeedKmh} km/h ${assessment.tide.direction}</div>
      <div class="factor-impact">→ ${formatNet(avgTide)}</div>
    </div>
    <div class="factor">
      <div class="factor-raw">🌊 Chop ~${Math.round(Math.abs(avgChop) * 100)} cm</div>
      <div class="factor-impact">→ ${formatNet(avgChop)}</div>
    </div>
    ${avgRain < 0 ? `<div class="factor"><div class="factor-raw">🌧️ Rain</div><div class="factor-impact">→ ${formatNet(avgRain)}</div></div>` : ''}
  `;
}

function renderTimeline(forecast: TripDayForecast) {
  const timeline = document.getElementById('timeline');
  if (!timeline) return;

  const bestWindow = forecast.bestWindow;
  const isBestHour = (time: Date) => {
    if (!bestWindow) return false;
    return time.getHours() >= bestWindow.start.getHours() && time.getHours() <= bestWindow.end.getHours();
  };

  timeline.innerHTML = forecast.hourlyAssessments.map(ha => {
    const hourStr = ha.time.toLocaleTimeString('en-NZ', { hour: 'numeric', hour12: true }).replace(' ', '');
    const bestClass = isBestHour(ha.time) ? 'best' : '';
    const outTip = tooltipForAssessment(ha, true);
    const inTip = tooltipForAssessment(ha, false);
    return `
      <div class="time-slot" data-hour="${ha.time.getHours()}" style="cursor:pointer">
        <div class="hour">${hourStr}</div>
        <div class="bars">
          <div class="bar out ${ha.outboundLevel} ${bestClass}" title="${outTip}">${formatNet(ha.outboundNetKmh)}</div>
          <div class="bar in ${ha.returnLevel} ${bestClass}" title="${inTip}">${formatNet(ha.returnNetKmh)}</div>
        </div>
        <div class="bar-label">out/in</div>
      </div>
    `;
  }).join('');

  // Click to view that hour's breakdown
  timeline.querySelectorAll('.time-slot').forEach(slot => {
    slot.addEventListener('click', () => {
      const hour = Number((slot as HTMLElement).dataset.hour);
      const ha = forecast.hourlyAssessments.find(a => a.time.getHours() === hour);
      if (ha) {
        renderCurrentConditions(ha);
        renderSegments(ha);
        renderMap(ha);
      }
    });
  });
}

function tooltipForAssessment(ha: HourlyTripAssessment, outbound: boolean): string {
  const segs = outbound ? ha.outboundSegments : ha.returnSegments;
  const wind = segs.reduce((s, seg) => s + seg.windImpactKmh, 0) / segs.length;
  const tide = segs.reduce((s, seg) => s + seg.tideImpactKmh, 0) / segs.length;
  const chop = segs.reduce((s, seg) => s + seg.chopImpactKmh, 0) / segs.length;
  const net = outbound ? ha.outboundNetKmh : ha.returnNetKmh;
  return `Net: ${formatNet(net)}\\nWind: ${formatNet(wind)}\\nTide: ${formatNet(tide)}\\nChop: ${formatNet(chop)}`;
}

function renderConditionsPanel(forecast: TripDayForecast) {
  renderWindRows(forecast);
  renderTideChart(forecast);
  renderRainChart(forecast);
  renderTempChart(forecast);
}

function renderWindRows(forecast: TripDayForecast) {
  const container = document.getElementById('windRows');
  if (!container) return;

  container.innerHTML = forecast.hourlyAssessments.map(ha => {
    const barWidth = Math.min(100, Math.max(10, ha.weather.windSpeed * 4));
    return `
      <div class="wind-row">
        <div class="w-hour">${ha.time.getHours()}:00</div>
        <div class="w-arrow" style="transform:rotate(${ha.weather.windDeg ?? 0}deg)">↑</div>
        <div class="w-bar-wrap">
          <div class="w-bar" style="width:${barWidth}%"></div>
          <span class="w-speed">${ha.weather.windSpeed}</span>
        </div>
        <span class="w-gust">g${ha.weather.gustSpeed}</span>
      </div>
    `;
  }).join('');
}

function renderTideChart(forecast: TripDayForecast) {
  const container = document.getElementById('tideChart');
  const labelsContainer = document.getElementById('tideLabels');
  if (!container || !labelsContainer) return;

  const tides = forecast.hourlyAssessments.map(ha => ({ time: ha.time, height: ha.tide.height }));
  const maxH = Math.max(...tides.map(t => t.height), 2.0);
  const minH = Math.min(...tides.map(t => t.height), 0);
  const range = maxH - minH || 1;

  const width = 300;
  const height = 160;
  const padding = { top: 10, bottom: 20, left: 10, right: 10 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const points = tides.map((t, i) => {
    const x = padding.left + (i / (tides.length - 1)) * chartW;
    const y = padding.top + chartH - ((t.height - minH) / range) * chartH;
    return `${x},${y}`;
  });

  const pathD = `M${points[0]} ${points.slice(1).map(p => `L${p}`).join(' ')}`;
  const fillD = `${pathD} L${padding.left + chartW},${padding.top + chartH} L${padding.left},${padding.top + chartH} Z`;

  const highs: Array<{x: number, y: number, height: number}> = [];
  const lows: Array<{x: number, y: number, height: number}> = [];
  for (let i = 1; i < tides.length - 1; i++) {
    const prev = tides[i - 1].height;
    const curr = tides[i].height;
    const next = tides[i + 1].height;
    const x = padding.left + (i / (tides.length - 1)) * chartW;
    const y = padding.top + chartH - ((curr - minH) / range) * chartH;
    if (prev < curr && curr > next) highs.push({ x, y, height: curr });
    if (prev > curr && curr < next) lows.push({ x, y, height: curr });
  }

  const nowIndex = tides.findIndex(t => t.time.getHours() === new Date().getHours());
  const nowX = nowIndex >= 0 ? padding.left + (nowIndex / (tides.length - 1)) * chartW : -1;

  container.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
      <path d="${fillD}" fill="rgba(49,130,206,0.12)"/>
      <path d="${pathD}" fill="none" stroke="var(--ocean-light)" stroke-width="3"/>
      ${highs.map(h => `<circle cx="${h.x}" cy="${h.y}" r="4" fill="var(--ocean-light)"/>`).join('')}
      ${lows.map(l => `<circle cx="${l.x}" cy="${l.y}" r="4" fill="var(--coral)"/>`).join('')}
      ${nowX > 0 ? `<line x1="${nowX}" y1="0" x2="${nowX}" y2="${height}" stroke="var(--sun-gold)" stroke-width="2" stroke-dasharray="5,3"/>` : ''}
    </svg>
  `;

  labelsContainer.innerHTML = ['9am', '12pm', '3pm', '6pm', '9pm'].map(l => `<span>${l}</span>`).join('');
}

function renderRainChart(forecast: TripDayForecast) {
  const container = document.getElementById('rainChart');
  if (!container) return;

  const maxProb = Math.max(...forecast.hourlyAssessments.map(ha => ha.weather.rainProbability), 100);
  container.innerHTML = forecast.hourlyAssessments.map(ha => {
    const pct = ha.weather.rainProbability;
    const height = pct > 0 ? Math.max(5, (pct / maxProb) * 100) : 5;
    return `<div class="mini-bar rain-bar" style="height:${height}%"><span class="bar-label">${ha.time.getHours()}</span>${pct}</div>`;
  }).join('');
}

function renderTempChart(forecast: TripDayForecast) {
  const container = document.getElementById('tempChart');
  if (!container) return;

  const temps = forecast.hourlyAssessments.map(ha => ha.weather.temperature);
  const maxTemp = Math.max(...temps, 30);
  const minTemp = Math.min(...temps, 10);
  const range = maxTemp - minTemp || 1;

  container.innerHTML = forecast.hourlyAssessments.map(ha => {
    const height = Math.max(5, ((ha.weather.temperature - minTemp) / range) * 100);
    return `<div class="mini-bar temp-bar" style="height:${height}%"><span class="bar-label">${ha.time.getHours()}</span>${ha.weather.temperature}</div>`;
  }).join('');
}

function renderSegments(assessment: HourlyTripAssessment) {
  const container = document.getElementById('segmentList');
  if (!container) return;

  const segs = segmentDirection === 'outbound' ? assessment.outboundSegments : assessment.returnSegments;
  const dirLabel = segmentDirection === 'outbound' ? 'Outbound' : 'Return';

  container.innerHTML = `
    <div class="segment-toggle">
      <button class="seg-toggle ${segmentDirection === 'outbound' ? 'active' : ''}" data-dir="outbound">Outbound →</button>
      <button class="seg-toggle ${segmentDirection === 'return' ? 'active' : ''}" data-dir="return">← Return</button>
    </div>
    <div class="segment-meta">
      ${dirLabel} · ${assessment.time.toLocaleTimeString('en-NZ', { hour: 'numeric', hour12: true })} ·
      💨 ${assessment.weather.windSpeed} km/h ${assessment.weather.windDirection} ·
      🌊 Tide ${assessment.tide.currentSpeedKmh} km/h ${assessment.tide.direction} ·
      🌧️ ${assessment.weather.rainProbability > 0 ? assessment.weather.rainProbability + '% rain' : 'No rain'}
    </div>
    <div class="segment-row header">
      <div class="seg-name">Segment</div>
      <div class="seg-net">Net</div>
      <div class="seg-wind">Wind</div>
      <div class="seg-tide">Tide</div>
      <div class="seg-chop">Chop</div>
      <div class="seg-rain">Rain</div>
    </div>
    ${segs.map(seg => renderSegmentRow(seg)).join('')}
  `;

  container.querySelectorAll('.seg-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      segmentDirection = (btn as HTMLElement).dataset.dir as 'outbound' | 'return';
      renderSegments(assessment);
    });
  });
}

function renderSegmentRow(seg: SegmentConditions): string {
  const color = seg.level === 'easy' ? 'var(--easy)' : seg.level === 'moderate' ? 'var(--moderate)' : 'var(--difficult)';
  return `
    <div class="segment-row">
      <div class="seg-name">${seg.segment.from} → ${seg.segment.to}</div>
      <div class="seg-net" style="background:${color};color:white;font-weight:bold">${formatNet(seg.netAssistanceKmh)}</div>
      <div class="seg-wind">${formatNet(seg.windImpactKmh)}</div>
      <div class="seg-tide">${formatNet(seg.tideImpactKmh)}</div>
      <div class="seg-chop" title="${seg.chopHeightCm} cm">${seg.chopHeightCm}cm ${formatNet(seg.chopImpactKmh)}</div>
      <div class="seg-rain">${formatNet(seg.rainImpactKmh)}</div>
    </div>
  `;
}

function renderMap(assessment: HourlyTripAssessment) {
  try {
    if (!windMap) {
      windMap = new WindMap('map');
    }
    windMap.updateWind(assessment.weather);
  } catch (error) {
    console.error('Map error:', error);
  }
}

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  await loadData();

  // Auto-refresh every 5 minutes
  setInterval(() => {
    loadData();
  }, 5 * 60 * 1000);
});
