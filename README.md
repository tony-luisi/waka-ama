# Waka Ama Conditions

A TypeScript website to assess waka ama paddling conditions at Ian Shaw Park, Auckland. Combines weather, tide, and timing data to provide intelligent recommendations for optimal paddling conditions.

## Features

- **Real-time Conditions**: Current weather, tide, and difficulty assessment
- **Interactive Map**: Wind visualization with direction arrows and speed indicators
- **Extended Forecasts**: Hourly forecasts for today and tomorrow (2-8pm focus)
- **Intelligent Scoring**: Considers wind, tide, time, and temperature
- **API Integration**: NIWA tides and OpenWeatherMap with fallback data

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure API keys (optional):**
   ```bash
   cp .env.example .env
   # Edit .env with your API keys
   ```

3. **Run development server:**
   ```bash
   npm run dev
   ```

4. **Build for production:**
   ```bash
   npm run build
   ```

## API Integration

### NIWA Tides API
- **Purpose**: Real New Zealand tide data
- **Setup**: Get API key from [developer.niwa.co.nz](https://developer.niwa.co.nz/)
- **Coverage**: Waitemata Harbour (Ian Shaw Park area)

### OpenWeatherMap API
- **Purpose**: Fallback weather data
- **Setup**: Get API key from [openweathermap.org](https://openweathermap.org/api)
- **Coverage**: Global weather including Auckland

### Fallback Data
If no API keys are configured, the app uses realistic generated data patterns that simulate:
- Daily weather variations
- Tidal patterns
- Seasonal temperature changes

## Difficulty Scoring

The paddling difficulty is calculated based on:

- **Wind (40%)**: Speed, direction (offshore better), gusts
- **Tide (30%)**: Height (higher better), type (high vs low)
- **Time (20%)**: Optimal 4-7pm weekday window
- **Temperature (10%)**: Comfort factor (18-26°C ideal)

## Location Focus

- **Primary Site**: Ian Shaw Park, Auckland
- **Optimal Times**: Weekdays 4-7pm
- **Ideal Conditions**: NE/E/SE winds, high tide, mild temperatures

## Tech Stack

- **Frontend**: TypeScript, Vite, Leaflet maps
- **APIs**: NIWA Tides, OpenWeatherMap
- **Styling**: CSS Grid, responsive design
- **Deployment**: Static site generation