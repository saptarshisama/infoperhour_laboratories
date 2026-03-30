/**
 * aviation.js — Live Military Aircraft Layer
 * Primary:  adsb.lol /v2/mil  (public, CORS-enabled, no key)
 * Fallback: opensky-network.org all states (public, no key)
 * Fetches directly from browser — no proxy dependency.
 */

const AVIATION = (() => {

  let leafletMap = null;
  let enabled    = false;
  let intervalId = null;
  const markers  = new Map(); // icao24 → L.marker
  let allAircraft = [];

  const PLANE_SVG = `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/></svg>`;

  // Color by altitude band (matches overlay legend)
  function altColor(altM) {
    if (altM == null || altM < 0) return '#fb923c';
    if (altM >= 10000) return '#22d3ee'; // high >10km
    if (altM >= 5000)  return '#60a5fa'; // mid 5-10km
    if (altM >= 1000)  return '#f59e0b'; // low 1-5km
    return '#ef4444';                    // <1km
  }

  function tooltipHtml(ac) {
    const altFt = ac.altitude != null ? Math.round(ac.altitude * 3.28084).toLocaleString() + ' ft' : 'N/A';
    const spd   = ac.speed    != null ? Math.round(ac.speed) + ' km/h' : 'N/A';
    return `<div class="tt-inner">
      <div class="tt-hdr">
        <span class="tt-callsign">${ac.callsign || ac.icao24}</span>
        <span class="tt-type" style="float:right;font-size:9px;color:#94a3b8">${ac.country || 'MIL'}</span>
      </div>
      <div class="tt-bot">
        Alt: ${altFt} &nbsp;|&nbsp; Spd: ${spd}<br/>
        Hdg: ${ac.heading != null ? Math.round(ac.heading) + '°' : 'N/A'}
      </div>
    </div>`;
  }

  function renderVisible() {
    if (!enabled || !leafletMap) return;
    const bounds = leafletMap.getBounds().pad(0.15);

    let visible = allAircraft.filter(ac =>
      ac.lat != null && ac.lon != null && bounds.contains([ac.lat, ac.lon])
    );

    // LOD cap to keep DOM snappy
    if (visible.length > 1000) {
      const step = visible.length / 1000;
      const sampled = [];
      for (let i = 0; i < visible.length; i += step) sampled.push(visible[Math.floor(i)]);
      visible = sampled.slice(0, 1000);
    }

    const activeIds = new Set();

    visible.forEach(ac => {
      const id    = String(ac.icao24);
      const color = altColor(ac.altitude);
      activeIds.add(id);

      if (markers.has(id)) {
        const m  = markers.get(id);
        m.setLatLng([ac.lat, ac.lon]);
        // Update rotation + color on existing icon element
        const el = m.getElement();
        if (el) {
          const rot = el.querySelector('.plane-rot');
          if (rot) {
            rot.style.transform = `rotateZ(${ac.heading || 0}deg)`;
            rot.style.color     = color;
          }
        }
        m.setTooltipContent(tooltipHtml(ac));
      } else {
        const html = `<div class="plane-rot" style="color:${color};transform:rotateZ(${ac.heading || 0}deg);filter:drop-shadow(0 2px 4px rgba(0,0,0,0.8));display:flex;align-items:center;justify-content:center;width:100%;height:100%">${PLANE_SVG}</div>`;
        const icon = L.divIcon({ html, className: 'wm-plane-icon', iconSize: [16, 16], iconAnchor: [8, 8] });
        const m    = L.marker([ac.lat, ac.lon], { icon, zIndexOffset: -1000 });
        m.bindTooltip(tooltipHtml(ac), { direction: 'top', className: 'mts-tooltip', opacity: 1, offset: [0, -8] });
        m.addTo(leafletMap);
        markers.set(id, m);
      }
    });

    // Remove off-screen / stale markers
    markers.forEach((m, id) => {
      if (!activeIds.has(id)) {
        leafletMap.removeLayer(m);
        markers.delete(id);
      }
    });

    const el = document.getElementById('aircraft-count');
    if (el) el.textContent = allAircraft.length.toLocaleString();
  }

  // ── Primary: adsb.lol military feed (public, no auth, CORS OK) ──────
  async function fetchAdsbLol() {
    const res  = await fetch('https://api.adsb.lol/v2/mil', { signal: AbortSignal.timeout(12000) });
    if (!res.ok) throw new Error(`adsb.lol HTTP ${res.status}`);
    const data = await res.json();
    const raw  = data.ac || [];
    return raw
      .filter(s => s.lat != null && s.lon != null)
      .map(s => ({
        icao24:   s.hex  || '',
        callsign: (s.flight || s.hex || '').trim(),
        country:  s.ownOp || 'Military',
        lat:      s.lat,
        lon:      s.lon,
        altitude: (s.alt_geom ?? s.alt_baro ?? null) != null
                    ? (s.alt_geom ?? s.alt_baro) * 0.3048 // ft → m
                    : null,
        speed:    s.gs != null ? s.gs * 1.852 : null,     // kn → km/h
        heading:  s.track ?? null,
      }));
  }

  // ── Fallback: OpenSky all states (public, no auth needed for global snapshot) ──
  async function fetchOpenSkyFallback() {
    const res  = await fetch('https://opensky-network.org/api/states/all', { signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`OpenSky HTTP ${res.status}`);
    const data = await res.json();
    const states = data.states || [];
    // OpenSky has no military filter on public endpoint — take first 500 airborne
    return states
      .filter(s => s[5] != null && s[6] != null && !s[8]) // has lat/lon, not on ground
      .slice(0, 500)
      .map(s => ({
        icao24:   s[0] || '',
        callsign: (s[1] || '').trim() || s[0],
        country:  s[2] || '',
        lat:      s[6],
        lon:      s[5],
        altitude: s[13] != null ? s[13] : (s[7] || null),  // geo alt, fallback baro
        speed:    s[9]  != null ? s[9] * 3.6 : null,       // m/s → km/h
        heading:  s[10] ?? null,
      }));
  }

  async function fetchAndRender() {
    if (!enabled || !leafletMap) return;
    try {
      allAircraft = await fetchAdsbLol();
      console.log(`[Aviation] adsb.lol: ${allAircraft.length} military aircraft`);
    } catch (e1) {
      console.warn('[Aviation] adsb.lol failed, trying OpenSky fallback:', e1.message);
      try {
        allAircraft = await fetchOpenSkyFallback();
        console.log(`[Aviation] OpenSky fallback: ${allAircraft.length} aircraft`);
      } catch (e2) {
        console.error('[Aviation] Both sources failed:', e2.message);
        return;
      }
    }
    renderVisible();
  }

  function enable(map) {
    leafletMap = map;
    enabled    = true;
    leafletMap.on('moveend', renderVisible);
    fetchAndRender();
    intervalId = setInterval(fetchAndRender, 60000);
  }

  function disable() {
    enabled = false;
    leafletMap?.off('moveend', renderVisible);
    clearInterval(intervalId);
    markers.forEach(m => leafletMap?.removeLayer(m));
    markers.clear();
    allAircraft = [];
    const el = document.getElementById('aircraft-count');
    if (el) el.textContent = '—';
  }

  function toggle(map) {
    if (enabled) disable(); else enable(map);
    return enabled;
  }

  return { enable, disable, toggle };
})();
