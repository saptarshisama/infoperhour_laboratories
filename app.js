/**
 * app.js v3 — Main Orchestrator
 * Sci-fi HUD: events, news, aviation, marine, weather, cables, datacenters
 * Severity: only S4/S5 shows RED ALERT badge — no other sev labels
 */

(async () => {

  const state = { cat: 'all', ncat: 'all', tab: 'news' };
  const CATS  = EVENTS.getCategories();

  const $ = id => document.getElementById(id);
  const escHtml = s => (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

  // ── UTC Clock ─────────────────────────────────────────────────────────
  setInterval(() => {
    const n = new Date();
    const p = v => String(v).padStart(2,'0');
    const el = $('utc-clock');
    if (el) el.textContent = `${p(n.getUTCHours())}:${p(n.getUTCMinutes())}:${p(n.getUTCSeconds())}`;
  }, 1000);

  // ── Map init ──────────────────────────────────────────────────────────
  const leafletMap = MAP.init();

  // Wake proxy (Render free tier may be sleeping)
  fetch(`${CONFIG.PROXY_URL}/health`).catch(() => {});

  // ── Chat ──────────────────────────────────────────────────────────────
  CHAT.init();

  // ── Pizza Index ───────────────────────────────────────────────────────
  PIZZA.init();

  // ── Tab switching ─────────────────────────────────────────────────────
  document.querySelectorAll('.ptab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.ptab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.tab = btn.dataset.tab;
      $('events-filters').style.display = state.tab === 'events' ? '' : 'none';
      $('news-filters').style.display    = state.tab === 'news'   ? '' : 'none';
      $('events-feed').style.display     = state.tab === 'events' ? '' : 'none';
      $('news-feed').style.display       = state.tab === 'news'   ? '' : 'none';
    });
  });

  // ── Event category filters ────────────────────────────────────────────
  document.querySelectorAll('[data-cat]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-cat]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.cat = btn.dataset.cat;
      renderEvents();
    });
  });

  // ── News category filters ─────────────────────────────────────────────
  document.querySelectorAll('[data-ncat]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-ncat]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.ncat = btn.dataset.ncat;
      renderNews();
    });
  });

  // ── Overlay toggles ───────────────────────────────────────────────────
  $('tog-events')?.addEventListener('change', e => {
    if (e.target.checked) renderEvents(); else MAP.render([], state);
  });
  $('tog-quakes')?.addEventListener('change', () => renderEvents());
  $('tog-aviation')?.addEventListener('change', e => {
    if (e.target.checked) AVIATION.enable(leafletMap); else AVIATION.disable();
    $('ovlc-aviation').textContent = e.target.checked ? ($('aircraft-count')?.textContent || '…') : '—';
  });
  $('tog-marine')?.addEventListener('change', e => {
    if (e.target.checked) MARINE.enable(leafletMap); else MARINE.disable();
    $('ovlc-marine').textContent = e.target.checked ? ($('ship-count')?.textContent || '…') : '—';
  });
  $('tog-weather')?.addEventListener('change', e => {
    if (e.target.checked) WEATHER.enable(leafletMap); else WEATHER.disable();
  });
  $('tog-outages')?.addEventListener('change', e => {
    if (e.target.checked) OUTAGES.enable(leafletMap); else OUTAGES.disable();
  });
  $('tog-cables')?.addEventListener('change', e => {
    if (e.target.checked) CABLES.enable(leafletMap); else CABLES.disable();
    const ovl = $('ovlc-cables');
    if (ovl) ovl.textContent = e.target.checked ? CABLES.count() : '';
  });
  $('tog-datacenters')?.addEventListener('change', e => {
    if (e.target.checked) DATACENTERS.enable(leafletMap); else DATACENTERS.disable();
    const ovl = $('ovlc-datacenters');
    if (ovl) ovl.textContent = e.target.checked ? DATACENTERS.count() : '';
  });
  $('tog-refineries')?.addEventListener('change', e => {
    if (e.target.checked) REFINERIES.enable(leafletMap); else REFINERIES.disable();
    const ovl = $('ovlc-refineries');
    if (ovl) ovl.textContent = e.target.checked ? REFINERIES.count() : '';
  });
  // View Mode section collapse
  $('viewmode-hdr')?.addEventListener('click', () => {
    const body  = $('viewmode-body');
    const arrow = $('viewmode-arrow');
    body.classList.toggle('hidden');
    if (arrow) arrow.textContent = body.classList.contains('hidden') ? '▶' : '▼';
  });

  // Dark / Light theme toggle
  $('theme-dark')?.addEventListener('click', () => {
    document.body.classList.remove('theme-light');
    $('theme-dark').classList.add('active');
    $('theme-light').classList.remove('active');
  });
  $('theme-light')?.addEventListener('click', () => {
    document.body.classList.add('theme-light');
    $('theme-light').classList.add('active');
    $('theme-dark').classList.remove('active');
  });

  // ── 3D Globe / Flat Map toggle ────────────────────────────────────────
  let globeInstance = null;

  function initGlobe() {
    const container = $('globe-container');
    if (!container || typeof Globe === 'undefined') return;

    // Destroy old instance if re-initializing
    if (globeInstance) {
      container.innerHTML = '';
      globeInstance = null;
    }

    const w = container.clientWidth || 800;
    const h = container.clientHeight || 600;

    globeInstance = Globe()(container)
      .width(w)
      .height(h)
      .globeImageUrl('https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-dark.jpg')
      .bumpImageUrl('https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-topology.png')
      .backgroundColor('#080c14')
      .showAtmosphere(true)
      .atmosphereColor('#0af0c0')
      .atmosphereAltitude(0.15)
      .showGraticules(true);

    // Plot current events as coloured points
    updateGlobePoints();

    // Handle resize
    window.addEventListener('resize', () => {
      if (globeInstance && $('globe-container').style.display !== 'none') {
        globeInstance.width(container.clientWidth).height(container.clientHeight);
      }
    });

    // Auto-rotate slowly
    globeInstance.controls().autoRotate = true;
    globeInstance.controls().autoRotateSpeed = 0.4;

    // Set initial view to match flat map
    globeInstance.pointOfView({ lat: 20, lng: 12, altitude: 2.5 }, 0);

    console.log('[Globe] Initialized', w, 'x', h);
  }

  function updateGlobePoints() {
    if (!globeInstance) return;
    const evts = EVENTS.getAll().filter(e => e.lat && e.lon);
    globeInstance
      .pointsData(evts)
      .pointLat('lat')
      .pointLng('lon')
      .pointColor(e => {
        const cats = EVENTS.getCategories();
        return (cats[e.category] || cats.political).color;
      })
      .pointAltitude(e => e.severity >= 4 ? 0.06 : 0.02)
      .pointRadius(e => e.severity >= 4 ? 0.6 : 0.35)
      .pointLabel(e => `<div style="font-family:'Share Tech Mono',monospace;font-size:12px;color:#0af0c0;background:rgba(8,12,22,0.9);padding:6px 10px;border-radius:4px;border:1px solid rgba(10,240,192,0.2)"><b>${e.headline}</b><br/><span style="color:#94a3b8">${e.location}</span></div>`);
  }

  function switchToGlobe() {
    const container = $('globe-container');
    $('map').style.display = 'none';
    container.style.display = 'block';
    // Small delay so container has dimensions before globe init
    setTimeout(() => initGlobe(), 50);
    // Move controls above the globe
    const mapTopbar = $('map-topbar');
    const overlayPanel = $('overlay-panel');
    const pizzaWidget = $('pizza-widget');
    if (mapTopbar) mapTopbar.style.zIndex = '1100';
    if (overlayPanel) overlayPanel.style.zIndex = '1100';
    if (pizzaWidget) pizzaWidget.style.zIndex = '1100';
  }

  function switchToFlat() {
    $('map').style.display = '';
    $('globe-container').style.display = 'none';
    const mapTopbar = $('map-topbar');
    const overlayPanel = $('overlay-panel');
    const pizzaWidget = $('pizza-widget');
    if (mapTopbar) mapTopbar.style.zIndex = '';
    if (overlayPanel) overlayPanel.style.zIndex = '';
    if (pizzaWidget) pizzaWidget.style.zIndex = '';
  }

  document.querySelectorAll('input[name="mapview"]').forEach(radio => {
    radio.addEventListener('change', () => {
      if (radio.value === 'globe' && radio.checked) switchToGlobe();
      else if (radio.value === 'flat' && radio.checked) switchToFlat();
    });
  });

  // Overlay collapse
  $('overlay-collapse')?.addEventListener('click', () => {
    const body = $('overlay-body');
    const btn  = $('overlay-collapse');
    body.classList.toggle('hidden');
    btn.classList.toggle('collapsed');
    btn.textContent = body.classList.contains('hidden') ? '▶' : '▼';
  });

  // ── Event rendering ───────────────────────────────────────────────────
  function renderEvents(eventsOverride) {
    const hideQuakes = !$('tog-quakes')?.checked;
    const events = (eventsOverride !== undefined) ? eventsOverride : EVENTS.getAll();
    const filtered = events.filter(e => {
      if (hideQuakes && e.source === 'USGS') return false;
      return state.cat === 'all' || e.category === state.cat;
    });

    MAP.render(filtered, state);

    const feed = $('events-feed');
    if (!feed) return;

    if (filtered.length === 0) {
      feed.innerHTML = '<div class="feed-spinner"><span style="color:var(--muted)">No events match current filters</span></div>';
      return;
    }

    const frag = document.createDocumentFragment();
    filtered.slice(0, 150).forEach(ev => frag.appendChild(makeEventCard(ev)));
    feed.innerHTML = '';
    feed.appendChild(frag);

    const evCount = $('event-count');
    if (evCount) evCount.textContent = EVENTS.getAll().length;
    const ovl = $('ovlc-events');
    if (ovl) ovl.textContent = filtered.length;
  }

  function makeEventCard(ev) {
    const cat  = CATS[ev.category] || CATS.political;
    const card = document.createElement('div');
    card.className = `ev-card cat-${ev.category}`;

    // Only show RED ALERT badge for S4/S5 — no severity label otherwise
    const alertBadge = ev.severity >= 4
      ? `<span class="ev-alert-red">${ev.severity >= 5 ? 'RED ALERT' : 'HIGH ALERT'}</span>`
      : '';

    const icon = ev.icon ? `${ev.icon} ` : '';

    card.innerHTML = `
      <div class="ev-top">
        <div class="mts-badges">
          <span class="ev-badge ${ev.category}">${cat.label}</span>
          ${alertBadge}
        </div>
        <span class="ev-time">${EVENTS.timeAgoFn(ev.time)}</span>
      </div>
      <div class="ev-headline">${icon}${escHtml(ev.headline)}</div>
      <div class="mts-meta">
        <span class="ev-loc">${escHtml(ev.location || ev.source)}</span>
        <span class="ev-time" style="font-size:9px;color:var(--muted)">${escHtml(ev.source)}</span>
      </div>`;
    card.addEventListener('click', () => MAP.showPopup(ev));
    return card;
  }

  // ── News rendering ────────────────────────────────────────────────────
  function renderNews(itemsOverride) {
    const items = (itemsOverride !== undefined) ? itemsOverride : EVENTS.getNews();

    // Map news filter categories
    const ncatMap = { war: 'conflict', geopolitics: 'political', finance: 'economic', crisis: 'disaster' };
    const mappedCat = ncatMap[state.ncat] || state.ncat;

    const filtered = items.filter(n =>
      state.ncat === 'all' || n.category === mappedCat
    );

    const feed = $('news-feed');
    if (!feed) return;

    if (filtered.length === 0) {
      feed.innerHTML = '<div class="feed-spinner"><span style="color:var(--muted)">No articles found</span></div>';
      return;
    }

    const frag = document.createDocumentFragment();
    filtered.slice(0, 200).forEach(n => frag.appendChild(makeNewsCard(n)));
    feed.innerHTML = '';
    feed.appendChild(frag);
  }

  function makeNewsCard(n) {
    const cat  = CATS[n.category] || CATS.political;
    const card = document.createElement('div');
    card.className = `news-card cat-${n.category}`;
    const timeStr = EVENTS.timeAgoFn(new Date(n.publishedAt));

    // Only show RED ALERT for high-severity news
    const alertBadge = n.severity >= 4
      ? `<span class="ev-alert-red">${n.severity >= 5 ? 'RED ALERT' : 'HIGH ALERT'}</span>`
      : '';

    card.innerHTML = `
      <div class="ev-top">
        <div class="mts-badges">
          <span class="ev-badge ${n.category}">${cat.label}</span>
          ${alertBadge}
        </div>
        <span class="ev-time">${timeStr}</span>
      </div>
      <div class="news-headline"><a href="${escHtml(n.url)}" target="_blank" rel="noopener">${escHtml(n.title)}</a></div>
      <div class="mts-meta">
        <span class="news-src-badge">${escHtml(n.source)}</span>
      </div>`;
    return card;
  }

  // ── Ticker ────────────────────────────────────────────────────────────
  function updateTicker(events, news) {
    // Priority: conflict S4-5 first, then high-sev events, then top news
    const conflictEvents = events
      .filter(e => e.category === 'conflict' && e.severity >= 3)
      .slice(0, 6)
      .map(e => `[CONFLICT] ${e.headline.toUpperCase()} — ${e.location}`);

    const highSevEvents = events
      .filter(e => e.category !== 'conflict' && e.severity >= 4)
      .slice(0, 4)
      .map(e => `[ALERT] ${e.headline} — ${e.location}`);

    const topNews = news
      .filter(n => n.severity >= 3 && (n.category === 'conflict' || n.category === 'political' || n.category === 'economic'))
      .slice(0, 8)
      .map(n => {
        const prefix = n.category === 'conflict' ? '[WAR]' : n.category === 'economic' ? '[MARKETS]' : '[INTEL]';
        return `${prefix} ${n.title} — ${n.source}`;
      });

    const all = [...conflictEvents, ...highSevEvents, ...topNews];
    const el = $('ticker-text');
    if (el && all.length) el.textContent = all.map(t => `  ◆  ${t}`).join('     ');
  }

  // ── Initial data load ─────────────────────────────────────────────────
  $('events-feed').innerHTML = '<div class="feed-spinner"><div class="spinner"></div><span>Querying OSINT sources…</span></div>';
  $('news-feed').innerHTML   = '<div class="feed-spinner"><div class="spinner"></div><span>Loading intelligence feeds…</span></div>';

  try {
    const { mapEvents, newsItems } = await EVENTS.fetchAll();
    renderEvents();
    renderNews();
    updateTicker(mapEvents, newsItems);
    console.log(`[APP] ${mapEvents.length} map events, ${newsItems.length} news articles`);
  } catch (err) {
    console.error('[APP] Load error:', err);
    $('events-feed').innerHTML = '<div class="feed-spinner"><span style="color:var(--red)">Feed unavailable — check console</span></div>';
  }

  // ── Auto-refresh every 2 min with countdown ──────────────────────────
  const REFRESH_SECS = 120;
  let refreshCountdown = REFRESH_SECS;

  // Countdown shown in event-count-wrap area — clickable to force refresh
  const countdownEl = document.createElement('button');
  countdownEl.id = 'refresh-countdown';
  countdownEl.title = 'Click to refresh now';
  const evWrap = $('event-count-wrap');
  if (evWrap) evWrap.after(countdownEl);

  async function forceRefresh() {
    refreshCountdown = REFRESH_SECS;
    countdownEl.textContent = 'refreshing...';
    try {
      const { mapEvents, newsItems } = await EVENTS.fetchAll();
      renderEvents(); renderNews(); updateTicker(mapEvents, newsItems);
      // Refresh all active overlays
      if ($('tog-weather')?.checked)  { WEATHER.disable(); WEATHER.enable(leafletMap); }
      if ($('tog-outages')?.checked)  { OUTAGES.disable(); OUTAGES.enable(leafletMap); }
      if ($('tog-aviation')?.checked) { AVIATION.disable(); AVIATION.enable(leafletMap); }
      if ($('tog-marine')?.checked)   { MARINE.disable(); MARINE.enable(leafletMap); }
      // Update globe points
      updateGlobePoints();
    } catch (e) { console.warn('[APP] Manual refresh failed:', e); }
  }
  countdownEl.addEventListener('click', forceRefresh);

  setInterval(() => {
    refreshCountdown--;
    if (countdownEl) countdownEl.textContent = `↻ ${refreshCountdown}s`;
    if (refreshCountdown <= 0) refreshCountdown = REFRESH_SECS;
  }, 1000);

  setInterval(() => forceRefresh(), REFRESH_SECS * 1000);

  // ── Mobile Navigation ─────────────────────────────────────────────────
  const btnMenu = $('btn-menu'), btnChat = $('btn-chat');
  const lp = $('left-panel'), rp = $('right-panel');

  if (leafletMap) {
    leafletMap.on('click dragstart', () => {
      if (window.innerWidth <= 800) {
        lp.classList.remove('open'); rp.classList.remove('open');
        btnMenu?.classList.remove('active'); btnChat?.classList.remove('active');
      }
    });
  }

  btnMenu?.addEventListener('click', () => {
    if (rp.classList.contains('open')) { rp.classList.remove('open'); btnChat.classList.remove('active'); }
    lp.classList.toggle('open'); btnMenu.classList.toggle('active');
  });
  btnChat?.addEventListener('click', () => {
    if (lp.classList.contains('open')) { lp.classList.remove('open'); btnMenu.classList.remove('active'); }
    rp.classList.toggle('open'); btnChat.classList.toggle('active');
  });

})();
