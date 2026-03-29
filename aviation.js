/**
 * aviation.js — OpenSky Network Live Aircraft Layer
 * Uses Viewport Culling & LOD to run butter-smooth.
 */

const AVIATION = (() => {

  let leafletMap = null;
  let enabled    = false;
  let intervalId = null;
  const markers  = new Map(); // icao24 → L.circleMarker
  let allAircraft = [];

  const colorFromAlt = alt => {
    if (alt > 10000) return '#22d3ee'; // high
    if (alt > 5000)  return '#60a5fa'; // mid
    if (alt > 1000)  return '#f59e0b'; // low
    return '#ef4444';                  // very low
  };

  function tooltipHtml(ac) {
    const color = colorFromAlt(ac.altitude);
    return `<div style="font-family:'JetBrains Mono',monospace;font-size:11px;line-height:1.6">
      <strong style="color:${color}">${ac.callsign}</strong><br/>
      Alt: ${ac.altitude.toLocaleString()}m &nbsp; ${ac.speed} km/h<br/>
      Hdg: ${ac.heading}° &nbsp; ${ac.country}
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
    visible.forEach(ac => {
       const id = String(ac.icao24);
       activeIds.add(id);
       const color = colorFromAlt(ac.altitude);
       
       if (markers.has(id)) {
         markers.get(id).setLatLng([ac.lat, ac.lon]).setStyle({ color: color, fillColor: color }).setTooltipContent(tooltipHtml(ac));
       } else {
         const m = L.circleMarker([ac.lat, ac.lon], { radius: 2.5, color: color, fillColor: color, fillOpacity: 0.9, weight: 0 });
         m.bindTooltip(tooltipHtml(ac), { direction: 'top', className: 'wm-tooltip', opacity: 1 });
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
