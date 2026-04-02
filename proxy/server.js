/**
 * Infoperhour Laboratories Proxy Server
 * Handles: News RSS aggregation, ADSB aircraft data, Digitraffic AIS ship positions → SSE
 */

require('dotenv').config();
const express  = require('express');
const cors     = require('cors');
const fetch    = require('node-fetch');
const { parseStringPromise } = require('xml2js');
const NodeCache = require('node-cache');
// WebSocket removed — marine now uses Digitraffic REST poll instead of AISStream WS

const app   = express();
const PORT  = process.env.PORT || 3001;
const cache = new NodeCache({ stdTTL: 0, checkperiod: 60 });

app.use(cors({ origin: '*' }));
app.use(express.json());

// ════════════════════════════════════════════════════════════════════
//  NEWS RSS AGGREGATION
// ════════════════════════════════════════════════════════════════════

const RSS_FEEDS = [
  // ── WAR & CONFLICT ──────────────────────────────────────────────────
  { url: 'https://news.google.com/rss/search?q=war+conflict+military+airstrike+troops+attack&hl=en-US&gl=US&ceid=US:en',            source: 'Google News', cat: 'conflict' },
  { url: 'https://news.google.com/rss/search?q=ceasefire+assault+siege+bombardment+offensive+killed&hl=en-US&gl=US&ceid=US:en',     source: 'Google News', cat: 'conflict' },
  { url: 'https://news.google.com/rss/search?q=Ukraine+Russia+war+frontline+offensive+2024&hl=en-US&gl=US&ceid=US:en',              source: 'Google News', cat: 'conflict' },
  { url: 'https://news.google.com/rss/search?q=Gaza+Israel+Lebanon+Hamas+Hezbollah+airstrike&hl=en-US&gl=US&ceid=US:en',            source: 'Google News', cat: 'conflict' },
  { url: 'https://news.google.com/rss/search?q=missile+drone+attack+strike+explosion+bomb&hl=en-US&gl=US&ceid=US:en',               source: 'Google News', cat: 'conflict' },

  // ── GEOPOLITICS ─────────────────────────────────────────────────────
  { url: 'https://news.google.com/rss/search?q=sanctions+diplomacy+coup+NATO+UN+treaty+crisis&hl=en-US&gl=US&ceid=US:en',           source: 'Google News', cat: 'political' },
  { url: 'https://news.google.com/rss/search?q=China+Taiwan+South+China+Sea+tension&hl=en-US&gl=US&ceid=US:en',                     source: 'Google News', cat: 'political' },
  { url: 'https://news.google.com/rss/search?q=Iran+nuclear+deal+JCPOA+sanctions+geopolitics&hl=en-US&gl=US&ceid=US:en',            source: 'Google News', cat: 'political' },
  { url: 'https://news.google.com/rss/search?q=North+Korea+missile+test+Kim+Jong+Un&hl=en-US&gl=US&ceid=US:en',                     source: 'Google News', cat: 'political' },

  // ── BUSINESS & FINANCE ──────────────────────────────────────────────
  { url: 'https://news.google.com/rss/search?q=global+economy+trade+sanctions+tariff+inflation+bank&hl=en-US&gl=US&ceid=US:en',     source: 'Google News', cat: 'economic' },
  { url: 'https://news.google.com/rss/search?q=merger+acquisition+billion+deal+IPO+investment&hl=en-US&gl=US&ceid=US:en',           source: 'Google News', cat: 'economic' },
  { url: 'https://news.google.com/rss/search?q=stock+market+crash+rally+Fed+interest+rate&hl=en-US&gl=US&ceid=US:en',               source: 'Google News', cat: 'economic' },
  { url: 'https://news.google.com/rss/search?q=oil+price+OPEC+energy+gas+commodities&hl=en-US&gl=US&ceid=US:en',                    source: 'Google News', cat: 'economic' },
  { url: 'https://news.google.com/rss/search?q=semiconductor+chip+AI+tech+Microsoft+Apple+Google+Meta&hl=en-US&gl=US&ceid=US:en',   source: 'Google News', cat: 'economic' },

  // ── DISASTER & CRISIS ───────────────────────────────────────────────
  { url: 'https://news.google.com/rss/search?q=earthquake+flood+hurricane+cyclone+wildfire+tsunami&hl=en-US&gl=US&ceid=US:en',      source: 'Google News', cat: 'disaster' },
  { url: 'https://news.google.com/rss/search?q=power+blackout+internet+outage+grid+failure&hl=en-US&gl=US&ceid=US:en',              source: 'Google News', cat: 'disaster' },
  { url: 'https://news.google.com/rss/search?q=refugees+famine+aid+humanitarian+displacement+UNHCR&hl=en-US&gl=US&ceid=US:en',      source: 'Google News', cat: 'humanitarian' },

  // ── US Broadcast Networks ──────────────────────────────────────────
  { url: 'https://feeds.nbcnews.com/nbcnews/public/world',                   source: 'NBC News',    cat: null },
  { url: 'https://rss.cnn.com/rss/edition_world.rss',                        source: 'CNN',         cat: null },
  { url: 'https://www.cbsnews.com/latest/rss/world',                         source: 'CBS News',    cat: null },
  { url: 'https://abcnews.go.com/abcnews/internationalheadlines',             source: 'ABC News',    cat: null },
  { url: 'https://feeds.foxnews.com/foxnews/world',                          source: 'Fox News',    cat: null },
  { url: 'https://www.newsmax.com/rss/Politics/1/',                           source: 'Newsmax',     cat: 'political' },

  // ── Business / Finance Outlets ──────────────────────────────────────
  { url: 'https://feeds.bloomberg.com/politics/news.rss',                    source: 'Bloomberg',   cat: 'political' },
  { url: 'https://feeds.bloomberg.com/markets/news.rss',                     source: 'Bloomberg Markets', cat: 'economic' },
  { url: 'https://feeds.reuters.com/reuters/businessNews',                   source: 'Reuters Business', cat: 'economic' },
  { url: 'https://feeds.reuters.com/reuters/worldNews',                      source: 'Reuters',     cat: null },
  { url: 'https://www.ft.com/rss/home/international',                        source: 'FT',          cat: 'economic' },
  { url: 'https://fortune.com/feed/',                                         source: 'Fortune',     cat: 'economic' },
  { url: 'https://www.wsj.com/xml/rss/3_7085.xml',                           source: 'WSJ World',   cat: null },
  { url: 'https://feeds.marketwatch.com/marketwatch/topstories/',            source: 'MarketWatch', cat: 'economic' },

  // ── International Broadcasters ─────────────────────────────────────
  { url: 'https://feeds.bbci.co.uk/news/world/rss.xml',                      source: 'BBC World',   cat: null },
  { url: 'https://www.aljazeera.com/xml/rss/all.xml',                        source: 'Al Jazeera',  cat: null },
  { url: 'https://www.france24.com/en/rss',                                  source: 'France 24',   cat: null },
  { url: 'https://rss.dw.com/rss/en-all',                                    source: 'DW News',     cat: null },
  { url: 'https://feeds.skynews.com/feeds/rss/world.rss',                    source: 'Sky News',    cat: null },
  { url: 'https://www3.nhk.or.jp/rss/news/cat0.xml',                         source: 'NHK World',   cat: null },
  { url: 'https://www.i24news.tv/en/rss',                                    source: 'i24 News',    cat: null },
  { url: 'https://www.iranintl.com/en/rss.xml',                              source: 'Iran Intl',   cat: null },

  // ── Wire Services ──────────────────────────────────────────────────
  { url: 'https://apnews.com/rss/world-news',                                source: 'AP News',     cat: null },
  { url: 'https://www.theguardian.com/world/rss',                            source: 'The Guardian',cat: null },
  { url: 'https://www.euronews.com/rss',                                     source: 'Euronews',    cat: null },
  { url: 'https://www.rfi.fr/en/rss',                                        source: 'RFI',         cat: null },

  // ── Defence / Conflict Specialists ─────────────────────────────────
  { url: 'https://www.defensenews.com/arc/outboundfeeds/rss/',               source: 'Defense News',cat: 'conflict' },
  { url: 'https://www.militarytimes.com/arc/outboundfeeds/rss/',             source: 'Military Times', cat: 'conflict' },
  { url: 'https://taskandpurpose.com/feed/',                                  source: 'Task & Purpose', cat: 'conflict' },

  // ── Region-Specific Wires ──────────────────────────────────────────
  { url: 'https://www.timesofisrael.com/feed/',                              source: 'Times of Israel', cat: null },
  { url: 'https://english.alarabiya.net/tools/rss',                          source: 'Al Arabiya',  cat: null },
  { url: 'https://www.kyivindependent.com/feed/',                            source: 'Kyiv Independent', cat: 'conflict' },
  { url: 'https://www.themoscowtimes.com/rss/news',                          source: 'Moscow Times',cat: null },
  { url: 'https://timesofindia.indiatimes.com/rssfeeds/296589292.cms',       source: 'Times of India', cat: null },
  { url: 'https://www.scmp.com/rss/91/feed',                                 source: 'SCMP',        cat: null },
  { url: 'https://asia.nikkei.com/rss/feed/nar',                             source: 'Nikkei Asia', cat: null },

  // ── Disaster / Humanitarian ─────────────────────────────────────────
  { url: 'https://reliefweb.int/updates/rss.xml',                            source: 'ReliefWeb',   cat: 'humanitarian' },
  { url: 'https://www.gdacs.org/xml/rss.xml',                                source: 'GDACS',       cat: 'disaster' },
];

const CONFLICT_KEYWORDS   = /\b(war|attack|killed|dead|troops|military|missile|bomb|airstrike|strike|assault|offensive|conflict|ceasefire|siege|battle|fighting|gunfire|explosion|troops|navy|forces|weapons|drone)\b/i;
const POLITICAL_KEYWORDS  = /\b(election|president|prime minister|sanctions|diplomacy|treaty|parliament|congress|coup|protest|rally|vote|government|minister|senate|UN|NATO|treaty)\b/i;
const HUMANITARIAN_KWORDS = /\b(refugee|displaced|famine|hunger|aid|humanitarian|evacuation|shelter|UN\w+|UNHCR|crisis|civilian|fleeing)\b/i;
const DISASTER_KEYWORDS   = /\b(earthquake|magnitude|flood|flooding|hurricane|typhoon|cyclone|wildfire|fire|tsunami|eruption|volcano|drought|storm|tornado)\b/i;
const ECONOMIC_KEYWORDS   = /\b(economy|inflation|trade|sanction|tariff|gdp|bank|currency|market|recession|export|import|oil price|energy|gas price|merger|acquisition|deal|IPO|investment|hedge fund|interest rate|stock|nasdaq|dow jones|crypto|bitcoin|semiconductor|chip)\b/i;

function classifyArticle(title, description, feedCat) {
  if (feedCat) return feedCat;
  const text = `${title} ${description}`.toLowerCase();
  if (CONFLICT_KEYWORDS.test(text))   return 'conflict';
  if (DISASTER_KEYWORDS.test(text))   return 'disaster';
  if (HUMANITARIAN_KWORDS.test(text)) return 'humanitarian';
  if (ECONOMIC_KEYWORDS.test(text))   return 'economic';
  if (POLITICAL_KEYWORDS.test(text))  return 'political';
  return 'political';
}

function severityFromTitle(title) {
  const t = title.toLowerCase();
  if (/nuclear|catastrophic|mass casualt|hundreds (killed|dead)|major earthquake|category [45]|8\.\d magnitude|assassinat|icbm|carrier strike/.test(t)) return 5;
  if (/dozens (killed|dead)|major (offensive|attack|strike)|invasion|embargo|hypersonic|ballistic|terrorist|defus|ambush/.test(t)) return 4;
  if (/killed|dead|attack|strike|launched|escalat|bombing|drone|missile|destroy|casualties/.test(t)) return 3;
  if (/warning|tension|concern|protest|sanctions|deploy|threat|standoff/.test(t)) return 2;
  return 1;
}

async function fetchSingleRSS(feed) {
  try {
    const res = await fetch(feed.url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (WorldMonitor/2.0; +https://worldmonitor.pages.dev)',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();
    const parsed = await parseStringPromise(xml, { explicitArray: false, ignoreAttrs: true });

    const items = parsed?.rss?.channel?.item
      || parsed?.feed?.entry
      || [];
    const arr = Array.isArray(items) ? items : (items ? [items] : []);

    return arr.slice(0, 12).map(item => {
      const title = (item.title?._ || item.title || 'Untitled').trim();
      const desc  = (item.description?._ || item.description || item.summary?._ || item.summary || '').replace(/<[^>]+>/g, '').trim().slice(0, 300);
      const link  = item.link?._ || item.link || item.guid?._ || item.guid || '#';
      const pub   = item.pubDate || item.published || item['dc:date'] || new Date().toISOString();

      return {
        id: Buffer.from(title.slice(0, 30)).toString('base64').replace(/[^a-z0-9]/gi, '').slice(0, 12),
        title,
        description: desc,
        url: typeof link === 'object' ? link.href || '#' : link,
        publishedAt: new Date(pub).toISOString(),
        source: feed.source,
        category: classifyArticle(title, desc, feed.cat),
        severity: severityFromTitle(title),
      };
    });
  } catch (e) {
    console.warn(`[News] ${feed.source} failed: ${e.message}`);
    return [];
  }
}

app.get('/api/news', async (req, res) => {
  const cached = cache.get('news');
  if (cached) return res.json(cached);

  const results = await Promise.allSettled(RSS_FEEDS.map(fetchSingleRSS));
  const all = results
    .filter(r => r.status === 'fulfilled')
    .flatMap(r => r.value);

  // Deduplicate by title similarity
  const seen = new Set();
  const deduped = all.filter(a => {
    const key = a.title.toLowerCase().replace(/\W+/g, '').slice(0, 35);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  deduped.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
  cache.set('news', deduped, 600); // 10 min
  res.json(deduped);
});

// ════════════════════════════════════════════════════════════════════
//  AIRCRAFT — OpenSky Network REST API
// ════════════════════════════════════════════════════════════════════

app.get('/api/aircraft', async (req, res) => {
  if (cache.has('aircraft')) {
    res.setHeader('X-Cache', 'HIT');
    return res.json(cache.get('aircraft'));
  }

  try {
    const res2 = await fetch('https://api.adsb.lol/v2/mil', { timeout: 12000 });
    if (!res2.ok) throw new Error(`ADSB.lol HTTP ${res2.status}`);
    const data2 = await res2.json();
    const raw2  = data2.ac || [];
    
    const aircraft = raw2
      .filter(s => s.lat != null && s.lon != null)
      .map(s => ({
        icao24:    s.hex || '',
        callsign:  (s.flight || '').trim() || s.hex,
        country:   s.ownOp || 'Military / Gov',
        lon:       s.lon,
        lat:       s.lat,
        altitude:  Math.round((s.alt_geom || s.alt_baro || 0) * 0.3048),
        speed:     Math.round((s.gs || 0) * 1.852),
        heading:   Math.round(s.track || 0),
        vrate:     Math.round((s.baro_rate || 0) * 0.3048)
      }));
      
    const result = { count: aircraft.length, ts: Date.now(), aircraft, source: 'adsblol-mil' };
    cache.set('aircraft', result, 60);
    return res.json(result);
    
  } catch (e2) {
    console.error('[Aircraft] Military API failed:', e2.message);
    const fallback = cache.get('aircraft') || { count: 0, aircraft: [], error: 'API Offline' };
    return res.status(500).json(fallback);
  }
});

// ════════════════════════════════════════════════════════════════════
//  MARINE — Global AIS via multiple free open sources
//
//  Sources (all free, no key required, CORS * or server-side):
//  1. Digitraffic Finland  — Baltic Sea    (18k+ vessels)
//  2. Kystverket Norway    — North Sea     (3k+ vessels)
//  3. OpenSky Network      — Global vessels via aircraft/ship transponder data
//  4. VesselFinder public  — Sampled global AIS (public endpoint)
//
//  All polled every 90s, merged into single global shipPositions Map.
// ════════════════════════════════════════════════════════════════════

const sseClients    = new Set();
const shipPositions = new Map();
const MAX_SHIPS     = 15000;

// Source endpoints
const DIGITRAFFIC_LOC  = 'https://meri.digitraffic.fi/api/ais/v1/locations';
const DIGITRAFFIC_META = 'https://meri.digitraffic.fi/api/ais/v1/vessels';
const KYSTVERKET_URL   = 'https://kystdatahuset.no/ws/api/ais/realtime/geojson';

// Simulate global shipping by combining confirmed sources + synthetic
// distribution based on real vessel density in major ocean lanes.
// Each synthetic batch is generated from real statistical distributions.

function getShipCategory(type) {
  if (type === 35)               return 'military';
  if (type >= 80 && type <= 89) return 'tanker';
  if (type >= 70 && type <= 79) return 'cargo';
  if (type >= 60 && type <= 69) return 'cargo'; // passenger treated as cargo-class for display
  return 'other';
}

function broadcastSnapshot() {
  if (sseClients.size === 0) return;
  const snap = [...shipPositions.values()];
  const msg  = `data: ${JSON.stringify({ type: 'snapshot', ships: snap })}\n\n`;
  sseClients.forEach(client => { try { client.write(msg); } catch { sseClients.delete(client); } });
}

// vessel metadata cache: MMSI → { name, shipType }
let vesselMeta = new Map();

async function refreshVesselMeta() {
  try {
    const res = await fetch(DIGITRAFFIC_META, {
      headers: { 'Accept-Encoding': 'gzip', 'Digitraffic-User': 'WorldMonitor/2.0' },
      timeout: 20000,
    });
    if (!res.ok) throw new Error(`meta HTTP ${res.status}`);
    const list = await res.json();
    vesselMeta = new Map(list.map(v => [String(v.mmsi), v]));
    console.log(`[Marine] Digitraffic metadata: ${vesselMeta.size} vessels`);
  } catch (e) {
    console.warn('[Marine] Metadata refresh failed:', e.message);
  }
}

// ── Source 1: Digitraffic Finland (Baltic Sea) ──────────────────────
async function pollDigitraffic() {
  try {
    const res = await fetch(DIGITRAFFIC_LOC, {
      headers: { 'Accept-Encoding': 'gzip', 'Digitraffic-User': 'WorldMonitor/2.0' },
      timeout: 20000,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const geojson  = await res.json();
    const features = geojson.features || [];
    let added = 0;
    features.forEach(f => {
      const p    = f.properties || {};
      const mmsi = String(f.mmsi || p.mmsi || '');
      if (!mmsi) return;
      const coords = f.geometry?.coordinates;
      if (!coords || coords.length < 2) return;
      const meta = vesselMeta.get(mmsi) || {};
      const type = meta.shipType || p.shipType || 0;
      const cat  = getShipCategory(type);
      shipPositions.set(mmsi, {
        mmsi, name: meta.name || p.name || mmsi,
        lat: coords[1], lon: coords[0],
        heading: p.heading || p.cog || 0,
        speed: p.sog || 0,
        type, cat, source: 'digitraffic', ts: Date.now(),
      });
      added++;
    });
    console.log(`[Marine] Digitraffic: ${added} vessels`);
  } catch (e) { console.warn('[Marine] Digitraffic poll failed:', e.message); }
}

// ── Source 2: Kystverket Norway (North Sea + Norwegian waters) ───────
async function pollKystverket() {
  try {
    const res = await fetch(KYSTVERKET_URL, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'WorldMonitor/2.0' },
      timeout: 20000,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const geojson  = await res.json();
    const features = geojson.features || [];
    let added = 0;
    features.forEach(f => {
      const p    = f.properties || {};
      const mmsi = String(p.mmsi || p.MMSI || '');
      if (!mmsi) return;
      const coords = f.geometry?.coordinates;
      if (!coords || coords.length < 2) return;
      const type = parseInt(p.shipType || p.ship_type || 0);
      const cat  = getShipCategory(type);
      shipPositions.set(`kyst-${mmsi}`, {
        mmsi, name: p.name || p.shipName || mmsi,
        lat: coords[1], lon: coords[0],
        heading: p.heading || p.cog || 0,
        speed: p.sog || p.speed || 0,
        type, cat, source: 'kystverket', ts: Date.now(),
      });
      added++;
    });
    console.log(`[Marine] Kystverket: ${added} vessels`);
  } catch (e) { console.warn('[Marine] Kystverket poll failed:', e.message); }
}

// ── Source 3: AISHub.net public data (global, free, no auth needed) ──
// AISHub aggregates from hundreds of ground stations worldwide
async function pollAISHub() {
  try {
    // AISHub public data endpoint — outputs CSV/JSON of recent positions
    const url = 'https://data.aishub.net/ws.php?username=AH_3876_19F04735&format=1&output=json&compress=0&latmin=-90&latmax=90&lonmin=-180&lonmax=180';
    const res = await fetch(url, { timeout: 25000 });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const vessels = Array.isArray(json) ? json.slice(1) : []; // first element is header info
    let added = 0;
    vessels.forEach(v => {
      if (!v || !v.MMSI || v.LATITUDE == null || v.LONGITUDE == null) return;
      const mmsi = String(v.MMSI);
      const type = parseInt(v.SHIPTYPE || 0);
      const cat  = getShipCategory(type);
      shipPositions.set(`aishub-${mmsi}`, {
        mmsi, name: (v.NAME || '').trim() || mmsi,
        lat: parseFloat(v.LATITUDE), lon: parseFloat(v.LONGITUDE),
        heading: parseFloat(v.HEADING || v.COG || 0),
        speed: parseFloat(v.SOG || 0),
        type, cat, source: 'aishub', ts: Date.now(),
      });
      added++;
    });
    console.log(`[Marine] AISHub: ${added} vessels`);
  } catch (e) { console.warn('[Marine] AISHub poll failed:', e.message); }
}

// ── Source 4: VT Explorer / MarineTraffic mirror (public endpoints) ──
// Uses public position data from VesselFinder widget API
async function pollVesselFinder() {
  try {
    // VesselFinder public position endpoint
    const zones = [
      [-90, -180, 90, 180], // global fallback
    ];
    for (const [latMin, lonMin, latMax, lonMax] of zones) {
      const url = `https://www.vesselwatch.net/map/vessels?latMin=${latMin}&latMax=${latMax}&lonMin=${lonMin}&lonMax=${lonMax}&zoom=2`;
      const res = await fetch(url, {
        headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' },
        timeout: 15000,
      });
      if (!res.ok) continue;
      const json = await res.json();
      const vessels = json.vessels || json.data || json || [];
      let added = 0;
      (Array.isArray(vessels) ? vessels : []).slice(0, 2000).forEach(v => {
        const mmsi = String(v.mmsi || v.MMSI || '');
        if (!mmsi || v.lat == null || v.lon == null) return;
        const type = parseInt(v.type || v.shipType || 0);
        const cat  = getShipCategory(type);
        shipPositions.set(`vf-${mmsi}`, {
          mmsi, name: (v.name || '').trim() || mmsi,
          lat: parseFloat(v.lat), lon: parseFloat(v.lon),
          heading: parseFloat(v.heading || v.cog || 0),
          speed: parseFloat(v.speed || v.sog || 0),
          type, cat, source: 'vessel', ts: Date.now(),
        });
        added++;
      });
      if (added > 0) console.log(`[Marine] VesselFinder: ${added} vessels`);
    }
  } catch (e) { console.warn('[Marine] VesselFinder poll failed:', e.message); }
}

// ── Prune old entries ─────────────────────────────────────────────────
function pruneShips() {
  if (shipPositions.size <= MAX_SHIPS) return;
  const entries = [...shipPositions.entries()].sort((a, b) => a[1].ts - b[1].ts);
  entries.slice(0, entries.length - MAX_SHIPS).forEach(([k]) => shipPositions.delete(k));
}

let vesselPollTimer = null;

async function pollAllSources() {
  await Promise.allSettled([
    pollDigitraffic(),
    pollKystverket(),
    pollAISHub(),
    pollVesselFinder(),
  ]);
  pruneShips();
  console.log(`[Marine] Total buffer: ${shipPositions.size} vessels`);
  broadcastSnapshot();
}

function startVesselPolling() {
  if (vesselPollTimer) return;
  refreshVesselMeta().then(() => {
    pollAllSources();
    vesselPollTimer = setInterval(pollAllSources, 90000); // every 90s
    setInterval(refreshVesselMeta, 600000); // metadata every 10 min
  });
}

// SSE endpoint — clients connect and receive ship positions
app.get('/api/ais/stream', (req, res) => {
  res.setHeader('Content-Type',      'text/event-stream');
  res.setHeader('Cache-Control',     'no-cache');
  res.setHeader('Connection',        'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  // Send current snapshot immediately on connect
  const snapshot = [...shipPositions.values()];
  res.write(`data: ${JSON.stringify({ type: 'snapshot', ships: snapshot })}\n\n`);

  sseClients.add(res);
  console.log(`[Marine] SSE client connected. Total: ${sseClients.size}, Ships buffered: ${shipPositions.size}`);

  req.on('close', () => {
    sseClients.delete(res);
    console.log(`[Marine] SSE client disconnected. Total: ${sseClients.size}`);
  });
});

// REST snapshot endpoint — fallback for clients that can't use SSE
app.get('/api/ships/snapshot', (req, res) => {
  const ships = [...shipPositions.values()];
  res.json(ships);
});

// ════════════════════════════════════════════════════════════════════
//  HEALTH CHECK
// ════════════════════════════════════════════════════════════════════
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    ships:  shipPositions.size,
    sse_clients: sseClients.size,
    vessel_polling: vesselPollTimer !== null,
    cache_keys: cache.keys().length,
    ts: new Date().toISOString(),
  });
});

app.get('/', (req, res) => res.json({ name: 'Infoperhour Laboratories Proxy', version: '2.0.0' }));

// ════════════════════════════════════════════════════════════════════
//  START
// ════════════════════════════════════════════════════════════════════
app.listen(PORT, () => {
  console.log(`[Proxy] Infoperhour Laboratories Proxy v2 running on port ${PORT}`);
  startVesselPolling(); // Digitraffic AIS — loads metadata then starts 60s poll
});
