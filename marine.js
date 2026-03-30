/**
 * marine.js — Live Ship Tracking
 * Primary:  AISStream WebSocket direct from browser (wss://stream.aisstream.io)
 * Fallback: VesselFinder public JSON REST (no key, CORS-proxied via allorigins)
 * Tracks: military (type 35) + tankers (type 80-89)
 */

const MARINE = (() => {

  const AISSTREAM_KEY = '51f6b11dedd877efde399bbefee7080759837543';

  let leafletMap    = null;
  let enabled       = false;
  let ws            = null;
  let reconnectTimer = null;
  let prunerInterval = null;
  const markers  = new Map(); // MMSI → L.circleMarker
  const allShips = new Map(); // MMSI → ship data

  const STYLES = {
    military: { color: '#a78bfa', radius: 3 },
    tanker:   { color: '#ef4444', radius: 2.5 },
    other:    { color: '#64748b', radius: 2 },
  };

  function getStyle(cat) { return STYLES[cat] || STYLES.other; }

  function shipCat(type) {
    if (type === 35)                 return 'military';
    if (type >= 80 && type <= 89)    return 'tanker';
    return 'other';
  }

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

  // ── Primary: AISStream WebSocket (browser-direct) ──────────────────
  function connectAISStream() {
    if (!enabled) return;
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;

    console.log('[Marine] Connecting to AISStream…');
    ws = new WebSocket('wss://stream.aisstream.io/v0/stream');

    ws.onopen = () => {
      console.log('[Marine] AISStream connected');
      ws.send(JSON.stringify({
        APIKey: AISSTREAM_KEY,
        BoundingBoxes: [[[-90, -180], [90, 180]]],
        FilterMessageTypes: ['PositionReport'],
      }));
      document.getElementById('marine-status')?.setAttribute('data-status', 'connected');
    };

    ws.onmessage = e => {
      if (!enabled) return;
      try {
        const msg = JSON.parse(e.data);
        if (!msg.Message?.PositionReport) return;
        const pr   = msg.Message.PositionReport;
        const meta = msg.MetaData || {};
        if (pr.Latitude == null || pr.Longitude == null) return;
        if (Math.abs(pr.Latitude) > 90 || Math.abs(pr.Longitude) > 180) return;

        const type = meta.ShipType || 0;
        const cat  = shipCat(type);
        if (cat === 'other') return; // only military + tankers

        const mmsi = String(meta.MMSI || pr.UserID || 0);
        const ship = {
          mmsi,
          name:    (meta.ShipName || '').trim() || mmsi,
          lat:     pr.Latitude,
          lon:     pr.Longitude,
          heading: pr.TrueHeading !== 511 ? pr.TrueHeading : (pr.CourseOverGround || 0),
          speed:   pr.SpeedOverGround || 0,
          status:  pr.NavigationalStatus,
          type, cat,
          ts:      Date.now(),
        };
        allShips.set(mmsi, ship);

        // Live-update existing marker without waiting for render cycle
        if (markers.has(mmsi)) {
          markers.get(mmsi).setLatLng([ship.lat, ship.lon]);
        }
      } catch { /* ignore parse errors */ }
    };

    ws.onclose = (e) => {
      console.warn(`[Marine] AISStream disconnected (${e.code}), reconnecting in 10s…`);
      ws = null;
      document.getElementById('marine-status')?.setAttribute('data-status', 'disconnected');
      if (enabled) {
        clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(connectAISStream, 10000);
      }
    };

    ws.onerror = () => {
      console.error('[Marine] AISStream WebSocket error — falling back to REST');
      ws?.close();
      if (enabled) fetchVesselFinderFallback();
    };
  }

  // ── Fallback: VesselFinder / VesselTracker public JSON ─────────────
  // Uses the aisstream REST endpoint for a one-shot snapshot if WS fails
  async function fetchVesselFinderFallback() {
    if (!enabled) return;
    console.log('[Marine] Trying AISStream REST fallback…');
    try {
      // Fetch military vessel snapshot via a CORS proxy around a public AIS REST endpoint
      const url = 'https://api.vesselfinder.com/vessels?userkey=demo&mmsi=all';
      // If VesselFinder demo doesn't work, use open aisstream snapshot endpoint
      const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent('https://www.myshiptracking.com/requests/vesselsonmap.php?type=json&minlat=-90&maxlat=90&minlon=-180&maxlon=180&zoom=3')}`;
      const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(15000) });
      if (!res.ok) throw new Error(`REST fallback HTTP ${res.status}`);
      const wrapper = await res.json();
      const data    = JSON.parse(wrapper.contents || '[]');
      const ships   = Array.isArray(data) ? data : (data.vessels || data.data || []);
      ships.slice(0, 2000).forEach(v => {
        const mmsi = String(v.mmsi || v.MMSI || v.id || Math.random());
        const type = parseInt(v.type || v.shiptype || 0);
        const cat  = shipCat(type);
        if (cat === 'other') return;
        allShips.set(mmsi, {
          mmsi, cat, type,
          name:    v.name || v.NAME || mmsi,
          lat:     parseFloat(v.lat || v.LAT),
          lon:     parseFloat(v.lon || v.LON || v.lng),
          heading: parseFloat(v.heading || v.COG || 0),
          speed:   parseFloat(v.speed || v.SOG || 0),
          ts:      Date.now(),
        });
      });
      renderVisible();
    } catch (e) {
      console.error('[Marine] REST fallback failed:', e.message);
    }
  }

  function enable(map) {
    leafletMap     = map;
    enabled        = true;
    leafletMap.on('moveend', renderVisible);
    connectAISStream();
    prunerInterval = setInterval(renderVisible, 3000);
  }

  function disable() {
    enabled = false;
    leafletMap?.off('moveend', renderVisible);
    clearTimeout(reconnectTimer);
    clearInterval(prunerInterval);
    ws?.close();
    ws = null;
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
