/**
 * marine.js — AISStream Live Ship Tracking via Proxy SSE
 * Uses Viewport Culling & LOD to run butter-smooth.
 */

const MARINE = (() => {

  let leafletMap = null;
  let enabled    = false;
  let evtSource  = null;
  const markers  = new Map(); // MMSI → L.circleMarker
  const allShips = new Map();

  const SHIP_STYLES = {
    military:  { color: '#a78bfa' }, 
    tanker:    { color: '#ef4444' }, 
    other:     { color: '#64748b' }, 
  };

  function getStyle(cat) { return SHIP_STYLES[cat] || SHIP_STYLES.other; }

  function tooltipHtml(ship) {
    const s = getStyle(ship.cat);
    const kn = (ship.speed || 0).toFixed(1);
    return `<div style="font-family:'JetBrains Mono',monospace;font-size:11px;line-height:1.6">
      <strong style="color:${s.color}">${ship.name || 'Unknown'}</strong><br/>
      MMSI: ${ship.mmsi} &nbsp; ${ship.cat}<br/>
      Speed: ${kn} kn &nbsp; Hdg: ${(ship.heading||0).toFixed(0)}°
    </div>`;
  }

  function renderVisible() {
    if (!enabled || !leafletMap) return;
    const bounds = leafletMap.getBounds().pad(0.1);
    
    const shipsArr = Array.from(allShips.values());
    let visible = shipsArr.filter(s => s.lat != null && s.lon != null && bounds.contains([s.lat, s.lon]));
    
    // LOD threshold
    if (visible.length > 1200) {
       const step = visible.length / 1200;
       const sampled = [];
       for (let i = 0; i < visible.length; i += step) sampled.push(visible[Math.floor(i)]);
       visible = sampled.slice(0, 1200);
    }

    const activeIds = new Set();
    visible.forEach(ship => {
       const mmsi = String(ship.mmsi);
       activeIds.add(mmsi);
       const s = getStyle(ship.cat);

       if (markers.has(mmsi)) {
         markers.get(mmsi).setLatLng([ship.lat, ship.lon]).setStyle({ color: s.color, fillColor: s.color }).setTooltipContent(tooltipHtml(ship));
       } else {
         const m = L.circleMarker([ship.lat, ship.lon], { radius: 2.2, color: s.color, fillColor: s.color, fillOpacity: 0.9, weight: 0 });
         m.bindTooltip(tooltipHtml(ship), { direction: 'top', className: 'wm-tooltip', opacity: 1 });
         m.addTo(leafletMap);
         markers.set(mmsi, m);
       }
    });

    // Remove pruned / out of bounds markers
    markers.forEach((m, id) => {
       if (!activeIds.has(id)) {
          leafletMap.removeLayer(m);
          markers.delete(id);
       }
    });

    const el = document.getElementById('ship-count');
    if (el) el.textContent = allShips.size.toLocaleString();
    
    // periodically prune allShips memory to avoid extreme bloat over hours
    if (allShips.size > 5000) {
       const keys = Array.from(allShips.keys());
       for(let i=0; i < keys.length - 3000; i++) allShips.delete(keys[i]);
    }
  }

  function connectSSE() {
    if (!enabled) return;

    evtSource = new EventSource(`${CONFIG.PROXY_URL}/api/ais/stream`);

    evtSource.onopen = () => {
      console.log('[Marine] SSE connected');
      document.getElementById('marine-status')?.setAttribute('data-status', 'connected');
    };

    evtSource.onmessage = e => {
      if (!enabled || !leafletMap) return;
      try {
        const data = JSON.parse(e.data);
        if (data.type === 'snapshot') {
          data.ships.forEach(s => allShips.set(String(s.mmsi), s));
          renderVisible();
        } else {
          allShips.set(String(data.mmsi), data);
          // If marker is already on screen, update smoothly live without waiting for render cycle
          if (markers.has(String(data.mmsi))) {
             markers.get(String(data.mmsi)).setLatLng([data.lat, data.lon]);
          }
        }
      } catch { /* ignore */ }
    };

    evtSource.onerror = () => {
      console.warn('[Marine] SSE error, reconnecting in 8s…');
      evtSource?.close();
      evtSource = null;
      if (enabled) setTimeout(connectSSE, 8000);
    };
  }

  let prunerInterval = null;

  function enable(map) {
    leafletMap = map;
    enabled    = true;
    leafletMap.on('moveend', renderVisible);
    connectSSE();
    prunerInterval = setInterval(renderVisible, 2500);
  }

  function disable() {
    enabled = false;
    leafletMap?.off('moveend', renderVisible);
    evtSource?.close();
    evtSource = null;
    clearInterval(prunerInterval);
    markers.forEach(m => leafletMap?.removeLayer(m));
    markers.clear();
    allShips.clear();
    const el = document.getElementById('ship-count');
    if (el) el.textContent = '—';
  }

  function toggle(map) {
    if (enabled) disable(); else enable(map);
    return enabled;
  }

  return { enable, disable, toggle };
})();
