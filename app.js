/**
 * app.js v2 — Main Orchestrator
 * Wires all layers: events, news, aviation, marine, weather + filters + clock
 */

(async () => {

  // ── State ───────────────────────────────────────────────────────────
  const state = { cat: 'all', sev: 'all', ncat: 'all', tab: 'events' };
  const CATS  = EVENTS.getCategories();

  // ── DOM shortcuts ────────────────────────────────────────────────────
  const $ = id => document.getElementById(id);
  const escHtml = s => (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

  // ── UTC Clock ────────────────────────────────────────────────────────
  setInterval(() => {
    const n = new Date();
    const p = v => String(v).padStart(2,'0');
    const el = $('utc-clock');
    if (el) el.textContent = `${p(n.getUTCHours())}:${p(n.getUTCMinutes())}:${p(n.getUTCSeconds())}`;
  }, 1000);

  // ── Map init ─────────────────────────────────────────────────────────
  const leafletMap = MAP.init();

  // ── Chat ─────────────────────────────────────────────────────────────
  CHAT.init();

  // ── Tab switching ────────────────────────────────────────────────────
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

  // ── Event filters ────────────────────────────────────────────────────
  document.querySelectorAll('[data-cat]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-cat]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.cat = btn.dataset.cat;
      renderEvents();
    });
  });

  document.querySelectorAll('[data-sev]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-sev]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.sev = btn.dataset.sev;
      renderEvents();
    });
  });

  // ── News filters ─────────────────────────────────────────────────────
  document.querySelectorAll('[data-ncat]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-ncat]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.ncat = btn.dataset.ncat;
      renderNews();
    });
  });

  // ── Overlay toggles ──────────────────────────────────────────────────
  $('tog-events')?.addEventListener('change', e => {
    renderEvents(e.target.checked ? EVENTS.getAll() : []);
  });
  $('tog-quakes')?.addEventListener('change', e => {
    // Filter to just quakes or all
    const all = EVENTS.getAll();
    const show = e.target.checked ? all : all.filter(ev => ev.source !== 'USGS');
    renderEvents(show);
  });
  $('tog-aviation')?.addEventListener('change', e => {
    if (e.target.checked) AVIATION.enable(leafletMap);
    else AVIATION.disable();
    $('ovlc-aviation').textContent = e.target.checked ? ($('aircraft-count')?.textContent || '…') : '—';
  });
  $('tog-marine')?.addEventListener('change', e => {
    if (e.target.checked) MARINE.enable(leafletMap);
    else MARINE.disable();
    $('ovlc-marine').textContent = e.target.checked ? ($('ship-count')?.textContent || '…') : '—';
  });
  $('tog-weather')?.addEventListener('change', e => {
    if (e.target.checked) WEATHER.enable(leafletMap);
    else WEATHER.disable();
  });

  // Overlay collapse toggle
  $('overlay-collapse')?.addEventListener('click', () => {
    const body = $('overlay-body');
    const btn  = $('overlay-collapse');
    body.classList.toggle('hidden');
    btn.classList.toggle('collapsed');
    btn.textContent = body.classList.contains('hidden') ? '▶' : '▼';
  });

  // ── Event rendering ──────────────────────────────────────────────────
  function renderEvents(eventsOverride) {
    const events = (eventsOverride !== undefined) ? eventsOverride : EVENTS.getAll();
    const filtered = events.filter(e => {
      const catOk = state.cat === 'all' || e.category === state.cat;
      const sevOk = state.sev === 'all' || e.severity === parseInt(state.sev);
      return catOk && sevOk;
    });

    MAP.render(filtered, state);

    const feed = $('events-feed');
    if (!feed) return;

    if (filtered.length === 0) {
      feed.innerHTML = '<div class="feed-spinner"><span style="color:#64748b">No events match filters</span></div>';
      return;
    }

    const frag = document.createDocumentFragment();
    filtered.slice(0, 120).forEach(ev => frag.appendChild(makeEventCard(ev)));
    feed.innerHTML = '';
    feed.appendChild(frag);

    const evCount = $('event-count');
    if (evCount) evCount.textContent = EVENTS.getAll().length;

    // Update overlay count
    const ovl = $('ovlc-events');
    if (ovl) ovl.textContent = filtered.length;
  }

  function makeEventCard(ev) {
    const cat  = CATS[ev.category] || CATS.political;
    const card = document.createElement('div');
    card.className = `ev-card ${ev.category}`;
    card.innerHTML = `
      <div class="ev-top">
        <span class="ev-badge ${ev.category}">${cat.label}</span>
        <span class="ev-sev s${ev.severity}">S${ev.severity}</span>
      </div>
      <div class="ev-headline">${escHtml(ev.headline)}</div>
      <div class="ev-meta">
        <span class="ev-loc">${escHtml(ev.location || '')}</span>
        <span class="ev-src">${escHtml(ev.source)}</span>
        <span class="ev-time">${EVENTS.timeAgoFn(ev.time)}</span>
      </div>`;
    card.addEventListener('click', () => MAP.showPopup(ev));
    return card;
  }

  // ── News rendering ────────────────────────────────────────────────────
  function renderNews(itemsOverride) {
    const items = (itemsOverride !== undefined) ? itemsOverride : EVENTS.getNews();
    const filtered = items.filter(n =>
      state.ncat === 'all' || n.category === state.ncat
    );

    const feed = $('news-feed');
    if (!feed) return;

    if (filtered.length === 0) {
      feed.innerHTML = '<div class="feed-spinner"><span style="color:#64748b">No articles found</span></div>';
      return;
    }

    const frag = document.createDocumentFragment();
    filtered.slice(0, 150).forEach(n => frag.appendChild(makeNewsCard(n)));
    feed.innerHTML = '';
    feed.appendChild(frag);
  }

  function makeNewsCard(n) {
    const cat  = CATS[n.category] || CATS.political;
    const card = document.createElement('div');
    card.className = `news-card ${n.category}`;
    const timeStr = EVENTS.timeAgoFn(new Date(n.publishedAt));
    card.innerHTML = `
      <div class="ev-top">
        <span class="ev-badge ${n.category}">${cat.label}</span>
        <span class="ev-sev s${n.severity}">S${n.severity}</span>
      </div>
      <div class="news-headline"><a href="${escHtml(n.url)}" target="_blank" rel="noopener">${escHtml(n.title)}</a></div>
      ${n.description ? `<div class="news-desc">${escHtml(n.description.slice(0,160))}…</div>` : ''}
      <div class="news-meta">
        <span class="news-src">${escHtml(n.source)}</span>
        <span class="ev-time">${timeStr}</span>
      </div>`;
    return card;
  }

  // ── Ticker update ─────────────────────────────────────────────────────
  function updateTicker(events, news) {
    const all = [...events.slice(0,10).map(e=>`[${(CATS[e.category]||CATS.political).label.toUpperCase()}] ${e.headline} — ${e.location}`),
                 ...news.slice(0,10).map(n=>`[${(CATS[n.category]||CATS.political).label.toUpperCase()}] ${n.title} — ${n.source}`)];
    const el = $('ticker-text');
    if (el && all.length) el.textContent = all.map(t => `  ◆  ${t}`).join('   ');
  }

  // ── Initial data load ─────────────────────────────────────────────────
  $('events-feed').innerHTML = '<div class="feed-spinner"><div class="spinner"></div><span>Querying OSINT sources…</span></div>';
  $('news-feed').innerHTML   = '<div class="feed-spinner"><div class="spinner"></div><span>Loading news feeds…</span></div>';

  try {
    const { mapEvents, newsItems } = await EVENTS.fetchAll();
    renderEvents();
    renderNews();
    updateTicker(mapEvents, newsItems);
    console.log(`[APP] ${mapEvents.length} map events, ${newsItems.length} news articles`);
  } catch (err) {
    console.error('[APP] Load error:', err);
    $('events-feed').innerHTML = '<div class="feed-spinner"><span style="color:#ef4444">OSINT fetch failed. Check console.</span></div>';
  }

  // ── Auto-refresh every 5 minutes ──────────────────────────────────────
  setInterval(async () => {
    console.log('[APP] Auto-refreshing…');
    try {
      const { mapEvents, newsItems } = await EVENTS.fetchAll();
      renderEvents();
      renderNews();
      updateTicker(mapEvents, newsItems);
    } catch (e) { console.warn('[APP] Refresh failed:', e); }
  }, 5 * 60 * 1000);

  // ── Mobile Navigation ───────────────────────────────────────────────────
  const btnMenu = $('btn-menu');
  const btnChat = $('btn-chat');
  const lp = $('left-panel');
  const rp = $('right-panel');

  if (btnMenu) {
    btnMenu.addEventListener('click', () => {
      if (rp.classList.contains('open')) {
        rp.classList.remove('open');
        btnChat.classList.remove('active');
      }
      lp.classList.toggle('open');
      btnMenu.classList.toggle('active');
    });
  }
  
  if (btnChat) {
    btnChat.addEventListener('click', () => {
      if (lp.classList.contains('open')) {
        lp.classList.remove('open');
        btnMenu.classList.remove('active');
      }
      rp.classList.toggle('open');
      btnChat.classList.toggle('active');
    });
  }

})();
