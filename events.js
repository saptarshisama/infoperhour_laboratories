/**
 * events.js v2 — OSINT + Proxy News Data Layer
 */

const EVENTS = (() => {

  const CATS = {
    conflict:     { label: 'Conflict',     color: '#ef4444', glow: 'rgba(239,68,68,0.5)' },
    political:    { label: 'Political',    color: '#f59e0b', glow: 'rgba(245,158,11,0.5)' },
    humanitarian: { label: 'Humanitarian', color: '#a78bfa', glow: 'rgba(167,139,250,0.5)' },
    disaster:     { label: 'Disaster',     color: '#22d3ee', glow: 'rgba(34,211,238,0.5)' },
    economic:     { label: 'Economic',     color: '#4ade80', glow: 'rgba(74,222,128,0.5)' },
  };

  let mapEvents  = [];  // events with lat/lon → map markers + events tab
  let newsItems  = [];  // articles from proxy news API → news tab only
  const listeners = [];

  // ── Helpers ─────────────────────────────────────────────────────────
  function severityFromMag(mag) {
    if (mag >= 7.0) return 5; if (mag >= 6.0) return 4;
    if (mag >= 5.0) return 3; if (mag >= 4.0) return 2; return 1;
  }
  function makeid(s) {
    return (s || Math.random().toString(36)).slice(2, 12);
  }
  function timeAgo(date) {
    const sec = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (sec < 60) return `${sec}s ago`;
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h ago`;
    return `${Math.floor(hr/24)}d ago`;
  }

  // ── USGS Earthquakes ────────────────────────────────────────────────
  async function fetchEarthquakes() {
    const res  = await fetch('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson');
    const json = await res.json();
    return (json.features || []).map(f => {
      const p = f.properties, c = f.geometry.coordinates;
      const mag = p.mag || 0;
      return {
        id: f.id || makeid(),
        category: 'disaster',
        headline: `M${mag.toFixed(1)} Earthquake — ${p.place || 'Unknown'}`,
        location:  p.place || 'Unknown',
        lat: c[1], lon: c[0],
        severity:  severityFromMag(mag),
        time:      new Date(p.time),
        source:    'USGS',
        url:       p.url || 'https://earthquake.usgs.gov',
        description: `Magnitude ${mag.toFixed(1)} earthquake. Depth: ${(c[2] || 0).toFixed(0)} km. ${p.status === 'reviewed' ? 'Reviewed by seismologists.' : 'Awaiting review.'}`,
      };
    });
  }

  // ── ReliefWeb Humanitarian ──────────────────────────────────────────
  async function fetchReliefWeb() {
    const res = await fetch('https://api.reliefweb.int/v1/disasters?appname=world-monitor-app', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: { include: ['name', 'date', 'country', 'type', 'url', 'status'] },
        filter: { field: 'status', value: 'ongoing' },
        limit: 30, sort: ['date.created:desc'],
      }),
    });
    const json = await res.json();
    return (json.data || []).map(d => {
      const f = d.fields;
      const cc = f.country?.[0]?.iso3 || '';
      const coords = COUNTRY_COORDS[cc] || [Math.random() * 80 - 20, Math.random() * 340 - 170];
      const types = (f.type || []).map(t => t.name.toLowerCase());
      let cat = 'humanitarian';
      if (types.some(t => /quake|flood|cyclone|drought|tsunami|volcan/.test(t))) cat = 'disaster';
      else if (types.some(t => /conflict|violence/.test(t))) cat = 'conflict';
      return {
        id: String(d.id || makeid()),
        category: cat,
        headline: f.name || 'Humanitarian Event',
        location: f.country?.[0]?.name || cc,
        lat: coords[0], lon: coords[1],
        severity: 3,
        time: new Date(f.date?.created || Date.now()),
        source: 'ReliefWeb',
        url: f.url || 'https://reliefweb.int',
        description: `Ongoing ${(f.type||[]).map(t=>t.name).join(', ')} in ${f.country?.[0]?.name||cc}. Active UN OCHA tracking.`,
      };
    });
  }

  // ── GDELT Global Events ─────────────────────────────────────────────
  async function fetchGDELT() {
    const q = '(conflict OR military OR attack OR disaster OR sanctions OR ceasefire)';
    const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(q)}&mode=artlist&maxrecords=30&format=json&timespan=360min&sort=hybridrel`;
    const text = await (await fetch(url)).text();
    if (!text || !text.trim().startsWith('{')) return [];
    const json = JSON.parse(text);

    return (json.articles || []).slice(0, 25).map(a => {
      const title = a.title || 'Untitled';
      const cat   = classifyGDELT(title);
      const coords= a.geolocation
        ? [parseFloat(a.geolocation.lat), parseFloat(a.geolocation.lon)]
        : [Math.random() * 100 - 20, Math.random() * 340 - 170];
      return {
        id: makeid(a.url),
        category: cat,
        headline: title,
        location: a.sourcecountry || a.domain || 'Global',
        lat: coords[0], lon: coords[1],
        severity: classifySev(title),
        time: a.seendate ? parseGDELTDate(a.seendate) : new Date(),
        source: a.domain || 'GDELT',
        url: a.url || 'https://gdeltproject.org',
        description: `From ${a.domain||'global sources'}. Indexed by GDELT.`,
      };
    });
  }

  function classifyGDELT(t) {
    if (/attack|war|military|missile|bomb|shoot|troops|army|strike|ceasefire|airstrike/i.test(t)) return 'conflict';
    if (/election|president|congress|senate|vote|diplomat|sanction|parliament|coup/i.test(t)) return 'political';
    if (/refugee|hunger|aid|humanitarian|displaced|famine/i.test(t)) return 'humanitarian';
    if (/earthquake|flood|fire|cyclone|hurricane|tsunami|volcano|disaster|drought/i.test(t)) return 'disaster';
    if (/economy|market|trade|gdp|bank|inflation|tariff|export/i.test(t)) return 'economic';
    return 'political';
  }
  function classifySev(t) {
    if (/nuclear|catastrophic|massacre|genocide|category [45]|7\.\d magnitude/i.test(t)) return 5;
    if (/dozens killed|hundreds|major|emergency|invasion/i.test(t)) return 4;
    if (/killed|dead|attack|strike|launched|escalat/i.test(t)) return 3;
    if (/concern|tension|warning|protest/i.test(t)) return 2;
    return 1;
  }
  function parseGDELTDate(s) {
    try { return new Date(`${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}T${s.slice(9,11)}:${s.slice(11,13)}:${s.slice(13,15)}Z`); } catch { return new Date(); }
  }

  // ── Proxy News ──────────────────────────────────────────────────────
  async function fetchProxyNews() {
    const res  = await fetch(`${CONFIG.PROXY_URL}/api/news`);
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  }

  // ── Country coords lookup ────────────────────────────────────────────
  const COUNTRY_COORDS = {
    AFG:[33.9,67.7],ALB:[41.2,20.2],DZA:[28.0,1.7],AGO:[-11.2,17.9],ARG:[-34.6,-64.2],
    ARM:[40.1,45.0],AUS:[-25.3,133.8],AUT:[47.5,14.6],AZE:[40.1,47.6],BGD:[23.7,90.4],
    BLR:[53.7,27.9],BEL:[50.8,4.5],BOL:[-16.3,-63.6],BIH:[43.9,17.7],BRA:[-14.2,-51.9],
    BGR:[42.7,25.5],BFA:[12.4,-1.6],BDI:[-3.4,29.9],KHM:[11.6,104.9],CMR:[3.9,11.5],
    CAN:[56.1,-106.3],CAF:[7.0,20.9],TCD:[15.5,18.7],CHL:[-35.7,-71.5],CHN:[35.9,104.2],
    COL:[4.1,-72.3],COD:[-3.0,24.0],CRI:[9.7,-83.8],HRV:[45.1,15.2],CUB:[21.5,-77.8],
    CZE:[49.8,15.5],DNK:[56.3,9.5],DOM:[18.7,-70.2],ECU:[-1.8,-78.2],EGY:[26.8,30.8],
    ETH:[9.1,40.5],FIN:[61.9,25.8],FRA:[46.2,2.2],DEU:[51.2,10.5],GHA:[8.0,-1.0],
    GRC:[39.1,22.0],GTM:[15.8,-90.2],HTI:[18.9,-72.7],HND:[15.2,-86.2],HUN:[47.2,19.5],
    IND:[20.6,79.0],IDN:[-0.8,113.9],IRN:[32.4,53.7],IRQ:[33.2,43.7],IRL:[53.4,-8.2],
    ISR:[31.0,34.9],ITA:[41.9,12.6],JPN:[36.2,138.3],JOR:[31.2,36.5],KAZ:[47.2,66.9],
    KEN:[-1.3,36.8],PRK:[40.3,127.5],KOR:[35.9,127.8],KWT:[29.3,47.5],LBN:[33.9,35.5],
    LBY:[26.3,17.2],MAR:[31.8,-7.1],MEX:[23.6,-102.6],MDA:[47.4,28.4],MNG:[46.9,103.8],
    MMR:[16.9,96.2],NPL:[28.4,84.1],NLD:[52.1,5.3],NZL:[-40.9,174.9],NGA:[10.5,7.4],
    NOR:[60.5,8.5],PAK:[30.4,69.3],PAN:[8.5,-80.8],PER:[-9.2,-75.0],PHL:[12.9,121.8],
    POL:[51.9,19.1],PRT:[39.4,-8.2],QAT:[25.4,51.2],ROU:[45.9,24.9],RUS:[61.5,105.3],
    RWA:[-1.9,29.9],SAU:[24.0,45.0],SEN:[14.5,-14.5],SRB:[44.0,21.0],SLE:[8.5,-11.8],
    SOM:[5.2,46.2],ZAF:[-30.6,22.9],SSD:[6.9,31.3],ESP:[40.5,-3.7],LKA:[7.9,80.8],
    SDN:[15.5,32.5],SWE:[60.1,18.6],CHE:[46.8,8.2],SYR:[34.8,38.0],TWN:[23.7,120.9],
    TZA:[-6.4,35.0],THA:[15.9,100.9],TUN:[33.9,9.6],TUR:[38.9,35.2],UGA:[1.4,32.3],
    UKR:[48.4,31.2],ARE:[23.4,53.8],GBR:[55.4,-3.4],USA:[37.1,-95.7],VEN:[6.4,-66.6],
    VNM:[14.1,108.3],YEM:[15.6,48.5],ZMB:[-13.1,27.8],ZWE:[-19.0,29.2],
  };

  // ── Public API ───────────────────────────────────────────────────────
  async function fetchAll() {
    const [quakes, relief, gdelt, proxyNews] = await Promise.allSettled([
      fetchEarthquakes(),
      fetchReliefWeb(),
      fetchGDELT(),
      fetchProxyNews(),
    ]);

    const events = [
      ...(quakes.value    || []),
      ...(relief.value    || []),
      ...(gdelt.value     || []),
    ].filter(Boolean);

    // Deduplicate map events
    const seen = new Set();
    mapEvents = events.filter(e => {
      const k = e.headline.slice(0, 40).toLowerCase().replace(/\W/g, '');
      if (seen.has(k)) return false;
      seen.add(k); return true;
    }).sort((a, b) => new Date(b.time) - new Date(a.time));

    newsItems = (proxyNews.value || []);

    listeners.forEach(fn => fn(mapEvents, newsItems));
    return { mapEvents, newsItems };
  }

  function getAll()       { return mapEvents; }
  function getNews()      { return newsItems; }
  function onUpdate(fn)   { listeners.push(fn); }
  function getCategories(){ return CATS; }
  function timeAgoFn(d)   { return timeAgo(d); }

  return { fetchAll, getAll, getNews, onUpdate, getCategories, timeAgoFn };
})();
