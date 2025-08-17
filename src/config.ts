// Determine if we're running in production (Vercel) or development
const isProduction = typeof window !== 'undefined' && window.location.hostname !== 'localhost';

export const API_CONFIG = {
  // API routes - use Vercel functions in production, direct calls in development
  apiBaseUrl: isProduction ? '' : 'http://localhost:5173',
  
  metservice: {
    baseUrl: 'http://metservice.com/maps-radar/local-observations',
    observationsUrl: 'http://metservice.com/maps-radar/local-observations/local-3-hourly-observations',
    surfaceDataUrl: 'http://metservice.com/maps-radar/coded-data/surface-data'
  },
  niwa: {
    baseUrl: 'https://tides.niwa.co.nz',
    // In production, use our API proxy; in development, use direct API calls
    apiUrl: isProduction ? '/api/niwa-tides' : 'https://forecast-v2.metservice.com/niwa/tide',
    // Only use API key in development - production uses environment variables on server
    apiKey: isProduction ? undefined : 'yWcExmYHoto0wFcQC6hIwSZtSv0oSeGy'
  },
  fallback: {
    openWeatherMap: {
      // In production, use our API proxy; in development, use direct API calls
      baseUrl: isProduction ? '/api/weather' : 'https://api.openweathermap.org/data/2.5',
      // Only use API key in development - production uses environment variables on server
      apiKey: isProduction ? undefined : 'e897cab153a2616dff2c7e0563c8e50e'
    }
  },
  locations: {
    ianShawPark: {
      lat: -36.8485,
      lng: 174.7633,
      name: 'Ian Shaw Park',
      metserviceStation: 'Auckland',
      niwaLocation: 'Waitemata Harbour'
    }
  }
};