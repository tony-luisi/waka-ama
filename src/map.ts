import * as L from 'leaflet';
import { ianShawPark } from './data';
import { WeatherConditions } from './types';

// Bucklands Beach coordinates (approximate destination)
const bucklandsBeach = {
  lat: -36.8405,
  lng: 174.7725,
  name: 'Bucklands Beach'
};

export class WindMap {
  private map: L.Map;
  private windMarker: L.Marker | null = null;
  private paddleRoute: L.Polyline | null = null;

  constructor(containerId: string) {
    this.map = L.map(containerId, {
      zoomControl: true
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(this.map);

    this.addLocationMarkers();
    this.addPaddleRoute();
    this.fitMapToBounds();
  }

  private addLocationMarkers(): void {
    // Ian Shaw Park (launch site)
    const launchIcon = L.divIcon({
      html: '🛶',
      className: 'location-marker',
      iconSize: [30, 30],
      iconAnchor: [15, 15]
    });

    L.marker([ianShawPark.coordinates.lat, ianShawPark.coordinates.lng], { icon: launchIcon })
      .addTo(this.map)
      .bindPopup(`<b>${ianShawPark.name}</b><br/>🚀 Launch Site<br/>Waka Ama Training`);

    // Bucklands Beach (destination)
    const destinationIcon = L.divIcon({
      html: '🏖️',
      className: 'location-marker',
      iconSize: [30, 30],
      iconAnchor: [15, 15]
    });

    L.marker([bucklandsBeach.lat, bucklandsBeach.lng], { icon: destinationIcon })
      .addTo(this.map)
      .bindPopup(`<b>${bucklandsBeach.name}</b><br/>🎯 Destination<br/>Paddle Training Route`);
  }

  private addPaddleRoute(): void {
    // Draw a line showing the typical paddle route
    const routeCoords: [number, number][] = [
      [ianShawPark.coordinates.lat, ianShawPark.coordinates.lng],
      [bucklandsBeach.lat, bucklandsBeach.lng]
    ];

    this.paddleRoute = L.polyline(routeCoords, {
      color: '#3b82f6',
      weight: 3,
      opacity: 0.7,
      dashArray: '10, 10'
    }).addTo(this.map);

    this.paddleRoute.bindPopup(`
      <b>Waka Ama Training Route</b><br/>
      🚀 Start: ${ianShawPark.name}<br/>
      🎯 Destination: ${bucklandsBeach.name}<br/>
      📏 Distance: ~0.8km
    `);
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
    const size = 16; // Fixed size for consistency

    return `
      <div style="position: relative; width: 50px; height: 50px;">
        <div class="wind-arrow" style="
          width: ${size * 2}px; 
          height: ${size * 2}px;
          transform: rotate(${angle}deg);
          background-color: ${color};
          position: absolute;
          top: 50%;
          left: 50%;
          margin: -${size}px 0 0 -${size}px;
          border-radius: 50% 50% 50% 0;
          border: 2px solid white;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        ">
          <div style="
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(-${angle}deg);
            font-size: 10px;
            color: white;
            font-weight: bold;
            text-shadow: 1px 1px 2px rgba(0,0,0,0.7);
          ">${weather.windSpeed}</div>
        </div>
        <div style="
          position: absolute;
          bottom: -18px;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(0,0,0,0.8);
          color: white;
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 10px;
          font-weight: bold;
          white-space: nowrap;
        ">${weather.windDirection}</div>
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
      iconSize: [50, 50],
      iconAnchor: [25, 25]
    });

    // Position wind marker slightly offset from launch site
    this.windMarker = L.marker(
      [ianShawPark.coordinates.lat + 0.001, ianShawPark.coordinates.lng + 0.003], 
      { icon: windIcon }
    ).addTo(this.map);

    // Determine wind impact on paddling
    const windImpact = this.getWindImpact(weather);

    this.windMarker.bindPopup(`
      <div class="wind-popup">
        <h4>💨 Current Wind</h4>
        <p><strong>Speed:</strong> ${weather.windSpeed} km/h</p>
        <p><strong>Direction:</strong> ${weather.windDirection}</p>
        <p><strong>Gusts:</strong> ${weather.gustSpeed} km/h</p>
        <p><strong>Temperature:</strong> ${weather.temperature}°C</p>
        <hr style="margin: 8px 0;">
        <p><strong>Paddling Impact:</strong></p>
        <p style="font-size: 0.9em; color: #666;">${windImpact}</p>
      </div>
    `);
  }

  private getWindImpact(weather: WeatherConditions): string {
    const { windDirection } = weather;
    
    if (['NE', 'ENE', 'E'].includes(windDirection)) {
      return `${windDirection} winds favor outgoing paddle to Bucklands Beach (tailwind)`;
    } else if (['SW', 'WSW', 'W'].includes(windDirection)) {
      return `${windDirection} winds favor incoming paddle to Ian Shaw Park (tailwind)`;
    } else if (['N', 'S', 'SE', 'NW'].includes(windDirection)) {
      return `${windDirection} crosswinds - manageable conditions`;
    } else {
      return `${windDirection} winds create variable conditions`;
    }
  }

  private fitMapToBounds(): void {
    // Create bounds that include both locations
    const bounds = L.latLngBounds([
      [ianShawPark.coordinates.lat, ianShawPark.coordinates.lng],
      [bucklandsBeach.lat, bucklandsBeach.lng]
    ]);
    
    // Fit map to bounds with padding
    this.map.fitBounds(bounds, {
      padding: [50, 50], // Add 50px padding on all sides
      maxZoom: 15 // Don't zoom in too close
    });
  }

  resize(): void {
    this.map.invalidateSize();
  }
}