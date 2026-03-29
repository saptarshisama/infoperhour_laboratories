/**
 * weather.js — Open-Meteo Weather Alerts Layer
 * Direct API (no proxy needed — CORS is open)
 * Shows severe weather markers at monitored locations
 */

const WEATHER = (() => {

  let leafletMap = null;
  let enabled    = false;
  const markers  = new Map(); // name → L.marker

  // Global monitoring locations — geopolitically significant areas
  const LOCATIONS = [
    { name: 'London', lat: 51.5, lon: -0.1 },
    { name: 'Paris', lat: 48.8, lon: 2.3 },
    { name: 'Berlin', lat: 52.5, lon: 13.4 },
    { name: 'Rome', lat: 41.9, lon: 12.5 },
    { name: 'Madrid', lat: 40.4, lon: -3.7 },
    { name: 'Moscow', lat: 55.7, lon: 37.6 },
    { name: 'New York', lat: 40.7, lon: -74.0 },
    { name: 'Los Angeles', lat: 34.0, lon: -118.2 },
    { name: 'Chicago', lat: 41.8, lon: -87.6 },
    { name: 'Toronto', lat: 43.7, lon: -79.3 },
    { name: 'Mexico City', lat: 19.4, lon: -99.1 },
    { name: 'Bogota', lat: 4.7, lon: -74.0 },
    { name: 'Lima', lat: -12.0, lon: -77.0 },
    { name: 'Sao Paulo', lat: -23.5, lon: -46.6 },
    { name: 'Buenos Aires', lat: -34.6, lon: -58.3 },
    { name: 'Cairo', lat: 30.0, lon: 31.2 },
    { name: 'Lagos', lat: 6.5, lon: 3.3 },
    { name: 'Kinshasa', lat: -4.4, lon: 15.2 },
    { name: 'Nairobi', lat: -1.2, lon: 36.8 },
    { name: 'Johannesburg', lat: -26.2, lon: 28.0 },
    { name: 'Istanbul', lat: 41.0, lon: 28.9 },
    { name: 'Tehran', lat: 35.6, lon: 51.3 },
    { name: 'Riyadh', lat: 24.7, lon: 46.7 },
    { name: 'Dubai', lat: 25.2, lon: 55.2 },
    { name: 'Mumbai', lat: 19.0, lon: 72.8 },
    { name: 'New Delhi', lat: 28.6, lon: 77.2 },
    { name: 'Bangkok', lat: 13.7, lon: 100.5 },
    { name: 'Singapore', lat: 1.3, lon: 103.8 },
    { name: 'Beijing', lat: 39.9, lon: 116.4 },
    { name: 'Shanghai', lat: 31.2, lon: 121.4 },
    { name: 'Tokyo', lat: 35.6, lon: 139.6 },
    { name: 'Seoul', lat: 37.5, lon: 126.9 },
    { name: 'Sydney', lat: -33.8, lon: 151.2 },
    { name: 'Melbourne', lat: -37.8, lon: 144.9 },
    { name: 'Auckland', lat: -36.8, lon: 174.7 },
    { name: 'Kyiv', lat: 50.45, lon: 30.52 },
    { name: 'Gaza', lat: 31.50, lon: 34.47 },
    { name: 'Beirut', lat: 33.89, lon: 35.50 },
    { name: 'Baghdad', lat: 33.34, lon: 44.40 },
    { name: 'Damascus', lat: 33.51, lon: 36.29 },
    { name: 'Khartoum', lat: 15.56, lon: 32.53 },
    { name: 'Kabul', lat: 34.53, lon: 69.17 },
    { name: 'Karachi', lat: 24.86, lon: 67.01 },
    { name: 'Dhaka', lat: 23.81, lon: 90.41 },
    { name: 'Manila', lat: 14.60, lon: 120.98 },
    { name: 'Jakarta', lat: -6.21, lon: 106.84 },
    { name: 'Miami', lat: 25.77, lon: -80.19 },
    { name: 'New Orleans', lat: 29.95, lon: -90.08 }
  ];

  // WMO weather code → severity info
  const WMO = {
    95: { label: 'Thunderstorm',       icon: '⛈', sev: 3 },
    96: { label: 'Thunderstorm+Hail',  icon: '⛈', sev: 4 },
    99: { label: 'Heavy Thunder+Hail', icon: '🌩', sev: 5 },
    82: { label: 'Violent Rain',       icon: '🌧', sev: 4 },
    75: { label: 'Heavy Snow',         icon: '❄',  sev: 3 },
    77: { label: 'Snow Grains',        icon: '❄',  sev: 2 },
    67: { label: 'Heavy Freezing Rain',icon: '🌧', sev: 3 },
    57: { label: 'Heavy Ice Drizzle',  icon: '🌧', sev: 3 },
    55: { label: 'Dense Drizzle',      icon: '🌧', sev: 2 },
    65: { label: 'Heavy Rain',         icon: '🌧', sev: 3 },
    71: { label: 'Heavy Snowfall',     icon: '❄',  sev: 3 },
  };

  const SEV_COLORS = ['','#22c55e','#84cc16','#f59e0b','#f97316','#ef4444'];

  async function fetchLocation(loc) {
    const url = [
      'https://api.open-meteo.com/v1/forecast',
      `?latitude=${loc.lat}&longitude=${loc.lon}`,
      '&current_weather=true',
      '&hourly=windspeed_10m,precipitation_probability',
      '&forecast_days=1&timezone=UTC',
    ].join('');

    const res  = await fetch(url, { timeout: 8000 });
    const data = await res.json();
    const cw   = data.current_weather;
    const prec = data.hourly?.precipitation_probability?.[0] || 0;

    return {
      ...loc,
      code:    cw?.weathercode,
      temp:    cw?.temperature,
      wind:    cw?.windspeed,
      precip:  prec,
    };
  }

  function makeWeatherIcon(wmo, wind) {
    const color = wmo ? SEV_COLORS[wmo.sev] : (wind > 70 ? '#ef4444' : '#f59e0b');
    const icon  = wmo ? wmo.icon : '💨';
    return L.divIcon({
      className: '',
      html: `<div class="weather-marker" style="text-shadow:0 0 6px ${color};font-size:16px;line-height:1">${icon}</div>`,
      iconSize:   [20, 20],
      iconAnchor: [10, 10],
    });
  }

  async function fetchAndRender() {
    if (!enabled || !leafletMap) return;

    const results = await Promise.allSettled(LOCATIONS.map(fetchLocation));

    results.forEach(r => {
      if (r.status !== 'fulfilled') return;
      const w   = r.value;
      const wmo = WMO[w.code];

      // Only show markers for genuinely severe conditions
      const isSevere = wmo || w.wind > 50;
      if (!isSevere) return;

      const sev   = wmo ? wmo.sev : (w.wind > 80 ? 4 : 3);
      const label = wmo ? wmo.label : `Strong Wind (${w.wind} km/h)`;
      const icon  = wmo ? wmo.icon  : '💨';

      const color = SEV_COLORS[sev];
      const leafIcon = makeWeatherIcon(wmo, w.wind);

      const existing = markers.get(w.name);
      if (existing) leafletMap.removeLayer(existing);

      const m = L.marker([w.lat, w.lon], { icon: leafIcon });
      m.bindTooltip(
        `<div style="font-family:'JetBrains Mono',monospace;font-size:11px;line-height:1.6">
          <strong style="color:${color}">${icon} ${label}</strong><br/>
          ${w.name} &nbsp; ${w.temp}°C<br/>
          Wind ${w.wind} km/h · Rain prob. ${w.precip}%
        </div>`,
        { direction: 'top', className: 'wm-tooltip', opacity: 1 }
      );
      m.addTo(leafletMap);
      markers.set(w.name, m);
    });

    const el = document.getElementById('ovlc-weather');
    if (el) el.textContent = markers.size.toString();
  }

  function enable(map) {
    leafletMap = map;
    enabled    = true;
    fetchAndRender();
  }

  function disable() {
    enabled = false;
    markers.forEach(m => leafletMap?.removeLayer(m));
    markers.clear();
  }

  function toggle(map) {
    if (enabled) disable(); else enable(map);
    return enabled;
  }

  return { enable, disable, toggle };
})();
