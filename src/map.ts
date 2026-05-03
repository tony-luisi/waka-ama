import * as L from 'leaflet';
import { WAYPOINTS } from './config';
import { WeatherConditions } from './types';
import { arrowRotationFromWindFromLabel } from './wind-display';

export class WindMap {
  private map: L.Map;
  private windMarker: L.Marker | null = null;
  
  private waypointMarkers: L.Marker[] = [];

  constructor(containerId: string) {
    this.map = L.map(containerId, { zoomControl: true });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(this.map);

    this.addWaypoints();
    this.addRoute();
    this.fitBounds();
  }

  private addWaypoints(): void {
    WAYPOINTS.forEach((wp, i) => {
      const isStart = i === 0;
      const isEnd = i === WAYPOINTS.length - 1;
      const icon = L.divIcon({
        html: isStart ? '🚀' : isEnd ? '🎯' : '●',
        className: 'location-marker',
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      });

      const marker = L.marker([wp.lat, wp.lng], { icon }).addTo(this.map);
      marker.bindPopup(`<b>${wp.nickname}</b><br/>Waypoint ${i + 1} of ${WAYPOINTS.length}`);
      this.waypointMarkers.push(marker);
    });
  }

  private addRoute(): void {
    const coords: [number, number][] = WAYPOINTS.map(wp => [wp.lat, wp.lng]);
    L.polyline(coords, {
      color: '#3b82f6',
      weight: 3,
      opacity: 0.7,
      dashArray: '8, 8'
    }).addTo(this.map);
  }

  private createWindArrow(weather: WeatherConditions): string {
    const angle = arrowRotationFromWindFromLabel(weather.windDirection);
    const color = weather.windSpeed <= 10 ? '#4ade80' : weather.windSpeed <= 20 ? '#fbbf24' : '#f87171';
    const size = 14;

    return `
      <div style="position: relative; width: 50px; height: 50px;">
        <div style="
          width: ${size * 2}px; height: ${size * 2}px;
          transform: rotate(${angle}deg);
          background-color: ${color};
          position: absolute; top: 50%; left: 50%;
          margin: -${size}px 0 0 -${size}px;
          border-radius: 50% 50% 50% 0;
          border: 2px solid white;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        ">
          <div style="
            position: absolute; top: 50%; left: 50%;
            transform: translate(-50%, -50%) rotate(-${angle}deg);
            font-size: 9px; color: white; font-weight: bold;
            text-shadow: 1px 1px 2px rgba(0,0,0,0.7);
          ">${weather.windSpeed}</div>
        </div>
        <div style="
          position: absolute; bottom: -16px; left: 50%;
          transform: translateX(-50%);
          background: rgba(0,0,0,0.8); color: white;
          padding: 2px 5px; border-radius: 3px;
          font-size: 9px; font-weight: bold; white-space: nowrap;
        ">${weather.windDirection}</div>
      </div>
    `;
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

    const start = WAYPOINTS[0];
    this.windMarker = L.marker(
      [start.lat + 0.001, start.lng + 0.003],
      { icon: windIcon }
    ).addTo(this.map);

    this.windMarker.bindPopup(`
      <div style="font-size: 0.9rem">
        <b>💨 Wind at The Ramp</b><br/>
        ${weather.windSpeed} km/h ${weather.windDirection}<br/>
        Gusts: ${weather.gustSpeed} km/h<br/>
        Temp: ${weather.temperature}°C
      </div>
    `);
  }

  private fitBounds(): void {
    const bounds = L.latLngBounds(WAYPOINTS.map(wp => [wp.lat, wp.lng]));
    this.map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
  }

  resize(): void {
    this.map.invalidateSize();
  }
}
