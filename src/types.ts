export interface WeatherConditions {
  windSpeed: number;
  windDirection: string;
  gustSpeed: number;
  temperature: number;
  timestamp: Date;
}

export interface TideData {
  height: number;
  type: 'high' | 'low';
  direction: 'incoming' | 'outgoing' | 'slack';
  nextChange: Date;
  timestamp: Date;
}

export interface TideTime {
  time: Date;
  height: number;
  type: 'high' | 'low';
}

export interface DailyTides {
  date: Date;
  tides: TideTime[];
}

export interface PaddlingConditions {
  weather: WeatherConditions;
  tide: TideData;
  timeOfDay: Date;
  location: string;
}

export interface DifficultyAssessment {
  score: number;
  level: 'easy' | 'moderate' | 'difficult';
  recommendation: string;
  factors: {
    wind: number;
    tide: number;
    time: number;
    temperature: number;
  };
}

export interface PaddleDirectionAssessment {
  outgoing: DifficultyAssessment;
  incoming: DifficultyAssessment;
  recommended: 'outgoing' | 'incoming' | 'both' | 'neither';
  reasoning: string;
}

export interface LocationData {
  name: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  idealWindDirections: string[];
  sheltered: boolean;
}

export interface HourlyForecast {
  time: Date;
  weather: WeatherConditions;
  tide: TideData;
  difficulty: DifficultyAssessment;
  paddleDirections: PaddleDirectionAssessment;
}

export interface DailyForecast {
  date: Date;
  hourlyForecasts: HourlyForecast[];
  summary: {
    bestTime: Date;
    worstTime: Date;
    averageDifficulty: number;
    conditions: string;
  };
}

export interface ExtendedForecast {
  today: DailyForecast;
  tomorrow: DailyForecast;
}