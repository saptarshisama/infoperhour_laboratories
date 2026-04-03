/**
 * pizza.js — Pentagon Pizza Index Widget
 * Source: https://www.pizzint.watch/api/dashboard-data
 * Polls every 10 minutes. Shows DEFCON level, activity index,
 * active spike venues, and 24h sparkline.
 */

const PIZZA = (() => {

  const API_URL  = 'https://www.pizzint.watch/api/dashboard-data';
  const INTERVAL = 10 * 60 * 1000; // 10 minutes

  const DEFCON_COLORS = {
    1: '#e03040',  // critical red
    2: '#e06020',  // high orange
    3: '#e8a020',  // elevated amber
    4: '#0af0c0',  // normal teal
    5: '#3888ff',  // low blue
  };

  let minimized = false;

  // ── Fetch ────────────────────────────────────────────────────────────
  async function fetchData() {
    try {
      const res = await fetch(API_URL, { signal: AbortSignal.timeout(12000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      console.warn('[Pizza] Fetch failed:', e.message);
      return null;
    }
  }

  // ── Render ───────────────────────────────────────────────────────────
  function render(data) {
    if (!data || !data.success) return;

    const defcon   = data.defcon_level ?? 4;
    const index    = Math.round(data.overall_index ?? 0);
    const fresh    = data.data_freshness === 'fresh';
    const spikes   = data.events || [];
    const venues   = data.data  || [];
    const ts       = data.timestamp ? new Date(data.timestamp) : new Date();

    const color = DEFCON_COLORS[defcon] || DEFCON_COLORS[4];

    // DEFCON value + color
    const dlEl = document.getElementById('pizza-defcon-val');
    if (dlEl) { dlEl.textContent = defcon; dlEl.style.color = color; }

    // Freshness badge
    const frEl = document.getElementById('pizza-freshness');
    if (frEl) {
      frEl.textContent = fresh ? '● LIVE' : '◌ STALE';
      frEl.style.color = fresh ? '#28d890' : '#5a7888';
    }

    // Index bar
    const barEl = document.getElementById('pizza-bar');
    if (barEl) {
      barEl.style.width   = `${Math.min(index, 100)}%`;
      barEl.style.background = index >= 70 ? '#e03040'
                             : index >= 40 ? '#e8a020'
                             : '#0af0c0';
    }
    const idxEl = document.getElementById('pizza-idx-label');
    if (idxEl) idxEl.textContent = `${index}/100`;

    // Widget border class
    const widget = document.getElementById('pizza-widget');
    if (widget) {
      widget.classList.toggle('defcon-high',  defcon <= 2);
      widget.classList.toggle('spike-active', data.has_active_spikes && defcon > 2);
    }

    // Spike list
    const spikesEl = document.getElementById('pizza-spikes');
    if (spikesEl) {
      if (spikes.length === 0) {
        spikesEl.innerHTML = '<span style="color:var(--text-dim);font-size:10px">No active spikes</span>';
      } else {
        spikesEl.innerHTML = spikes.slice(0, 3).map(s => {
          const mag = s.spike_magnitude || 'MODERATE';
          return `<div class="spike-item">
            <span style="color:var(--text-dim);font-size:9px">▲</span>
            <span class="spike-name">${s.place_name}</span>
            <span style="color:var(--text-dim);font-size:9px">${s.percentage_of_usual}%</span>
            <span class="spike-mag ${mag}">${mag}</span>
          </div>`;
        }).join('');
      }
    }

    // Sparkline — use first venue's 24h data, or aggregate max across all venues
    const canvas = document.getElementById('pizza-sparkline');
    if (canvas && venues.length > 0) {
      // Pick venue with most data points
      const bestVenue = venues.reduce((best, v) =>
        (v.sparkline_24h?.length || 0) > (best.sparkline_24h?.length || 0) ? v : best
      , venues[0]);

      drawSparkline(canvas, bestVenue.sparkline_24h || []);
    }

    // Timestamp
    const tsEl = document.getElementById('pizza-ts');
    if (tsEl) {
      const p  = v => String(v).padStart(2, '0');
      const utcStr = `${p(ts.getUTCHours())}:${p(ts.getUTCMinutes())} UTC`;
      tsEl.textContent = `Updated ${utcStr} · pizzint.watch`;
    }
  }

  // ── Sparkline canvas draw ────────────────────────────────────────────
  function drawSparkline(canvas, points) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    // Filter to non-null points
    const valid = points.filter(p => p.current_popularity != null);
    if (valid.length < 2) {
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      ctx.fillRect(0, 0, W, H);
      return;
    }

    const barW   = Math.floor(W / valid.length) - 1;
    const maxVal = 100;

    valid.forEach((p, i) => {
      const val  = Math.min(p.current_popularity || 0, maxVal);
      const barH = Math.max(2, Math.round((val / maxVal) * H));
      const x    = i * (barW + 1);
      const y    = H - barH;

      // Color by value
      ctx.fillStyle = val >= 150 ? '#e03040'
                    : val >= 100 ? '#e8a020'
                    : val >= 60  ? '#0af0c0'
                    : 'rgba(10,240,192,0.35)';
      ctx.fillRect(x, y, barW, barH);
    });
  }

  // ── Poll loop ────────────────────────────────────────────────────────
  async function poll() {
    const data = await fetchData();
    if (data) render(data);
  }

  // ── Init ─────────────────────────────────────────────────────────────
  function init() {
    // Minimize toggle
    const minBtn = document.getElementById('pizza-min');
    const body   = document.getElementById('pizza-body');
    if (minBtn && body) {
      minBtn.addEventListener('click', () => {
        minimized = !minimized;
        body.classList.toggle('hidden', minimized);
        minBtn.textContent = minimized ? '+' : '−';
      });
    }

    // Initial fetch + interval
    poll();
    setInterval(poll, INTERVAL);

    console.log('[Pizza] Pentagon Pizza Index widget initialized');
  }

  return { init };
})();
