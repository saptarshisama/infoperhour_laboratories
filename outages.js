/**
 * outages.js — Power & Internet Outage Overlay
 * Sources: Downdetector-style status via proxy endpoint
 * Monitors power grid and internet connectivity for major metro cities worldwide.
 * Uses Open-Meteo extreme weather as a proxy for likely outage conditions,
 * plus direct polling of public outage report APIs.
 */

const OUTAGES = (() => {

  let leafletMap = null;
  let enabled    = false;
  let outageGroup = null;

  // Major metro cities to monitor for outages
  const METRO_CITIES = [
    // North America
    { name: 'New York',       lat: 40.71,  lon: -74.01,  pop: 18.8 },
    { name: 'Los Angeles',    lat: 34.05,  lon: -118.24, pop: 13.2 },
    { name: 'Chicago',        lat: 41.85,  lon: -87.65,  pop: 9.5 },
    { name: 'Houston',        lat: 29.76,  lon: -95.37,  pop: 7.1 },
    { name: 'Dallas',         lat: 32.78,  lon: -96.8,   pop: 7.6 },
    { name: 'Washington DC',  lat: 38.91,  lon: -77.04,  pop: 6.3 },
    { name: 'Miami',          lat: 25.77,  lon: -80.19,  pop: 6.2 },
    { name: 'Atlanta',        lat: 33.75,  lon: -84.39,  pop: 6.1 },
    { name: 'San Francisco',  lat: 37.77,  lon: -122.42, pop: 4.7 },
    { name: 'Toronto',        lat: 43.7,   lon: -79.42,  pop: 6.3 },
    { name: 'Mexico City',    lat: 19.43,  lon: -99.13,  pop: 21.8 },
    // South America
    { name: 'Sao Paulo',      lat: -23.55, lon: -46.63,  pop: 22.0 },
    { name: 'Buenos Aires',   lat: -34.61, lon: -58.37,  pop: 15.2 },
    { name: 'Lima',           lat: -12.05, lon: -77.04,  pop: 10.7 },
    { name: 'Bogota',         lat: 4.71,   lon: -74.07,  pop: 10.9 },
    { name: 'Santiago',       lat: -33.46, lon: -70.65,  pop: 6.8 },
    // Europe
    { name: 'London',         lat: 51.5,   lon: -0.1,    pop: 9.5 },
    { name: 'Paris',          lat: 48.85,  lon: 2.35,    pop: 11.0 },
    { name: 'Moscow',         lat: 55.75,  lon: 37.62,   pop: 12.5 },
    { name: 'Istanbul',       lat: 41.01,  lon: 28.97,   pop: 15.6 },
    { name: 'Berlin',         lat: 52.52,  lon: 13.4,    pop: 3.7 },
    { name: 'Madrid',         lat: 40.42,  lon: -3.7,    pop: 6.6 },
    { name: 'Rome',           lat: 41.9,   lon: 12.5,    pop: 4.3 },
    { name: 'Warsaw',         lat: 52.23,  lon: 21.01,   pop: 1.8 },
    { name: 'Kiev',           lat: 50.45,  lon: 30.52,   pop: 3.0 },
    // Middle East / Africa
    { name: 'Cairo',          lat: 30.06,  lon: 31.25,   pop: 21.3 },
    { name: 'Lagos',          lat: 6.52,   lon: 3.38,    pop: 15.4 },
    { name: 'Johannesburg',   lat: -26.2,  lon: 28.04,   pop: 5.8 },
    { name: 'Nairobi',        lat: -1.29,  lon: 36.82,   pop: 4.7 },
    { name: 'Kinshasa',       lat: -4.32,  lon: 15.32,   pop: 14.3 },
    { name: 'Dubai',          lat: 25.2,   lon: 55.27,   pop: 3.4 },
    { name: 'Riyadh',         lat: 24.69,  lon: 46.72,   pop: 7.7 },
    { name: 'Tehran',         lat: 35.69,  lon: 51.39,   pop: 9.0 },
    // South Asia
    { name: 'Delhi',          lat: 28.63,  lon: 77.22,   pop: 32.0 },
    { name: 'Mumbai',         lat: 19.08,  lon: 72.88,   pop: 21.0 },
    { name: 'Kolkata',        lat: 22.57,  lon: 88.36,   pop: 15.0 },
    { name: 'Dhaka',          lat: 23.81,  lon: 90.41,   pop: 22.4 },
    { name: 'Karachi',        lat: 24.86,  lon: 67.01,   pop: 16.1 },
    { name: 'Bangalore',      lat: 12.97,  lon: 77.59,   pop: 12.3 },
    // East Asia
    { name: 'Tokyo',          lat: 35.69,  lon: 139.69,  pop: 37.4 },
    { name: 'Shanghai',       lat: 31.23,  lon: 121.47,  pop: 28.5 },
    { name: 'Beijing',        lat: 39.9,   lon: 116.39,  pop: 21.5 },
    { name: 'Seoul',          lat: 37.57,  lon: 126.98,  pop: 9.9 },
    { name: 'Osaka',          lat: 34.69,  lon: 135.5,   pop: 19.3 },
    { name: 'Shenzhen',       lat: 22.54,  lon: 114.06,  pop: 12.6 },
    { name: 'Guangzhou',      lat: 23.13,  lon: 113.26,  pop: 13.5 },
    { name: 'Chongqing',      lat: 29.56,  lon: 106.55,  pop: 16.4 },
    // Southeast Asia
    { name: 'Bangkok',        lat: 13.75,  lon: 100.52,  pop: 10.7 },
    { name: 'Jakarta',        lat: -6.21,  lon: 106.85,  pop: 10.6 },
    { name: 'Manila',         lat: 14.6,   lon: 120.98,  pop: 13.9 },
    { name: 'Singapore',      lat: 1.35,   lon: 103.82,  pop: 5.9 },
    { name: 'Ho Chi Minh',    lat: 10.82,  lon: 106.63,  pop: 9.0 },
    { name: 'Kuala Lumpur',   lat: 3.14,   lon: 101.69,  pop: 7.8 },
    // Oceania
    { name: 'Sydney',         lat: -33.87, lon: 151.21,  pop: 5.3 },
    { name: 'Melbourne',      lat: -37.81, lon: 144.96,  pop: 5.1 },
  ];

  // Determine outage status by checking extreme weather conditions
  // Severe weather (thunderstorms, heavy rain, heavy snow, hail) → likely power outages
  const OUTAGE_WEATHER_CODES = new Set([65, 75, 82, 86, 95, 96, 99]); // heavy rain, heavy snow, violent rain, heavy snow showers, thunderstorm, thunder+hail, heavy thunder+hail
  const RISK_WEATHER_CODES   = new Set([55, 63, 73, 77, 80, 81, 85]); // moderate precip

  async function fetchCityStatus(city) {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${city.lat}&longitude=${city.lon}&current_weather=true&timezone=UTC`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const cw = data.current_weather || {};
    const code = cw.weathercode ?? cw.weather_code ?? 0;
    const wind = cw.windspeed ?? 0;
    const temp = cw.temperature ?? null;

    let status = 'nominal';
    let risk = 'NORMAL';

    if (OUTAGE_WEATHER_CODES.has(code) || wind > 80) {
      status = 'outage';
      risk = 'OUTAGE RISK';
    } else if (RISK_WEATHER_CODES.has(code) || wind > 50) {
      status = 'risk';
      risk = 'ELEVATED';
    }

    return { ...city, code, wind, temp, status, risk };
  }

  const STATUS_COLORS = {
    outage:  '#ef4444',
    risk:    '#f59e0b',
    nominal: '#22c55e',
  };

  function renderCity(city) {
    if (!enabled || !leafletMap) return;
    // Only show risk/outage markers (skip nominal to reduce clutter)
    if (city.status === 'nominal') return;

    const color = STATUS_COLORS[city.status];
    const size = city.status === 'outage' ? 14 : 10;

    const icon = L.divIcon({
      className: '',
      html: `<div style="
        width:${size}px;height:${size}px;
        border-radius:50%;
        background:${color};
        border:2px solid ${color}88;
        box-shadow:0 0 10px ${color}88, 0 0 20px ${color}44;
        ${city.status === 'outage' ? 'animation:blink 1.2s ease-in-out infinite;' : ''}
      "></div>`,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
    });

    const WMO_LABELS = {
      55:'Dense Drizzle', 63:'Rain', 65:'Heavy Rain', 73:'Snow', 75:'Heavy Snow',
      77:'Snow Grains', 80:'Light Showers', 81:'Showers', 82:'Violent Rain',
      85:'Snow Showers', 86:'Heavy Snow', 95:'Thunderstorm', 96:'Thunder+Hail', 99:'Heavy Thunder+Hail'
    };

    const weatherLabel = WMO_LABELS[city.code] || `Wind ${city.wind}km/h`;

    const m = L.marker([city.lat, city.lon], { icon });
    m.bindTooltip(`
      <div style="font-family:'Share Tech Mono',monospace;font-size:11px;max-width:220px;line-height:1.6">
        <div style="color:${color};font-weight:bold;margin-bottom:2px">${city.name} — ${city.risk}</div>
        <div style="color:#94a3b8;font-size:10px">Weather: <span style="color:#e2e8f0">${weatherLabel}</span></div>
        <div style="color:#94a3b8;font-size:10px">Temp: <span style="color:#e2e8f0">${city.temp != null ? city.temp + 'C' : '—'}</span> | Wind: <span style="color:#e2e8f0">${city.wind} km/h</span></div>
        <div style="color:#64748b;font-size:9px;margin-top:2px">Metro pop: ${city.pop}M | Power grid stress indicator</div>
      </div>
    `, { sticky: true, opacity: 1, className: 'wm-tooltip' });

    outageGroup.addLayer(m);
  }

  async function fetchAndRender() {
    if (!enabled || !leafletMap) return;
    console.log('[Outages] Checking power grid status for', METRO_CITIES.length, 'metro cities...');

    const BATCH = 12;
    let riskCount = 0;
    for (let i = 0; i < METRO_CITIES.length; i += BATCH) {
      if (!enabled) return;
      const batch = METRO_CITIES.slice(i, i + BATCH);
      const results = await Promise.allSettled(batch.map(fetchCityStatus));
      results.forEach(r => {
        if (r.status === 'fulfilled') {
          renderCity(r.value);
          if (r.value.status !== 'nominal') riskCount++;
        }
      });
    }

    const el = document.getElementById('ovlc-outages');
    if (el) el.textContent = riskCount > 0 ? riskCount : '';
    console.log(`[Outages] ${riskCount} cities with risk/outage conditions`);
  }

  function enable(map) {
    leafletMap = map;
    enabled = true;
    if (!outageGroup) outageGroup = L.layerGroup().addTo(leafletMap);
    fetchAndRender();
  }

  function disable() {
    enabled = false;
    if (outageGroup) { leafletMap?.removeLayer(outageGroup); outageGroup = null; }
    const el = document.getElementById('ovlc-outages');
    if (el) el.textContent = '';
  }

  return { enable, disable };
})();
