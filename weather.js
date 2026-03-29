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
    { name: 'Kyiv',        lat: 50.45,   lon: 30.52  },
    { name: 'Gaza',        lat: 31.50,   lon: 34.47  },
    { name: 'Beirut',      lat: 33.89,   lon: 35.50  },
    { name: 'Baghdad',     lat: 33.34,   lon: 44.40  },
    { name: 'Damascus',    lat: 33.51,   lon: 36.29  },
    { name: 'Khartoum',    lat: 15.56,   lon: 32.53  },
    { name: 'Kabul',       lat: 34.53,   lon: 69.17  },
    { name: 'Karachi',     lat: 24.86,   lon: 67.01  },
    { name: 'Dhaka',       lat: 23.81,   lon: 90.41  },
    { name: 'Manila',      lat: 14.60,   lon: 120.98 },
    { name: 'Jakarta',     lat: -6.21,   lon: 106.84 },
    { name: 'Miami',       lat: 25.77,   lon: -80.19 },
    { name: 'New Orleans', lat: 29.95,   lon: -90.08 },
    { name: 'Mogadishu',   lat:  2.05,   lon: 45.34  },
    { name: 'Havana',      lat: 23.13,   lon: -82.38 },
    { name: 'Tegucigalpa', lat: 14.10,   lon: -87.21 },
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
