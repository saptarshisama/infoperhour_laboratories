/**
 * weather.js — Open-Meteo Weather Alerts Layer
 * Direct API (CORS open, no key needed)
 * Fixed: use AbortSignal.timeout() instead of invalid fetch {timeout} option
 * Shows ALL weather markers (not just severe) with severity-based styling
 */

const WEATHER = (() => {

  let leafletMap = null;
  let enabled    = false;
  const markers  = new Map();

  const LOCATIONS = [
    { name: 'London',        lat: 51.5,   lon: -0.1   }, { name: 'Paris',        lat: 48.8,  lon: 2.3   },
    { name: 'Berlin',        lat: 52.5,   lon: 13.4   }, { name: 'Rome',         lat: 41.9,  lon: 12.5  },
    { name: 'Madrid',        lat: 40.4,   lon: -3.7   }, { name: 'Moscow',       lat: 55.75, lon: 37.6  },
    { name: 'Kyiv',          lat: 50.45,  lon: 30.52  }, { name: 'Warsaw',       lat: 52.2,  lon: 21.0  },
    { name: 'Vienna',        lat: 48.2,   lon: 16.37  }, { name: 'Amsterdam',    lat: 52.3,  lon: 4.9   },
    { name: 'Stockholm',     lat: 59.3,   lon: 18.0   }, { name: 'Oslo',         lat: 59.9,  lon: 10.7  },
    { name: 'Athens',        lat: 37.9,   lon: 23.7   }, { name: 'New York',     lat: 40.7,  lon: -74.0 },
    { name: 'Los Angeles',   lat: 34.05,  lon: -118.24 }, { name: 'Chicago',     lat: 41.87, lon: -87.62 },
    { name: 'Toronto',       lat: 43.7,   lon: -79.4  }, { name: 'Miami',        lat: 25.76, lon: -80.19 },
    { name: 'Mexico City',   lat: 19.43,  lon: -99.13 }, { name: 'Sao Paulo',    lat: -23.55,lon: -46.63 },
    { name: 'Buenos Aires',  lat: -34.6,  lon: -58.38 }, { name: 'Bogota',       lat: 4.71,  lon: -74.07 },
    { name: 'Lima',          lat: -12.04, lon: -77.04 }, { name: 'Rio de Janeiro',lat:-22.9, lon: -43.1 },
    { name: 'Tokyo',         lat: 35.67,  lon: 139.65 }, { name: 'Seoul',        lat: 37.56, lon: 126.97 },
    { name: 'Beijing',       lat: 39.9,   lon: 116.4  }, { name: 'Shanghai',     lat: 31.23, lon: 121.47 },
    { name: 'Hong Kong',     lat: 22.3,   lon: 114.1  }, { name: 'Taipei',       lat: 25.0,  lon: 121.5 },
    { name: 'Manila',        lat: 14.59,  lon: 120.98 }, { name: 'Bangkok',      lat: 13.75, lon: 100.5 },
    { name: 'Singapore',     lat: 1.35,   lon: 103.8  }, { name: 'Jakarta',      lat: -6.2,  lon: 106.8 },
    { name: 'New Delhi',     lat: 28.61,  lon: 77.2   }, { name: 'Mumbai',       lat: 19.07, lon: 72.87 },
    { name: 'Karachi',       lat: 24.86,  lon: 67.0   }, { name: 'Dhaka',        lat: 23.81, lon: 90.41 },
    { name: 'Tehran',        lat: 35.68,  lon: 51.38  }, { name: 'Dubai',        lat: 25.2,  lon: 55.27 },
    { name: 'Riyadh',        lat: 24.71,  lon: 46.67  }, { name: 'Istanbul',     lat: 41.0,  lon: 28.97 },
    { name: 'Cairo',         lat: 30.04,  lon: 31.23  }, { name: 'Baghdad',      lat: 33.31, lon: 44.36 },
    { name: 'Jerusalem',     lat: 31.7,   lon: 35.2   }, { name: 'Beirut',       lat: 33.89, lon: 35.5  },
    { name: 'Sydney',        lat: -33.86, lon: 151.2  }, { name: 'Melbourne',    lat: -37.81,lon: 144.96 },
    { name: 'Johannesburg',  lat: -26.2,  lon: 28.0   }, { name: 'Nairobi',      lat: -1.29, lon: 36.82 },
    { name: 'Lagos',         lat: 6.52,   lon: 3.37   }, { name: 'Kabul',        lat: 34.55, lon: 69.2  },
    { name: 'Kyiv',          lat: 50.45,  lon: 30.52  }, { name: 'Damascus',     lat: 33.51, lon: 36.29 },
    { name: 'Doha',          lat: 25.28,  lon: 51.52  }, { name: 'Ankara',       lat: 39.9,  lon: 32.8  },
  ];

  // WMO weather interpretation codes
  const WMO = {
    0:  { label: 'Clear',             icon: '☀️',  sev: 0 },
    1:  { label: 'Mainly Clear',      icon: '🌤',  sev: 0 },
    2:  { label: 'Partly Cloudy',     icon: '⛅',  sev: 0 },
    3:  { label: 'Overcast',          icon: '☁️',  sev: 0 },
    45: { label: 'Fog',               icon: '🌫',  sev: 1 },
    48: { label: 'Icy Fog',           icon: '🌫',  sev: 2 },
    51: { label: 'Light Drizzle',     icon: '🌦',  sev: 1 },
    53: { label: 'Drizzle',           icon: '🌦',  sev: 1 },
    55: { label: 'Dense Drizzle',     icon: '🌧',  sev: 2 },
    61: { label: 'Light Rain',        icon: '🌧',  sev: 1 },
    63: { label: 'Rain',              icon: '🌧',  sev: 2 },
    65: { label: 'Heavy Rain',        icon: '🌧',  sev: 3 },
    71: { label: 'Light Snow',        icon: '🌨',  sev: 1 },
    73: { label: 'Snow',              icon: '🌨',  sev: 2 },
    75: { label: 'Heavy Snow',        icon: '❄️',  sev: 3 },
    77: { label: 'Snow Grains',       icon: '❄️',  sev: 2 },
    80: { label: 'Light Showers',     icon: '🌦',  sev: 1 },
    81: { label: 'Showers',           icon: '🌧',  sev: 2 },
    82: { label: 'Violent Rain',      icon: '🌧',  sev: 4 },
    85: { label: 'Snow Showers',      icon: '🌨',  sev: 2 },
    86: { label: 'Heavy Snow Showers',icon: '❄️',  sev: 3 },
    95: { label: 'Thunderstorm',      icon: '⛈',  sev: 3 },
    96: { label: 'Thunder + Hail',    icon: '⛈',  sev: 4 },
    99: { label: 'Heavy Thunder+Hail',icon: '🌩',  sev: 5 },
  };

  // sev 0=grey, 1=green, 2=yellow, 3=amber, 4=orange, 5=red
  const SEV_COLORS = ['#475569', '#22c55e', '#84cc16', '#f59e0b', '#f97316', '#ef4444'];

  async function fetchLocation(loc) {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}&current_weather=true&hourly=precipitation_probability&forecast_days=1&timezone=UTC`;
    const res  = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const cw   = data.current_weather || {};
    return {
      ...loc,
      code:   cw.weathercode ?? cw.weather_code ?? -1,
      temp:   cw.temperature  ?? null,
      wind:   cw.windspeed    ?? 0,
      precip: data.hourly?.precipitation_probability?.[0] ?? 0,
    };
  }

  function renderLocation(w) {
    const wmo   = WMO[w.code];
    const sev   = wmo ? wmo.sev : (w.wind > 80 ? 4 : w.wind > 50 ? 3 : 1);
    const label = wmo ? wmo.label : `Wind ${w.wind} km/h`;
    const icon  = wmo ? wmo.icon  : '💨';

    // Show everything sev >= 1 (hide only perfectly clear sky sev=0 AND low wind)
    if (sev === 0 && w.wind < 40) return;

    const color    = SEV_COLORS[Math.min(sev, 5)];
    const leafIcon = L.divIcon({
      className: '',
      html: `<div class="weather-marker" style="text-shadow:0 0 8px ${color};font-size:15px;line-height:1;cursor:pointer">${icon}</div>`,
      iconSize:   [20, 20],
      iconAnchor: [10, 10],
    });

    const existing = markers.get(w.name);
    if (existing) leafletMap.removeLayer(existing);

    const m = L.marker([w.lat, w.lon], { icon: leafIcon });
    m.bindTooltip(
      `<div style="font-family:'JetBrains Mono',monospace;font-size:11px;line-height:1.6">
        <strong style="color:${color}">${icon} ${label}</strong><br/>
        ${w.name}&nbsp; ${w.temp != null ? w.temp + '°C' : ''}<br/>
        Wind: ${w.wind} km/h &nbsp; Rain: ${w.precip}%
      </div>`,
      { direction: 'top', className: 'wm-tooltip', opacity: 1 }
    );
    m.addTo(leafletMap);
    markers.set(w.name, m);
  }

  async function fetchAndRender() {
    if (!enabled || !leafletMap) return;
    console.log('[Weather] Fetching conditions for', LOCATIONS.length, 'cities…');

    // Batch in groups of 10 to avoid hammering Open-Meteo
    const BATCH = 10;
    for (let i = 0; i < LOCATIONS.length; i += BATCH) {
      if (!enabled) return;
      const batch = LOCATIONS.slice(i, i + BATCH);
      const results = await Promise.allSettled(batch.map(fetchLocation));
      results.forEach(r => {
        if (r.status === 'fulfilled') renderLocation(r.value);
      });
    }

    const el = document.getElementById('ovlc-weather');
    if (el) el.textContent = markers.size.toString();
    console.log(`[Weather] ${markers.size} markers rendered`);
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
    const el = document.getElementById('ovlc-weather');
    if (el) el.textContent = '';
  }

  function toggle(map) {
    if (enabled) disable(); else enable(map);
    return enabled;
  }

  return { enable, disable, toggle };
})();
