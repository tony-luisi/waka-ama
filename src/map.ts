import * as L from 'leaflet';
import { ianShawPark } from './data';
import { WeatherConditions } from './types';

export class WindMap {
  private map: L.Map;
  private windMarker: L.Marker | null = null;

  constructor(containerId: string) {
    this.map = L.map(containerId, {
      center: [ianShawPark.coordinates.lat, ianShawPark.coordinates.lng],
      zoom: 13,
      zoomControl: true
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(this.map);

    this.addLocationMarker();
  }

  private addLocationMarker(): void {
    const icon = L.divIcon({
      html: '🛶',
      className: 'location-marker',
      iconSize: [30, 30],
      iconAnchor: [15, 15]
    });

    L.marker([ianShawPark.coordinates.lat, ianShawPark.coordinates.lng], { icon })
      .addTo(this.map)
      .bindPopup(`<b>${ianShawPark.name}</b><br/>Waka Ama Launch Site`);
  }

  private createWindArrow(weather: WeatherConditions): string {
    const directions = {
      'N': 0, 'NNE': 22.5, 'NE': 45, 'ENE': 67.5,
      'E': 90, 'ESE': 112.5, 'SE': 135, 'SSE': 157.5,
      'S': 180, 'SSW': 202.5, 'SW': 225, 'WSW': 247.5,
      'W': 270, 'WNW': 292.5, 'NW': 315, 'NNW': 337.5
    };

    const angle = directions[weather.windDirection as keyof typeof directions] || 0;
    const color = this.getWindColor(weather.windSpeed);
    const size = Math.min(Math.max(weather.windSpeed / 2, 8), 20);

    return `
      <div class="wind-arrow" style="
        width: ${size * 2}px; 
        height: ${size * 2}px;
        transform: rotate(${angle}deg);
        background-color: ${color};
        border-radius: 50% 50% 50% 0;
        position: relative;
      ">
        <div style="
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          font-size: ${Math.max(size / 2, 8)}px;
          color: white;
          font-weight: bold;
        ">${weather.windSpeed}</div>
      </div>
    `;
  }

  private getWindColor(windSpeed: number): string {
    if (windSpeed <= 10) return '#4ade80';
    if (windSpeed <= 20) return '#fbbf24';
    if (windSpeed <= 30) return '#f87171';
    return '#dc2626';
  }

  updateWind(weather: WeatherConditions): void {
    if (this.windMarker) {
      this.map.removeLayer(this.windMarker);
    }

    const windIcon = L.divIcon({
      html: this.createWindArrow(weather),
      className: 'wind-marker',
      iconSize: [40, 40],
      iconAnchor: [20, 20]
    });

    this.windMarker = L.marker(
      [ianShawPark.coordinates.lat + 0.002, ianShawPark.coordinates.lng + 0.002], 
      { icon: windIcon }
    ).addTo(this.map);

    this.windMarker.bindPopup(`
      <div class="wind-popup">
        <h4>Wind Conditions</h4>
        <p><strong>Speed:</strong> ${weather.windSpeed} km/h</p>
        <p><strong>Direction:</strong> ${weather.windDirection}</p>
        <p><strong>Gusts:</strong> ${weather.gustSpeed} km/h</p>
        <p><strong>Temperature:</strong> ${weather.temperature}°C</p>
      </div>
    `);
  }

  resize(): void {
    this.map.invalidateSize();
  }
}