/**
 * Infoperhour Laboratories Proxy Server
 * Handles: News RSS aggregation, OpenSky aircraft data, AISStream WebSocket → SSE
 */

require('dotenv').config();
const express  = require('express');
const cors     = require('cors');
const fetch    = require('node-fetch');
const { parseStringPromise } = require('xml2js');
const NodeCache = require('node-cache');
const WebSocket = require('ws');

const app   = express();
const PORT  = process.env.PORT || 3001;
const cache = new NodeCache({ stdTTL: 0, checkperiod: 60 });

app.use(cors({ origin: '*' }));
app.use(express.json());

// ════════════════════════════════════════════════════════════════════
//  NEWS RSS AGGREGATION
// ════════════════════════════════════════════════════════════════════

const RSS_FEEDS = [
  // ── Google News keyword searches (conflict/geo/disaster buckets) ────
  { url: 'https://news.google.com/rss/search?q=war+conflict+military+airstrike+troops+attack&hl=en-US&gl=US&ceid=US:en',            source: 'Google News', cat: 'conflict' },
  { url: 'https://news.google.com/rss/search?q=ceasefire+assault+siege+bombardment+offensive&hl=en-US&gl=US&ceid=US:en',            source: 'Google News', cat: 'conflict' },
  { url: 'https://news.google.com/rss/search?q=sanctions+diplomacy+coup+protest+NATO+UN+crisis&hl=en-US&gl=US&ceid=US:en',          source: 'Google News', cat: 'political' },
  { url: 'https://news.google.com/rss/search?q=earthquake+flood+hurricane+cyclone+wildfire+tsunami&hl=en-US&gl=US&ceid=US:en',      source: 'Google News', cat: 'disaster' },
  { url: 'https://news.google.com/rss/search?q=refugees+famine+aid+humanitarian+displacement+UNHCR&hl=en-US&gl=US&ceid=US:en',      source: 'Google News', cat: 'humanitarian' },
  { url: 'https://news.google.com/rss/search?q=global+economy+trade+sanctions+tariff+inflation+bank&hl=en-US&gl=US&ceid=US:en',     source: 'Google News', cat: 'economic' },

  // ── US Broadcast Networks (mirror of MTS live TV sources) ──────────
  { url: 'https://feeds.nbcnews.com/nbcnews/public/world',                   source: 'NBC News',    cat: null },
  { url: 'https://rss.cnn.com/rss/edition_world.rss',                        source: 'CNN',         cat: null },
  { url: 'https://www.cbsnews.com/latest/rss/world',                         source: 'CBS News',    cat: null },
  { url: 'https://abcnews.go.com/abcnews/internationalheadlines',             source: 'ABC News',    cat: null },
  { url: 'https://feeds.foxnews.com/foxnews/world',                          source: 'Fox News',    cat: null },
  { url: 'https://www.newsmax.com/rss/Politics/1/',                           source: 'Newsmax',     cat: 'political' },
  { url: 'https://feeds.bloomberg.com/politics/news.rss',                    source: 'Bloomberg',   cat: 'political' },

  // ── International Broadcasters (mirror of MTS live TV sources) ─────
  { url: 'https://feeds.bbci.co.uk/news/world/rss.xml',                      source: 'BBC World',   cat: null },
  { url: 'https://www.aljazeera.com/xml/rss/all.xml',                        source: 'Al Jazeera',  cat: null },
  { url: 'https://www.france24.com/en/rss',                                  source: 'France 24',   cat: null },
  { url: 'https://rss.dw.com/rss/en-all',                                    source: 'DW News',     cat: null },
  { url: 'https://feeds.skynews.com/feeds/rss/world.rss',                    source: 'Sky News',    cat: null },
  { url: 'https://www3.nhk.or.jp/rss/news/cat0.xml',                         source: 'NHK World',   cat: null },
  { url: 'https://www.i24news.tv/en/rss',                                    source: 'i24 News',    cat: null },
  { url: 'https://www.iranintl.com/en/rss.xml',                              source: 'Iran Intl',   cat: null },

  // ── Wire services & aggregators ─────────────────────────────────────
  { url: 'https://feeds.reuters.com/reuters/worldNews',                      source: 'Reuters',     cat: null },
  { url: 'https://apnews.com/rss/world-news',                                source: 'AP News',     cat: null },
  { url: 'https://www.theguardian.com/world/rss',                            source: 'The Guardian',cat: null },
  { url: 'https://www.euronews.com/rss',                                     source: 'Euronews',    cat: null },
  { url: 'https://www.rfi.fr/en/rss',                                        source: 'RFI',         cat: null },

  // ── Defence / Conflict specialists ──────────────────────────────────
  { url: 'https://www.defensenews.com/arc/outboundfeeds/rss/',               source: 'Defense News',cat: 'conflict' },
  { url: 'https://www.janes.com/feeds/news',                                 source: 'Janes',       cat: 'conflict' },
  { url: 'https://www.militarytimes.com/arc/outboundfeeds/rss/',             source: 'Military Times', cat: 'conflict' },
  { url: 'https://taskandpurpose.com/feed/',                                  source: 'Task & Purpose', cat: 'conflict' },

  // ── Region-specific wires ────────────────────────────────────────────
  { url: 'https://www.timesofisrael.com/feed/',                              source: 'Times of Israel', cat: null },
  { url: 'https://english.alarabiya.net/tools/rss',                          source: 'Al Arabiya',  cat: null },
  { url: 'https://www.kyivindependent.com/feed/',                            source: 'Kyiv Independent', cat: 'conflict' },
  { url: 'https://www.themoscowtimes.com/rss/news',                          source: 'Moscow Times',cat: null },
  { url: 'https://timesofindia.indiatimes.com/rssfeeds/296589292.cms',       source: 'Times of India', cat: null },
  { url: 'https://www.scmp.com/rss/91/feed',                                 source: 'SCMP',        cat: null },

  // ── Disaster / Climate ───────────────────────────────────────────────
  { url: 'https://reliefweb.int/updates/rss.xml',                            source: 'ReliefWeb',   cat: 'humanitarian' },
  { url: 'https://www.gdacs.org/xml/rss.xml',                                source: 'GDACS',       cat: 'disaster' },
];

const CONFLICT_KEYWORDS   = /\b(war|attack|killed|dead|troops|military|missile|bomb|airstrike|strike|assault|offensive|conflict|ceasefire|siege|battle|fighting|gunfire|explosion|troops|navy|forces|weapons|drone)\b/i;
const POLITICAL_KEYWORDS  = /\b(election|president|prime minister|sanctions|diplomacy|treaty|parliament|congress|coup|protest|rally|vote|government|minister|senate|UN|NATO|treaty)\b/i;
const HUMANITARIAN_KWORDS = /\b(refugee|displaced|famine|hunger|aid|humanitarian|evacuation|shelter|UN\w+|UNHCR|crisis|civilian|fleeing)\b/i;
const DISASTER_KEYWORDS   = /\b(earthquake|magnitude|flood|flooding|hurricane|typhoon|cyclone|wildfire|fire|tsunami|eruption|volcano|drought|storm|tornado)\b/i;
const ECONOMIC_KEYWORDS   = /\b(economy|inflation|trade|sanction|tariff|gdp|bank|currency|market|recession|export|import|oil price|energy|gas price)\b/i;

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
//  AIS STREAM — WebSocket → Server-Sent Events
// ════════════════════════════════════════════════════════════════════

const sseClients    = new Set();             // active SSE response objects
const shipPositions = new Map();             // MMSI → ship data (rolling buffer)
const MAX_SHIPS     = 3000;

function getShipCategory(type) {
  if (type === 35)                   return 'military';
  if (type >= 80 && type <= 89)      return 'tanker';
  return 'other';
}

function broadcastToSSE(payload) {
  const msg = `data: ${JSON.stringify(payload)}\n\n`;
  sseClients.forEach(res => {
    try { res.write(msg); }
    catch { sseClients.delete(res); }
  });
}

let aisWs = null;
let aisReconnectTimer = null;

function initAISStream() {
  const apiKey = process.env.AISSTREAM_API_KEY;
  if (!apiKey) {
    console.warn('[AIS] No AISSTREAM_API_KEY set — marine layer disabled');
    return;
  }

  if (aisWs && (aisWs.readyState === WebSocket.OPEN || aisWs.readyState === WebSocket.CONNECTING)) return;

  console.log('[AIS] Connecting to AISStream…');
  aisWs = new WebSocket('wss://stream.aisstream.io/v0/stream');

  aisWs.on('open', () => {
    console.log('[AIS] Connected. Subscribing to global position reports…');
    aisWs.send(JSON.stringify({
      APIKey: apiKey,
      BoundingBoxes: [[[-90, -180], [90, 180]]],
      FilterMessageTypes: ['PositionReport'],
    }));
  });

  aisWs.on('message', rawData => {
    try {
      const msg = JSON.parse(rawData.toString());
      if (!msg.Message?.PositionReport) return;

      const pr   = msg.Message.PositionReport;
      const meta = msg.MetaData || {};

      if (pr.Latitude == null || pr.Longitude == null) return;
      if (Math.abs(pr.Latitude) > 90 || Math.abs(pr.Longitude) > 180) return;

      const mmsi = String(meta.MMSI || pr.UserID || 0);
      const cat = getShipCategory(meta.ShipType || 0);
      if (cat !== 'military' && cat !== 'tanker') return; // User implicitly filtered

      const ship = {
        mmsi,
        name:     (meta.ShipName || '').trim() || mmsi,
        lat:      pr.Latitude,
        lon:      pr.Longitude,
        heading:  pr.TrueHeading !== 511 ? pr.TrueHeading : (pr.CourseOverGround || 0),
        speed:    pr.SpeedOverGround || 0,
        status:   pr.NavigationalStatus,
        type:     meta.ShipType || 0,
        cat,
        ts:       Date.now(),
      };

      shipPositions.set(mmsi, ship);

      // Trim buffer if overflowing
      if (shipPositions.size > MAX_SHIPS) {
        const oldest = [...shipPositions.entries()]
          .sort((a, b) => a[1].ts - b[1].ts)
          .slice(0, 300)
          .map(e => e[0]);
        oldest.forEach(k => shipPositions.delete(k));
      }

      broadcastToSSE(ship);
    } catch { /* ignore parse errors */ }
  });

  aisWs.on('close', (code, reason) => {
    console.log(`[AIS] Disconnected (${code}) — reconnecting in 8s`);
    aisWs = null;
    clearTimeout(aisReconnectTimer);
    aisReconnectTimer = setTimeout(initAISStream, 8000);
  });

  aisWs.on('error', err => {
    console.error('[AIS] WebSocket error:', err.message);
    aisWs?.terminate();
  });
}

// SSE endpoint — clients connect here to receive ship positions
app.get('/api/ais/stream', (req, res) => {
  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Important for Nginx/Render
  res.flushHeaders();

  // Send current snapshot so client isn't empty on connect
  const snapshot = [...shipPositions.values()];
  if (snapshot.length > 0) {
    res.write(`data: ${JSON.stringify({ type: 'snapshot', ships: snapshot })}\n\n`);
  } else {
    res.write(`data: ${JSON.stringify({ type: 'snapshot', ships: [] })}\n\n`);
  }

  sseClients.add(res);
  console.log(`[AIS] SSE client connected. Total: ${sseClients.size}, Ships buffered: ${shipPositions.size}`);

  req.on('close', () => {
    sseClients.delete(res);
    console.log(`[AIS] SSE client disconnected. Total: ${sseClients.size}`);
  });
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
    ais_connected: aisWs?.readyState === WebSocket.OPEN,
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
  initAISStream();
});
