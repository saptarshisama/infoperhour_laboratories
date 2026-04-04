/**
 * map.js v2 — Leaflet Map + Multi-Layer Marker System
 */

const MAP = (() => {

  let leafletMap  = null;
  let evtLayer    = null;   // event markers
  const CATS      = EVENTS.getCategories();

  // ── Init ─────────────────────────────────────────────────────────────
  function init() {
    leafletMap = L.map('map', {
      center: [20, 12], zoom: 2.2, minZoom: 1.5, maxZoom: 12,
      zoomControl: true, attributionControl: false, worldCopyJump: false,
      preferCanvas: true
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_matter_nolabels/{z}/{x}/{y}.png', {
      subdomains: 'abcd', maxZoom: 20,
      attribution: '© CARTO'
    }).addTo(leafletMap);

    evtLayer = L.layerGroup().addTo(leafletMap);

    // Coordinate display
    leafletMap.on('mousemove', e => {
      const el = document.getElementById('map-coords');
      if (el) el.textContent = `${e.latlng.lat.toFixed(4)}°N  ${e.latlng.lng.toFixed(4)}°E`;
    });

    // Reset button
    document.getElementById('reset-btn')?.addEventListener('click', () => {
      leafletMap.flyTo([20, 12], 2.2, { duration: 1.2 });
    });

    // Popup close
    document.getElementById('ev-popup-close')?.addEventListener('click', closePopup);
    document.getElementById('ev-popup')?.addEventListener('click', e => {
      if (e.target.id === 'ev-popup') closePopup();
    });

    return leafletMap;
  }

  // ── Render event markers ─────────────────────────────────────────────
  function render(events, filter) {
    evtLayer.clearLayers();

    const filtered = events.filter(e => {
      const catOk = !filter || filter.cat === 'all' || e.category === filter.cat;
      const sevOk = !filter || filter.sev === 'all' || e.severity === parseInt(filter.sev);
      return catOk && sevOk && e.lat != null && e.lon != null;
    });

    filtered.forEach(ev => {
      const cat    = CATS[ev.category] || CATS.political;
      const radius = 4 + ev.severity * 2.2;
      const icon   = L.divIcon({
        className: '',
        html: `<div class="marker-wrap" style="--c:${cat.color};--g:${cat.glow}">
          <div class="marker-core" style="width:${radius*2}px;height:${radius*2}px;background:var(--c);box-shadow:0 0 10px var(--g)"></div>
          <div class="mring mring1" style="border-color:var(--c)"></div>
          <div class="mring mring2" style="border-color:var(--c)"></div>
        </div>`,
        iconSize:   [radius * 2 + 44, radius * 2 + 44],
        iconAnchor: [radius + 22, radius + 22],
      });

      const marker = L.marker([ev.lat, ev.lon], { icon });

      marker.bindTooltip(
        `<div style="font-family:'JetBrains Mono',monospace;font-size:11px;max-width:200px;line-height:1.5">
          <strong style="color:${cat.color}">${cat.label}</strong><br/>
          ${ev.headline.slice(0, 58)}${ev.headline.length > 58 ? '…' : ''}<br/>
          <span style="color:#64748b;font-size:10px">${ev.location} · S${ev.severity}</span>
        </div>`,
        { direction: 'top', offset: [0, -(radius + 22)], opacity: 1, className: 'wm-tooltip' }
      );

      marker.on('click', () => showPopup(ev));
      evtLayer.addLayer(marker);
    });

    // Update overlay count
    const el = document.getElementById('ovlc-events');
    if (el) el.textContent = filtered.length;
  }

  // ── Event Popup ──────────────────────────────────────────────────────
  function showPopup(ev) {
    const cat = CATS[ev.category] || CATS.political;
    document.getElementById('ev-popup-badge').textContent = cat.label;
    document.getElementById('ev-popup-badge').style.color = cat.color;
    document.getElementById('ev-popup-badge').style.background = cat.color + '18';
    document.getElementById('ev-popup-title').textContent = ev.headline;
    document.getElementById('ev-popup-meta').innerHTML =
      `<span>📍 ${ev.location}</span><span>⚠ S${ev.severity}</span><span>📡 ${ev.source}</span><span>🕒 ${EVENTS.timeAgoFn(ev.time)}</span>`;
    document.getElementById('ev-popup-desc').textContent = ev.description || '';
    const link = document.getElementById('ev-popup-link');
    link.href = ev.url || '#';
    link.style.display = ev.url && ev.url !== '#' ? '' : 'none';
    document.getElementById('ev-popup').style.display = 'flex';

    if (ev.lat && ev.lon) leafletMap.flyTo([ev.lat, ev.lon], 5, { duration: 1.4 });
  }

  function closePopup() {
    document.getElementById('ev-popup').style.display = 'none';
  }

  function getMap() { return leafletMap; }

  // Inject marker CSS
  const style = document.createElement('style');
  style.textContent = `
    .leaflet-div-icon { background: none !important; border: none !important; }
    .marker-wrap { position: relative; display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; }
    .marker-core { border-radius: 50%; position: relative; z-index: 2; flex-shrink: 0; }
    .mring { position: absolute; border-radius: 50%; border: 1.5px solid; left: 50%; top: 50%; opacity: 0; transform: translate(-50%,-50%) scale(.4); pointer-events: none; }
    .mring1 { width: 20px; height: 20px; animation: ring-out 2.6s ease-out infinite; }
    .mring2 { width: 36px; height: 36px; animation: ring-out 2.6s ease-out .9s infinite; }
    @keyframes ring-out { 0%{transform:translate(-50%,-50%) scale(.4);opacity:.8} 100%{transform:translate(-50%,-50%) scale(1);opacity:0} }
    .wm-tooltip.leaflet-tooltip { background: rgba(9,13,26,.97) !important; border: 1px solid rgba(255,255,255,.09) !important; border-radius: 6px !important; padding: 6px 10px !important; box-shadow: 0 4px 20px rgba(0,0,0,.7) !important; }
    .wm-tooltip.leaflet-tooltip-top::before { border-top-color: rgba(255,255,255,.07) !important; }
  `;
  document.head.appendChild(style);

  return { init, render, showPopup, closePopup, getMap };
})();
