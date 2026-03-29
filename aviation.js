/**
 * aviation.js — ADSB.lol Live Military Aircraft Layer
 * Uses Viewport Culling & LOD to run butter-smooth.
 */

const AVIATION = (() => {

  let leafletMap = null;
  let enabled    = false;
  let intervalId = null;
  const markers  = new Map(); // icao24 → L.circleMarker
  let allAircraft = [];

  const PLANE_SVG = `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/></svg>`;

  function tooltipHtml(ac) {
    const ctryShort = (ac.country || 'UN').trim().slice(0, 2).toUpperCase();
    const altFt = Math.round(ac.altitude * 3.28084).toLocaleString() + ' ft';
    
    return `<div class="tt-inner">
      <div class="tt-hdr">
        <span class="tt-flag">${ctryShort}</span>
        <span class="tt-callsign">${ac.callsign}</span>
      </div>
      <div class="tt-type">AIRCRAFT</div>
      <div class="tt-bot">${ac.callsign} <span style="float:right; color:#e2e8f0; font-weight:700">${altFt}</span></div>
    </div>`;
  }

  function renderVisible() {
    if (!enabled || !leafletMap) return;
    const bounds = leafletMap.getBounds().pad(0.1);
    
    let visible = allAircraft.filter(ac => ac.lat != null && ac.lon != null && bounds.contains([ac.lat, ac.lon]));
    
    // Level of detail limit to prevent 5000+ DOM nodes lagging the Canvas API
    if (visible.length > 1200) {
       const step = visible.length / 1200;
       const sampled = [];
       for (let i = 0; i < visible.length; i += step) sampled.push(visible[Math.floor(i)]);
       visible = sampled.slice(0, 1200);
    }

    const activeIds = new Set();
    const color = '#fb923c'; // MTS Orange reference

    visible.forEach(ac => {
       const id = String(ac.icao24);
       activeIds.add(id);
       
       if (markers.has(id)) {
         const m = markers.get(id);
         m.setLatLng([ac.lat, ac.lon]);
         const el = m.getElement();
         if (el) {
           const inner = el.querySelector('.plane-rot');
           if (inner) inner.style.transform = `rotateZ(${ac.heading}deg)`;
         }
         m.setTooltipContent(tooltipHtml(ac));
       } else {
         const html = `<div class="plane-rot" style="color:${color}; transform: rotateZ(${ac.heading}deg); filter: drop-shadow(0 2px 4px rgba(0,0,0,0.8)); display:flex; align-items:center; justify-content:center; width:100%; height:100%">${PLANE_SVG}</div>`;
         const icon = L.divIcon({ html, className: 'wm-plane-icon', iconSize: [16, 16], iconAnchor: [8, 8] });
         const m = L.marker([ac.lat, ac.lon], { icon, zIndexOffset: -1000 });
         
         m.bindTooltip(tooltipHtml(ac), { direction: 'top', className: 'mts-tooltip', opacity: 1, offset: [0, -8] });
         m.addTo(leafletMap);
         markers.set(id, m);
       }
    });

    markers.forEach((m, id) => {
       if (!activeIds.has(id)) {
          leafletMap.removeLayer(m);
          markers.delete(id);
       }
    });

    const el = document.getElementById('aircraft-count');
    if (el) el.textContent = allAircraft.length.toLocaleString();
  }

  async function fetchAndRender() {
    if (!enabled || !leafletMap) return;
    try {
      const res  = await fetch(`${CONFIG.PROXY_URL}/api/aircraft`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      allAircraft = data.aircraft || [];
      renderVisible();
    } catch (e) {
      console.warn('[Aviation] Fetch error:', e.message);
    }
  }

  function enable(map) {
    leafletMap = map;
    enabled    = true;
    leafletMap.on('moveend', renderVisible);
    fetchAndRender();
    intervalId = setInterval(fetchAndRender, 60000); // 60s respects proxy limits
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
