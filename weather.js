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
    // ── EUROPE ─────────────────────────────────────────────────────────
    { name: 'London',        lat: 51.5,   lon: -0.1   },
    { name: 'Paris',         lat: 48.85,  lon: 2.35   },
    { name: 'Berlin',        lat: 52.52,  lon: 13.4   },
    { name: 'Rome',          lat: 41.9,   lon: 12.5   },
    { name: 'Madrid',        lat: 40.42,  lon: -3.7   },
    { name: 'Barcelona',     lat: 41.39,  lon: 2.16   },
    { name: 'Amsterdam',     lat: 52.37,  lon: 4.9    },
    { name: 'Brussels',      lat: 50.85,  lon: 4.35   },
    { name: 'Vienna',        lat: 48.2,   lon: 16.37  },
    { name: 'Warsaw',        lat: 52.23,  lon: 21.01  },
    { name: 'Stockholm',     lat: 59.33,  lon: 18.07  },
    { name: 'Oslo',          lat: 59.91,  lon: 10.75  },
    { name: 'Copenhagen',    lat: 55.68,  lon: 12.57  },
    { name: 'Helsinki',      lat: 60.17,  lon: 24.94  },
    { name: 'Athens',        lat: 37.98,  lon: 23.73  },
    { name: 'Lisbon',        lat: 38.72,  lon: -9.14  },
    { name: 'Zurich',        lat: 47.38,  lon: 8.54   },
    { name: 'Budapest',      lat: 47.5,   lon: 19.04  },
    { name: 'Prague',        lat: 50.08,  lon: 14.43  },
    { name: 'Bucharest',     lat: 44.43,  lon: 26.1   },
    { name: 'Kiev',          lat: 50.45,  lon: 30.52  },
    { name: 'Kharkiv',       lat: 49.99,  lon: 36.25  },
    { name: 'Moscow',        lat: 55.75,  lon: 37.62  },
    { name: 'St Petersburg', lat: 59.94,  lon: 30.32  },
    { name: 'Minsk',         lat: 53.9,   lon: 27.57  },
    { name: 'Belgrade',      lat: 44.8,   lon: 20.46  },
    { name: 'Sofia',         lat: 42.7,   lon: 23.32  },
    { name: 'Sarajevo',      lat: 43.85,  lon: 18.36  },
    { name: 'Dublin',        lat: 53.33,  lon: -6.25  },
    { name: 'Lyon',          lat: 45.75,  lon: 4.83   },
    { name: 'Hamburg',       lat: 53.55,  lon: 10.0   },
    { name: 'Milan',         lat: 45.46,  lon: 9.19   },
    { name: 'Naples',        lat: 40.85,  lon: 14.27  },
    { name: 'Marseille',     lat: 43.3,   lon: 5.37   },
    { name: 'Rotterdam',     lat: 51.92,  lon: 4.48   },

    // ── MIDDLE EAST ─────────────────────────────────────────────────────
    { name: 'Istanbul',      lat: 41.01,  lon: 28.97  },
    { name: 'Ankara',        lat: 39.93,  lon: 32.86  },
    { name: 'Tehran',        lat: 35.69,  lon: 51.39  },
    { name: 'Baghdad',       lat: 33.34,  lon: 44.4   },
    { name: 'Riyadh',        lat: 24.69,  lon: 46.72  },
    { name: 'Dubai',         lat: 25.2,   lon: 55.27  },
    { name: 'Abu Dhabi',     lat: 24.45,  lon: 54.38  },
    { name: 'Doha',          lat: 25.29,  lon: 51.53  },
    { name: 'Kuwait City',   lat: 29.37,  lon: 47.99  },
    { name: 'Muscat',        lat: 23.61,  lon: 58.59  },
    { name: 'Beirut',        lat: 33.89,  lon: 35.5   },
    { name: 'Damascus',      lat: 33.51,  lon: 36.29  },
    { name: 'Jerusalem',     lat: 31.77,  lon: 35.22  },
    { name: 'Tel Aviv',      lat: 32.08,  lon: 34.78  },
    { name: 'Cairo',         lat: 30.06,  lon: 31.25  },
    { name: 'Amman',         lat: 31.96,  lon: 35.94  },
    { name: 'Sanaa',         lat: 15.37,  lon: 44.19  },
    { name: 'Aden',          lat: 12.78,  lon: 45.04  },

    // ── CENTRAL ASIA ────────────────────────────────────────────────────
    { name: 'Kabul',         lat: 34.53,  lon: 69.17  },
    { name: 'Islamabad',     lat: 33.69,  lon: 73.06  },
    { name: 'Tashkent',      lat: 41.3,   lon: 69.27  },
    { name: 'Almaty',        lat: 43.25,  lon: 76.95  },
    { name: 'Baku',          lat: 40.41,  lon: 49.87  },
    { name: 'Tbilisi',       lat: 41.69,  lon: 44.83  },
    { name: 'Yerevan',       lat: 40.18,  lon: 44.51  },

    // ── SOUTH ASIA ──────────────────────────────────────────────────────
    { name: 'New Delhi',     lat: 28.63,  lon: 77.22  },
    { name: 'Mumbai',        lat: 19.08,  lon: 72.88  },
    { name: 'Kolkata',       lat: 22.57,  lon: 88.36  },
    { name: 'Chennai',       lat: 13.08,  lon: 80.27  },
    { name: 'Bangalore',     lat: 12.97,  lon: 77.59  },
    { name: 'Hyderabad',     lat: 17.38,  lon: 78.47  },
    { name: 'Ahmedabad',     lat: 23.03,  lon: 72.58  },
    { name: 'Karachi',       lat: 24.86,  lon: 67.01  },
    { name: 'Lahore',        lat: 31.55,  lon: 74.35  },
    { name: 'Dhaka',         lat: 23.81,  lon: 90.41  },
    { name: 'Colombo',       lat: 6.93,   lon: 79.84  },
    { name: 'Kathmandu',     lat: 27.72,  lon: 85.32  },
    { name: 'Yangon',        lat: 16.87,  lon: 96.15  },

    // ── EAST ASIA ────────────────────────────────────────────────────────
    { name: 'Beijing',       lat: 39.9,   lon: 116.39 },
    { name: 'Shanghai',      lat: 31.23,  lon: 121.47 },
    { name: 'Shenzhen',      lat: 22.54,  lon: 114.06 },
    { name: 'Guangzhou',     lat: 23.13,  lon: 113.26 },
    { name: 'Chengdu',       lat: 30.67,  lon: 104.07 },
    { name: 'Wuhan',         lat: 30.58,  lon: 114.27 },
    { name: 'Chongqing',     lat: 29.56,  lon: 106.55 },
    { name: 'Tianjin',       lat: 39.13,  lon: 117.18 },
    { name: 'Hong Kong',     lat: 22.32,  lon: 114.17 },
    { name: 'Taipei',        lat: 25.05,  lon: 121.53 },
    { name: 'Tokyo',         lat: 35.69,  lon: 139.69 },
    { name: 'Osaka',         lat: 34.69,  lon: 135.5  },
    { name: 'Seoul',         lat: 37.57,  lon: 126.98 },
    { name: 'Busan',         lat: 35.18,  lon: 129.08 },
    { name: 'Pyongyang',     lat: 39.03,  lon: 125.75 },
    { name: 'Ulaanbaatar',   lat: 47.91,  lon: 106.88 },

    // ── SOUTHEAST ASIA ───────────────────────────────────────────────────
    { name: 'Bangkok',       lat: 13.75,  lon: 100.52 },
    { name: 'Ho Chi Minh',   lat: 10.82,  lon: 106.63 },
    { name: 'Hanoi',         lat: 21.03,  lon: 105.85 },
    { name: 'Singapore',     lat: 1.35,   lon: 103.82 },
    { name: 'Kuala Lumpur',  lat: 3.14,   lon: 101.69 },
    { name: 'Jakarta',       lat: -6.21,  lon: 106.85 },
    { name: 'Manila',        lat: 14.6,   lon: 120.98 },
    { name: 'Phnom Penh',    lat: 11.57,  lon: 104.92 },
    { name: 'Vientiane',     lat: 17.97,  lon: 102.6  },
    { name: 'Rangoon',       lat: 16.87,  lon: 96.15  },
    { name: 'Surabaya',      lat: -7.25,  lon: 112.75 },

    // ── OCEANIA ──────────────────────────────────────────────────────────
    { name: 'Sydney',        lat: -33.87, lon: 151.21 },
    { name: 'Melbourne',     lat: -37.81, lon: 144.96 },
    { name: 'Brisbane',      lat: -27.47, lon: 153.03 },
    { name: 'Perth',         lat: -31.95, lon: 115.86 },
    { name: 'Auckland',      lat: -36.86, lon: 174.77 },
    { name: 'Canberra',      lat: -35.28, lon: 149.13 },
    { name: 'Port Moresby',  lat: -9.44,  lon: 147.18 },

    // ── AFRICA ───────────────────────────────────────────────────────────
    { name: 'Cairo',         lat: 30.06,  lon: 31.25  },
    { name: 'Lagos',         lat: 6.52,   lon: 3.38   },
    { name: 'Kinshasa',      lat: -4.32,  lon: 15.32  },
    { name: 'Johannesburg',  lat: -26.2,  lon: 28.04  },
    { name: 'Cape Town',     lat: -33.93, lon: 18.42  },
    { name: 'Nairobi',       lat: -1.29,  lon: 36.82  },
    { name: 'Addis Ababa',   lat: 9.02,   lon: 38.74  },
    { name: 'Khartoum',      lat: 15.55,  lon: 32.53  },
    { name: 'Mogadishu',     lat: 2.05,   lon: 45.34  },
    { name: 'Casablanca',    lat: 33.59,  lon: -7.62  },
    { name: 'Tunis',         lat: 36.82,  lon: 10.17  },
    { name: 'Tripoli',       lat: 32.9,   lon: 13.18  },
    { name: 'Accra',         lat: 5.56,   lon: -0.2   },
    { name: 'Abidjan',       lat: 5.35,   lon: -4.0   },
    { name: 'Dar es Salaam', lat: -6.8,   lon: 39.27  },
    { name: 'Kampala',       lat: 0.32,   lon: 32.58  },
    { name: 'Luanda',        lat: -8.84,  lon: 13.23  },
    { name: 'Kigali',        lat: -1.94,  lon: 30.06  },
    { name: 'Algiers',       lat: 36.74,  lon: 3.06   },
    { name: 'Dakar',         lat: 14.73,  lon: -17.47 },
    { name: 'Harare',        lat: -17.82, lon: 31.05  },
    { name: 'Lusaka',        lat: -15.42, lon: 28.28  },

    // ── NORTH AMERICA ────────────────────────────────────────────────────
    { name: 'New York',      lat: 40.71,  lon: -74.01 },
    { name: 'Los Angeles',   lat: 34.05,  lon: -118.24},
    { name: 'Chicago',       lat: 41.85,  lon: -87.65 },
    { name: 'Houston',       lat: 29.76,  lon: -95.37 },
    { name: 'Phoenix',       lat: 33.45,  lon: -112.07},
    { name: 'Philadelphia',  lat: 39.95,  lon: -75.16 },
    { name: 'San Antonio',   lat: 29.42,  lon: -98.49 },
    { name: 'Dallas',        lat: 32.78,  lon: -96.8  },
    { name: 'San Diego',     lat: 32.72,  lon: -117.16},
    { name: 'Seattle',       lat: 47.61,  lon: -122.33},
    { name: 'Denver',        lat: 39.74,  lon: -104.98},
    { name: 'Atlanta',       lat: 33.75,  lon: -84.39 },
    { name: 'Miami',         lat: 25.77,  lon: -80.19 },
    { name: 'Washington DC', lat: 38.91,  lon: -77.04 },
    { name: 'San Francisco', lat: 37.77,  lon: -122.42},
    { name: 'Toronto',       lat: 43.7,   lon: -79.42 },
    { name: 'Montreal',      lat: 45.5,   lon: -73.57 },
    { name: 'Vancouver',     lat: 49.25,  lon: -123.12},
    { name: 'Mexico City',   lat: 19.43,  lon: -99.13 },
    { name: 'Guadalajara',   lat: 20.67,  lon: -103.35},
    { name: 'Monterrey',     lat: 25.67,  lon: -100.31},
    { name: 'Havana',        lat: 23.13,  lon: -82.38 },
    { name: 'Guatemala City',lat: 14.64,  lon: -90.51 },
    { name: 'Bogota',        lat: 4.71,   lon: -74.07 },

    // ── SOUTH AMERICA ────────────────────────────────────────────────────
    { name: 'Sao Paulo',     lat: -23.55, lon: -46.63 },
    { name: 'Rio de Janeiro',lat: -22.91, lon: -43.17 },
    { name: 'Brasilia',      lat: -15.77, lon: -47.93 },
    { name: 'Buenos Aires',  lat: -34.61, lon: -58.37 },
    { name: 'Lima',          lat: -12.05, lon: -77.04 },
    { name: 'Santiago',      lat: -33.46, lon: -70.65 },
    { name: 'Caracas',       lat: 10.49,  lon: -66.88 },
    { name: 'Quito',         lat: -0.23,  lon: -78.52 },
    { name: 'La Paz',        lat: -16.5,  lon: -68.15 },
    { name: 'Montevideo',    lat: -34.86, lon: -56.17 },
    { name: 'Asuncion',      lat: -25.29, lon: -57.64 },
    { name: 'Medellin',      lat: 6.25,   lon: -75.56 },

    // ── REMOTE / STRATEGIC ───────────────────────────────────────────────
    { name: 'Anchorage',     lat: 61.22,  lon: -149.9 },
    { name: 'Honolulu',      lat: 21.31,  lon: -157.82},
    { name: 'Reykjavik',     lat: 64.13,  lon: -21.82 },
    { name: 'Novosibirsk',   lat: 54.99,  lon: 82.9   },
    { name: 'Vladivostok',   lat: 43.12,  lon: 131.89 },
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

    // Batch in groups of 15 — Open-Meteo has no rate limit but be considerate
    const BATCH = 15;
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
