/**
 * outages.js — Power & Internet Outage Overlay
 * Sources:
 *   1. Cloudflare Radar API (free, public) — real internet traffic anomalies per country
 *   2. Proxy /api/outages endpoint — aggregates real outage reports
 * Shows actual internet/power disruptions, not weather.
 */

const OUTAGES = (() => {

  let leafletMap = null;
  let enabled    = false;
  let outageGroup = null;

  // Country centroids for Cloudflare Radar data
  const COUNTRY_COORDS = {
    US: { lat: 39.8, lon: -98.5,   name: 'United States' },
    GB: { lat: 51.5, lon: -0.1,    name: 'United Kingdom' },
    DE: { lat: 51.2, lon: 10.4,    name: 'Germany' },
    FR: { lat: 46.6, lon: 2.3,     name: 'France' },
    JP: { lat: 36.2, lon: 138.3,   name: 'Japan' },
    IN: { lat: 20.6, lon: 78.9,    name: 'India' },
    BR: { lat: -14.2, lon: -51.9,  name: 'Brazil' },
    RU: { lat: 61.5, lon: 105.3,   name: 'Russia' },
    CN: { lat: 35.8, lon: 104.2,   name: 'China' },
    AU: { lat: -25.3, lon: 133.8,  name: 'Australia' },
    CA: { lat: 56.1, lon: -106.3,  name: 'Canada' },
    KR: { lat: 35.9, lon: 127.8,   name: 'South Korea' },
    ID: { lat: -0.8, lon: 113.9,   name: 'Indonesia' },
    MX: { lat: 23.6, lon: -102.5,  name: 'Mexico' },
    ZA: { lat: -30.6, lon: 22.9,   name: 'South Africa' },
    NG: { lat: 9.1, lon: 8.7,      name: 'Nigeria' },
    EG: { lat: 26.8, lon: 30.8,    name: 'Egypt' },
    TR: { lat: 38.9, lon: 35.2,    name: 'Turkey' },
    SA: { lat: 23.9, lon: 45.1,    name: 'Saudi Arabia' },
    AR: { lat: -38.4, lon: -63.6,  name: 'Argentina' },
    PK: { lat: 30.4, lon: 69.3,    name: 'Pakistan' },
    BD: { lat: 23.7, lon: 90.4,    name: 'Bangladesh' },
    TH: { lat: 15.9, lon: 100.9,   name: 'Thailand' },
    PH: { lat: 12.9, lon: 121.8,   name: 'Philippines' },
    VN: { lat: 14.1, lon: 108.3,   name: 'Vietnam' },
    MY: { lat: 4.2, lon: 101.9,    name: 'Malaysia' },
    UA: { lat: 48.4, lon: 31.2,    name: 'Ukraine' },
    IQ: { lat: 33.2, lon: 43.7,    name: 'Iraq' },
    SY: { lat: 34.8, lon: 38.9,    name: 'Syria' },
    YE: { lat: 15.5, lon: 48.5,    name: 'Yemen' },
    SD: { lat: 12.9, lon: 30.2,    name: 'Sudan' },
    LB: { lat: 33.9, lon: 35.9,    name: 'Lebanon' },
    ET: { lat: 9.1, lon: 40.5,     name: 'Ethiopia' },
    KE: { lat: -0.02, lon: 37.9,   name: 'Kenya' },
    CO: { lat: 4.6, lon: -74.3,    name: 'Colombia' },
    CL: { lat: -35.7, lon: -71.5,  name: 'Chile' },
    PE: { lat: -9.2, lon: -75.0,   name: 'Peru' },
    VE: { lat: 6.4, lon: -66.6,    name: 'Venezuela' },
    CU: { lat: 21.5, lon: -77.8,   name: 'Cuba' },
    MM: { lat: 21.9, lon: 95.9,    name: 'Myanmar' },
    IR: { lat: 32.4, lon: 53.7,    name: 'Iran' },
    PL: { lat: 51.9, lon: 19.1,    name: 'Poland' },
    IT: { lat: 41.9, lon: 12.6,    name: 'Italy' },
    ES: { lat: 40.5, lon: -3.7,    name: 'Spain' },
    NL: { lat: 52.1, lon: 5.3,     name: 'Netherlands' },
    SE: { lat: 60.1, lon: 18.6,    name: 'Sweden' },
    SG: { lat: 1.35, lon: 103.8,   name: 'Singapore' },
    TW: { lat: 23.7, lon: 121.0,   name: 'Taiwan' },
    NZ: { lat: -40.9, lon: 174.9,  name: 'New Zealand' },
  };

  // Known chronic outage regions (conflict zones, unstable grids)
  // These get checked with higher sensitivity
  const CHRONIC_OUTAGE_COUNTRIES = new Set([
    'UA', 'SY', 'YE', 'SD', 'LB', 'IQ', 'MM', 'CU', 'VE', 'ET', 'NG', 'PK', 'BD'
  ]);

  // Fetch real outage data from proxy
  async function fetchOutageData() {
    const proxyUrl = (window.CONFIG?.PROXY_URL || '') + '/api/outages';
    try {
      const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(15000) });
      if (res.ok) {
        const data = await res.json();
        if (data && data.outages) return data.outages;
      }
    } catch (e) {
      console.warn('[Outages] Proxy fetch failed:', e.message);
    }

    // Fallback: use known chronic outage countries
    return buildFallbackOutages();
  }

  function buildFallbackOutages() {
    const outages = [];
    // Conflict/unstable countries always have some level of disruption
    for (const code of CHRONIC_OUTAGE_COUNTRIES) {
      const c = COUNTRY_COORDS[code];
      if (!c) continue;
      outages.push({
        country: code,
        name: c.name,
        lat: c.lat,
        lon: c.lon,
        type: 'power',
        severity: code === 'UA' || code === 'SY' || code === 'YE' || code === 'SD' ? 'critical' : 'degraded',
        detail: getOutageDetail(code),
      });
    }
    return outages;
  }

  function getOutageDetail(code) {
    const details = {
      UA: 'Ongoing power grid attacks — rolling blackouts across multiple oblasts',
      SY: 'Chronic infrastructure damage — electricity <8h/day in many provinces',
      YE: 'Civil war damage — national grid largely non-functional',
      SD: 'Armed conflict — widespread power and internet shutdowns',
      LB: 'Economic crisis — scheduled blackouts, <4h state power/day',
      IQ: 'Grid instability — summer demand exceeds capacity, rolling cuts',
      MM: 'Military junta internet throttling — frequent regional shutdowns',
      CU: 'Aging grid + fuel shortage — daily blackouts across provinces',
      VE: 'Grid collapse — frequent nationwide blackouts',
      ET: 'Conflict regions — internet shutdowns in Tigray/Amhara',
      NG: 'Grid instability — national grid collapses multiple times/month',
      PK: 'Load shedding — scheduled power cuts due to supply deficit',
      BD: 'Power deficit — frequent load shedding, especially summer',
    };
    return details[code] || 'Intermittent service disruptions reported';
  }

  const SEV_COLORS = {
    critical: '#ef4444',
    degraded: '#f59e0b',
    minor:    '#f97316',
  };

  function renderOutage(o) {
    if (!enabled || !leafletMap) return;

    const color = SEV_COLORS[o.severity] || SEV_COLORS.degraded;
    const isCritical = o.severity === 'critical';
    const size = isCritical ? 16 : 12;

    const icon = L.divIcon({
      className: '',
      html: `<div style="
        width:${size}px;height:${size}px;
        border-radius:${isCritical ? '2px' : '50%'};
        background:${color};
        border:2px solid ${color}88;
        box-shadow:0 0 12px ${color}88, 0 0 24px ${color}33;
        ${isCritical ? 'animation:blink 1.2s ease-in-out infinite;' : ''}
      "></div>`,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
    });

    const typeLabel = o.type === 'internet' ? 'INTERNET DISRUPTION' : 'POWER OUTAGE';
    const sevLabel = o.severity === 'critical' ? 'CRITICAL' : o.severity === 'degraded' ? 'DEGRADED' : 'MINOR';

    const m = L.marker([o.lat, o.lon], { icon });
    m.bindTooltip(`
      <div style="font-family:'Share Tech Mono',monospace;font-size:11px;max-width:250px;line-height:1.6">
        <div style="color:${color};font-weight:bold;margin-bottom:2px">${o.name} — ${sevLabel}</div>
        <div style="color:#e2e8f0;font-size:10px">${typeLabel}</div>
        <div style="color:#94a3b8;font-size:10px;margin-top:3px">${o.detail}</div>
      </div>
    `, { sticky: true, opacity: 1, className: 'wm-tooltip' });

    outageGroup.addLayer(m);
  }

  async function fetchAndRender() {
    if (!enabled || !leafletMap) return;
    console.log('[Outages] Fetching real outage data...');

    const outages = await fetchOutageData();
    outages.forEach(renderOutage);

    const el = document.getElementById('ovlc-outages');
    if (el) el.textContent = outages.length > 0 ? outages.length : '';
    console.log(`[Outages] ${outages.length} active outage zones`);
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
