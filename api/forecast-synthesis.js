export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      res.status(500).json({ error: 'OpenAI API key not configured' });
      return;
    }

    const { forecast } = req.body;
    if (!forecast || !forecast.hourlyAssessments) {
      res.status(400).json({ error: 'Missing forecast data' });
      return;
    }

    const prompt = buildPrompt(forecast);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are an expert waka ama (outrigger canoe) coach in Auckland, New Zealand. You know the Tāmaki Estuary intimately. You provide concise, practical paddling advice based on weather, tide, and chop conditions.

The paddling route is: The Ramp → Rayglass → Red Pole → Second Bridge → Tamaki → St Kents → The Kat → First Red → Third Red → Half Moon Bay → No 9 (and back).

Key domain knowledge:
- Waka ama are 6-person outrigger canoes. Stability matters in chop.
- The Ramp is the western launch point, No 9 is the eastern turnaround.
- Outbound = west to east. Return = east to west.
- SW wind favours outbound (tailwind), NE wind favours return.
- Outgoing tide (ebb) assists outbound, incoming tide (flood) assists return.
- Second Bridge and Red Pole are exposed spots where chop builds.
- The eastern end (The Kat, No 9) is more sheltered.

Conditions are now expressed as NET ASSISTANCE in km/h:
- Positive = the elements are helping you (tailwind + following tide)
- Negative = the elements are working against you (headwind + opposing tide)
- Zero = neutral conditions
- A typical cruising speed is ~9 km/h, so -1.5 km/h means you'll feel like you're paddling 10.5 km/h effort.

CRITICAL CONSTRAINTS:
- Paddling is only possible between 9:00 AM and 9:00 PM. NEVER recommend times outside this window.
- The forecast data only covers 9am–9pm. Do not hallucinate overnight or early morning windows.
- If the best conditions are at 9am, say "9:00 AM — 11:00 AM" (a 2-hour window).
- If conditions are good all afternoon, say "2:00 PM — 5:00 PM".

Respond ONLY with valid JSON in this exact format:
{
  "narrative": "2-3 sentence overview of today's conditions",
  "bestWindow": "e.g. 2:00 PM — 4:00 PM",
  "routeRecommendation": "1 sentence route advice",
  "safetyAlerts": ["alert 1", "alert 2"],
  "perSegmentNotes": {
    "The Ramp → Rayglass": "note about this leg",
    ...
  }
}`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 800,
        response_format: { type: 'json_object' }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('Empty response from OpenAI');
    }

    const synthesis = JSON.parse(content);
    res.status(200).json(synthesis);

  } catch (error) {
    console.error('Forecast synthesis error:', error);
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({
      error: 'Failed to generate forecast synthesis',
      message
    });
  }
}

function buildPrompt(forecast) {
  const assessments = forecast.hourlyAssessments;
  const bestWindow = forecast.bestWindow;
  const worstWindow = forecast.worstWindow;

  let prompt = `Today's Tāmaki Estuary paddling conditions (net assistance in km/h — positive means the elements help you, negative means they work against you). Paddling window: 9:00 AM — 9:00 PM ONLY.\n\n`;

  if (bestWindow) {
    prompt += `Best window: ${formatTime(bestWindow.start)} — ${formatTime(bestWindow.end)} (net ${formatNet(bestWindow.netAssistanceKmh)})\n`;
  }
  if (worstWindow) {
    prompt += `Worst window: ${formatTime(worstWindow.start)} — ${formatTime(worstWindow.end)} (net ${formatNet(worstWindow.netAssistanceKmh)})\n`;
  }

  prompt += `\nHourly breakdown:\n`;
  for (const ha of assessments) {
    const time = typeof ha.time === 'string' ? new Date(ha.time) : ha.time;
    const timeStr = time.toLocaleTimeString('en-NZ', { hour: 'numeric', hour12: true });
    const tideKmh = ha.tide.currentSpeedKmh || 0;
    prompt += `${timeStr}: Outbound ${formatNet(ha.outboundNetKmh)} (${ha.outboundLevel}), Return ${formatNet(ha.returnNetKmh)} (${ha.returnLevel}), Wind ${ha.weather.windSpeed}km/h ${ha.weather.windDirection}, Gusts ${ha.weather.gustSpeed}km/h, Tide ${tideKmh}km/h ${ha.tide.direction}, Rain ${ha.weather.rainProbability}%, Temp ${ha.weather.temperature}°C\n`;
  }

  const midTime = assessments[4]?.time || assessments[0]?.time;
  prompt += `\nOutbound segment net assistance at ${formatTime(midTime)}:\n`;
  const midAssessment = assessments[Math.floor(assessments.length / 2)];
  if (midAssessment) {
    for (const seg of midAssessment.outboundSegments) {
      prompt += `${seg.from} → ${seg.to}: ${formatNet(seg.netAssistanceKmh)} (wind ${formatNet(seg.windImpactKmh)}, tide ${formatNet(seg.tideImpactKmh)}, chop ${formatNet(seg.chopImpactKmh)}, rain ${formatNet(seg.rainImpactKmh)})\n`;
    }
  }

  return prompt;
}

function formatTime(d) {
  if (!d) return '';
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleTimeString('en-NZ', { hour: 'numeric', hour12: true });
}

function formatNet(kmh) {
  if (kmh == null) return '0 km/h';
  const sign = kmh > 0 ? '+' : '';
  return `${sign}${kmh} km/h`;
}
