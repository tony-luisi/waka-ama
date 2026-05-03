# Waka Ama Conditions — Tāmaki Estuary

A TypeScript website to assess waka ama paddling conditions for the Tāmaki Estuary round trip (The Ramp → No 9 → The Ramp). Combines weather, tide, wind-derived chop, and AI-powered forecast synthesis to recommend the best time to paddle.

## Features

- **Time Optimiser**: Analyses every hour 9am–9pm to find the best window for your round trip
- **AI-Powered Forecast**: GPT-4o-mini synthesises conditions into natural-language advice, route recommendations, and safety alerts
- **Per-Segment Difficulty**: 10 route segments scored independently based on wind, chop, tide, rain, time, and temperature
- **Raw Conditions Panel**: Windy-style charts showing wind, tide curve, rain probability, and temperature
- **Interactive Map**: Full route with all 11 waypoints and wind overlay
- **Graceful Degradation**: Works without any API keys using realistic fallback data

## The Route

The Ramp → Rayglass → Red Pole → Second Bridge → Tamaki → St Kents → The Kat → First Red → Third Red → Half Moon Bay → No 9 (and back)

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure API keys:**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your API keys
   ```

   | Service | Key | Required? |
   |---------|-----|-----------|
   | NIWA Tides | `VITE_NIWA_API_KEY` | No (fallback tides) |
   | OpenWeatherMap | `VITE_OPENWEATHER_API_KEY` | No (fallback weather) |
   | OpenAI | `VITE_OPENAI_API_KEY` | No (AI card hides without key) |

3. **Run locally (full stack):**

   Terminal 1 — API server:
   ```bash
   npm run dev:api
   ```

   Terminal 2 — Vite dev server:
   ```bash
   npm run dev
   ```

   Then open http://localhost:5173

4. **Build for production:**
   ```bash
   npm run build
   ```

## Local Testing

### Without API keys (fallback mode)
The app works completely offline with realistic synthetic data. Perfect for testing the UI and scoring logic:
```bash
npm run dev
```

### With API keys (full data mode)
For real weather, tide, and AI synthesis:
```bash
# Terminal 1
npm run dev:api

# Terminal 2
npm run dev
```

The dev API server (`scripts/dev-api-server.js`) runs the Vercel functions locally on port 3001. Vite proxies `/api/*` requests to it automatically.

### Testing the AI endpoint directly
```bash
curl -X POST http://localhost:3001/api/forecast-synthesis \
  -H "Content-Type: application/json" \
  -d '{"forecast":{"hourlyAssessments":[]}}'
```

## API Integration

### NIWA Tides API
- **Purpose**: Real New Zealand tide data
- **Setup**: Get API key from [developer.niwa.co.nz](https://developer.niwa.co.nz/)
- **Coverage**: Waitemata Harbour / Tāmaki Estuary

### OpenWeatherMap API
- **Purpose**: Weather data (wind, rain, temperature)
- **Setup**: Get API key from [openweathermap.org](https://openweathermap.org/api)
- **Coverage**: Auckland region

### OpenAI API
- **Purpose**: Forecast synthesis and natural-language recommendations
- **Setup**: Get API key from [platform.openai.com](https://platform.openai.com)
- **Model**: GPT-4o-mini (cheap, fast, good at structured output)

## Difficulty Scoring

Each route segment is scored 0–10 based on:

| Factor | Weight | Logic |
|--------|--------|-------|
| **Wind** | 25% | Tailwind vs headwind for segment bearing |
| **Chop** | 25% | Wind-derived wave height from fetch distance + exposure |
| **Tide** | 20% | Ebb assists outbound, flood assists return |
| **Rain** | 15% | Probability + intensity — comfort and visibility |
| **Time** | 10% | Afternoon window (2–5pm) ideal |
| **Temperature** | 5% | 20–26°C ideal |

## Tech Stack

- **Frontend**: TypeScript, Vite, Leaflet maps
- **APIs**: NIWA Tides, OpenWeatherMap, OpenAI GPT-4o-mini
- **Styling**: CSS Grid, responsive design, Polynesian/marine palette
- **Deployment**: Vercel (static site + serverless functions)
