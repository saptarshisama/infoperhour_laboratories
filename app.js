/**
 * app.js v3 — Main Orchestrator
 * Sci-fi HUD: events, news, aviation, marine, weather, cables, datacenters
 * Severity: only S4/S5 shows RED ALERT badge — no other sev labels
 */

(async () => {

  const state = { cat: 'all', ncat: 'all', tab: 'events' };
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
      ? `<span class="ev-alert-red">${ev.severity >= 5 ? '🔴 RED ALERT' : '⚠ HIGH ALERT'}</span>`
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
        <span class="ev-loc">📍 ${escHtml(ev.location || ev.source)}</span>
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
      ? `<span class="ev-alert-red">${n.severity >= 5 ? '🔴 RED ALERT' : '⚠ HIGH ALERT'}</span>`
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
    const all = [
      ...events.filter(e => e.severity >= 3).slice(0,8).map(e =>
        `[${(CATS[e.category]||CATS.political).label.toUpperCase()}] ${e.headline} — ${e.location}`),
      ...news.filter(n => n.severity >= 3).slice(0,8).map(n =>
        `[${(CATS[n.category]||CATS.political).label.toUpperCase()}] ${n.title} — ${n.source}`),
    ];
    const el = $('ticker-text');
    if (el && all.length) el.textContent = all.map(t => `  ◆  ${t}`).join('   ');
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

  // Auto-refresh every 5 min
  setInterval(async () => {
    try {
      const { mapEvents, newsItems } = await EVENTS.fetchAll();
      renderEvents(); renderNews(); updateTicker(mapEvents, newsItems);
    } catch (e) { console.warn('[APP] Refresh failed:', e); }
  }, 5 * 60 * 1000);

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
