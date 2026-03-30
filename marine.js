/**
 * marine.js — Live Ship Tracking via Proxy SSE
 * The proxy connects to AISStream WebSocket server-side and streams
 * positions to the browser via SSE — bypassing browser WS key exposure
 * and the AISStream free-tier connection limits.
 *
 * Fallback: proxy /api/ships/snapshot REST poll every 30s
 */

const MARINE = (() => {

  let leafletMap     = null;
  let enabled        = false;
  let evtSource      = null;
  let pollInterval   = null;
  let prunerInterval = null;
  let reconnectTimer = null;
  const markers  = new Map(); // MMSI → L.circleMarker
  const allShips = new Map(); // MMSI → ship data

  const STYLES = {
    military: { color: '#a78bfa', radius: 3.5 },
    tanker:   { color: '#ef4444', radius: 3   },
    other:    { color: '#64748b', radius: 2   },
  };

  function getStyle(cat) { return STYLES[cat] || STYLES.other; }

  function tooltipHtml(ship) {
    const s  = getStyle(ship.cat);
    const kn = (ship.speed || 0).toFixed(1);
    return `<div style="font-family:'JetBrains Mono',monospace;font-size:11px;line-height:1.6">
      <strong style="color:${s.color}">${ship.name || 'Unknown'}</strong><br/>
      MMSI: ${ship.mmsi} &nbsp; <span style="color:${s.color}">${ship.cat}</span><br/>
      Speed: ${kn} kn &nbsp; Hdg: ${(ship.heading || 0).toFixed(0)}°
    </div>`;
  }

  function renderVisible() {
    if (!enabled || !leafletMap) return;
    const bounds = leafletMap.getBounds().pad(0.15);

    let visible = Array.from(allShips.values()).filter(s =>
      s.lat != null && s.lon != null && bounds.contains([s.lat, s.lon])
    );

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
        markers.get(mmsi)
          .setLatLng([ship.lat, ship.lon])
          .setStyle({ color: s.color, fillColor: s.color })
          .setTooltipContent(tooltipHtml(ship));
      } else {
        const m = L.circleMarker([ship.lat, ship.lon], {
          radius: s.radius, color: s.color, fillColor: s.color,
          fillOpacity: 0.9, weight: 0,
        });
        m.bindTooltip(tooltipHtml(ship), { direction: 'top', className: 'wm-tooltip', opacity: 1 });
        m.addTo(leafletMap);
        markers.set(mmsi, m);
      }
    });

    markers.forEach((m, id) => {
      if (!activeIds.has(id)) { leafletMap.removeLayer(m); markers.delete(id); }
    });

    const el = document.getElementById('ship-count');
    if (el) el.textContent = allShips.size.toLocaleString();

    // Prune memory bloat
    if (allShips.size > 6000) {
      const entries = [...allShips.entries()].sort((a, b) => (a[1].ts || 0) - (b[1].ts || 0));
      entries.slice(0, 2000).forEach(([k]) => allShips.delete(k));
    }
  }

  // ── Primary: SSE stream from proxy ─────────────────────────────────
  function connectSSE() {
    if (!enabled) return;
    if (evtSource) { evtSource.close(); evtSource = null; }

    console.log('[Marine] Connecting to proxy SSE…');
    evtSource = new EventSource(`${CONFIG.PROXY_URL}/api/ais/stream`);

    evtSource.onopen = () => {
      console.log('[Marine] SSE connected');
      clearInterval(pollInterval); // SSE is working, stop REST polling
      document.getElementById('marine-status')?.setAttribute('data-status', 'connected');
    };

    evtSource.onmessage = e => {
      if (!enabled) return;
      try {
        const data = JSON.parse(e.data);
        if (data.type === 'snapshot') {
          data.ships.forEach(s => allShips.set(String(s.mmsi), { ...s, ts: Date.now() }));
          renderVisible();
        } else if (data.mmsi) {
          allShips.set(String(data.mmsi), { ...data, ts: Date.now() });
          if (markers.has(String(data.mmsi))) {
            markers.get(String(data.mmsi)).setLatLng([data.lat, data.lon]);
          }
        }
      } catch { /* ignore parse errors */ }
    };

    evtSource.onerror = () => {
      console.warn('[Marine] SSE error — switching to REST poll fallback');
      evtSource?.close();
      evtSource = null;
      document.getElementById('marine-status')?.setAttribute('data-status', 'fallback');
      if (enabled) {
        startRESTFallback();
        // Try reconnecting SSE after 30s
        clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(connectSSE, 30000);
      }
    };
  }

  // ── Fallback: REST snapshot poll from proxy ─────────────────────────
  async function fetchSnapshot() {
    if (!enabled) return;
    try {
      const res  = await fetch(`${CONFIG.PROXY_URL}/api/ships/snapshot`, { signal: AbortSignal.timeout(12000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const ships = await res.json();
      if (Array.isArray(ships)) {
        ships.forEach(s => allShips.set(String(s.mmsi), { ...s, ts: Date.now() }));
        renderVisible();
        console.log(`[Marine] REST snapshot: ${ships.length} ships`);
      }
    } catch (e) {
      console.warn('[Marine] REST snapshot failed:', e.message);
    }
  }

  function startRESTFallback() {
    clearInterval(pollInterval);
    fetchSnapshot();
    pollInterval = setInterval(fetchSnapshot, 30000);
  }

  function enable(map) {
    leafletMap     = map;
    enabled        = true;
    leafletMap.on('moveend', renderVisible);
    connectSSE();
    prunerInterval = setInterval(renderVisible, 3000);
  }

  function disable() {
    enabled = false;
    leafletMap?.off('moveend', renderVisible);
    clearTimeout(reconnectTimer);
    clearInterval(pollInterval);
    clearInterval(prunerInterval);
    evtSource?.close();
    evtSource = null;
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
