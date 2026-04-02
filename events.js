/**
 * events.js v3 — OSINT + Live Alert Data Layer
 * Sources: USGS Earthquakes, ReliefWeb, GDELT, FIRMS Fire, NASA EONET,
 *          GDACS Alerts, Proxy News, Internet outage detection
 */

const EVENTS = (() => {

  const CATS = {
    conflict:     { label: 'Conflict',     color: '#ff2244', glow: 'rgba(255,34,68,0.5)' },
    political:    { label: 'Political',    color: '#ffb300', glow: 'rgba(255,179,0,0.5)' },
    humanitarian: { label: 'Humanitarian', color: '#b060ff', glow: 'rgba(176,96,255,0.5)' },
    disaster:     { label: 'Disaster',     color: '#00f5ff', glow: 'rgba(0,245,255,0.5)' },
    economic:     { label: 'Economic',     color: '#00ff88', glow: 'rgba(0,255,136,0.5)' },
  };

  let mapEvents  = [];
  let newsItems  = [];
  const listeners = [];

  // ── Helpers ─────────────────────────────────────────────────────────
  function severityFromMag(mag) {
    if (mag >= 7.0) return 5; if (mag >= 6.0) return 4;
    if (mag >= 5.0) return 3; if (mag >= 4.0) return 2; return 1;
  }
  function makeid(s) { return (s || Math.random().toString(36)).slice(2, 12); }
  function timeAgo(date) {
    const sec = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (sec < 60) return `${sec}s ago`;
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h ago`;
    return `${Math.floor(hr/24)}d ago`;
  }

  function extractLocation(text, fallback) {
    const match = text.match(/\b(?:in|near|at|outside|targeting|strikes) ([A-Z][a-zA-Z\s\-]+?)(?:'s|,|\.|$)/);
    if (match && match[1].length > 2 && match[1].length < 30) {
      const loc = match[1].trim();
      if (!/The|This|A|An|It|He|She|They|Their/i.test(loc)) return loc;
    }
    return fallback || 'Global';
  }

  // ── USGS Earthquakes ────────────────────────────────────────────────
  async function fetchEarthquakes() {
    const res  = await fetch('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson',
      { signal: AbortSignal.timeout(12000) });
    const json = await res.json();
    return (json.features || []).map(f => {
      const p = f.properties, c = f.geometry.coordinates;
      const mag = p.mag || 0;
      return {
        id: f.id || makeid(),
        category: 'disaster',
        icon: '🔴',
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

  // ── NASA EONET — Active Events (fires, storms, volcanoes) ───────────
  async function fetchEONET() {
    try {
      const res  = await fetch('https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=60&days=7',
        { signal: AbortSignal.timeout(12000) });
      const json = await res.json();
      const events = [];

      (json.events || []).forEach(ev => {
        const geo = ev.geometry?.[0];
        if (!geo) return;
        const coords = geo.coordinates;
        let lat, lon;
        if (geo.type === 'Point') { lon = coords[0]; lat = coords[1]; }
        else if (geo.type === 'Polygon') {
          const pts = coords[0];
          lat = pts.reduce((s,p) => s + p[1], 0) / pts.length;
          lon = pts.reduce((s,p) => s + p[0], 0) / pts.length;
        }
        if (lat == null || lon == null) return;

        const typeId = ev.categories?.[0]?.id || '';
        let cat = 'disaster', icon = '⚠️', sev = 3;

        if (typeId === 'wildfires') {
          icon = '🔥'; sev = 4;
          events.push({
            id: String(ev.id),
            category: 'disaster', icon,
            headline: `🔥 WILDFIRE — ${ev.title}`,
            location: ev.title,
            lat, lon, severity: sev,
            time: new Date(geo.date || Date.now()),
            source: 'NASA EONET', url: ev.sources?.[0]?.url || 'https://eonet.gsfc.nasa.gov',
            description: `Active wildfire tracked by NASA EONET. Category: ${ev.categories?.[0]?.title}. Status: ${ev.status}.`,
          });
        } else if (typeId === 'severeStorms') {
          icon = '⛈'; sev = 4;
          events.push({
            id: String(ev.id),
            category: 'disaster', icon,
            headline: `⛈ SEVERE STORM — ${ev.title}`,
            location: ev.title,
            lat, lon, severity: sev,
            time: new Date(geo.date || Date.now()),
            source: 'NASA EONET', url: ev.sources?.[0]?.url || 'https://eonet.gsfc.nasa.gov',
            description: `Severe storm system tracked by NASA EONET. Real-time satellite monitoring.`,
          });
        } else if (typeId === 'volcanoes') {
          icon = '🌋'; sev = 4;
          events.push({
            id: String(ev.id),
            category: 'disaster', icon,
            headline: `🌋 VOLCANO — ${ev.title}`,
            location: ev.title,
            lat, lon, severity: sev,
            time: new Date(geo.date || Date.now()),
            source: 'NASA EONET', url: ev.sources?.[0]?.url || 'https://eonet.gsfc.nasa.gov',
            description: `Active volcanic activity. NASA Earth Observatory tracking.`,
          });
        } else if (typeId === 'floods') {
          icon = '🌊'; sev = 3;
          events.push({
            id: String(ev.id),
            category: 'disaster', icon,
            headline: `🌊 FLOOD — ${ev.title}`,
            location: ev.title,
            lat, lon, severity: sev,
            time: new Date(geo.date || Date.now()),
            source: 'NASA EONET', url: ev.sources?.[0]?.url || 'https://eonet.gsfc.nasa.gov',
            description: `Active flooding event. NASA EONET monitoring.`,
          });
        }
      });
      return events;
    } catch (e) {
      console.warn('[EONET] Failed:', e.message);
      return [];
    }
  }

  // ── GDACS — Global Disaster Alert & Coordination ────────────────────
  async function fetchGDACS() {
    try {
      const res  = await fetch('https://www.gdacs.org/gdacsapi/api/events/geteventlist/EVENTS?eventtype=EQ,TC,FL,VO,DR,WF&alertlevel=Green,Orange,Red&limit=30',
        { signal: AbortSignal.timeout(12000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const items = json.features || [];
      return items.map(f => {
        const p = f.properties || {};
        const c = f.geometry?.coordinates;
        const sev = p.alertlevel === 'Red' ? 5 : p.alertlevel === 'Orange' ? 4 : 2;
        const typeMap = { EQ:'🔴 Earthquake', TC:'🌀 Cyclone', FL:'🌊 Flood', VO:'🌋 Volcano', DR:'🏜️ Drought', WF:'🔥 Wildfire' };
        const icon = { EQ:'🔴', TC:'🌀', FL:'🌊', VO:'🌋', DR:'🏜️', WF:'🔥' }[p.eventtype] || '⚠️';
        return {
          id: `gdacs-${p.eventid || makeid()}`,
          category: 'disaster', icon,
          headline: `${icon} ${typeMap[p.eventtype] || p.eventtype} — ${p.name || p.country || 'Unknown'}`,
          location: p.country || p.name || 'Unknown',
          lat: c ? c[1] : null, lon: c ? c[0] : null,
          severity: sev,
          time: new Date(p.fromdate || Date.now()),
          source: 'GDACS',
          url: p.url?.report || 'https://gdacs.org',
          description: `${p.alertlevel || ''} alert. ${p.description || p.name || ''}. Affected: ${p.affectedcountries?.map(x=>x.countryname).join(', ') || p.country || 'N/A'}.`,
        };
      }).filter(e => e.lat != null && e.lon != null);
    } catch (e) {
      console.warn('[GDACS] Failed:', e.message);
      return [];
    }
  }

  // ── Internet Outage Events (NetBlocks / public feeds) ───────────────
  // Uses GDELT to surface internet/blackout/outage news with coordinates
  async function fetchInternetOutages() {
    try {
      const q = '(internet outage OR internet blackout OR power blackout OR power grid failure OR internet shutdown OR network outage)';
      const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(q)}&mode=artlist&maxrecords=15&format=json&timespan=1440min&sort=hybridrel`;
      const text = await (await fetch(url, { signal: AbortSignal.timeout(12000) })).text();
      if (!text.trim().startsWith('{')) return [];
      const json = JSON.parse(text);

      return (json.articles || []).slice(0, 12).map(a => {
        const title = a.title || 'Untitled';
        const isBlackout  = /power (outage|blackout|failure|cut|grid)/i.test(title);
        const isInternet  = /internet (outage|shutdown|blackout|disruption|blocked)/i.test(title);
        const icon  = isInternet ? '🌐' : isBlackout ? '⚡' : '⚠️';
        const cat   = isBlackout ? 'disaster' : 'political';
        const loc   = extractLocation(title, a.sourcecountry || 'Unknown');
        const crd   = lookupCoords(loc);

        return {
          id: makeid(a.url + 'io'),
          category: cat, icon,
          headline: `${icon} ${isInternet ? 'INTERNET OUTAGE' : isBlackout ? 'POWER BLACKOUT' : 'OUTAGE ALERT'} — ${title.slice(0, 80)}`,
          location: loc,
          lat: crd ? crd[0] : null,
          lon: crd ? crd[1] : null,
          severity: 3,
          time: a.seendate ? parseGDELTDate(a.seendate) : new Date(),
          source: a.domain || 'GDELT',
          url: a.url || 'https://gdeltproject.org',
          description: `Reported infrastructure disruption. Source: ${a.domain}.`,
        };
      }).filter(e => e.lat != null && e.lon != null);
    } catch (e) {
      console.warn('[Outages] Failed:', e.message);
      return [];
    }
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
      signal: AbortSignal.timeout(12000),
    });
    const json = await res.json();
    return (json.data || []).map(d => {
      const f = d.fields;
      const cc = f.country?.[0]?.iso3 || '';
      const coords = COUNTRY_COORDS[cc] || null;
      if (!coords) return null;
      const types = (f.type || []).map(t => t.name.toLowerCase());
      let cat = 'humanitarian', icon = '🆘';
      if (types.some(t => /quake|flood|cyclone|drought|tsunami|volcan/.test(t))) { cat = 'disaster'; icon = '⚠️'; }
      else if (types.some(t => /conflict|violence/.test(t))) { cat = 'conflict'; icon = '⚔️'; }
      return {
        id: String(d.id || makeid()),
        category: cat, icon,
        headline: `${icon} ${f.name || 'Humanitarian Event'}`,
        location: f.country?.[0]?.name || cc,
        lat: coords[0], lon: coords[1],
        severity: 3,
        time: new Date(f.date?.created || Date.now()),
        source: 'ReliefWeb',
        url: f.url || 'https://reliefweb.int',
        description: `Ongoing ${(f.type||[]).map(t=>t.name).join(', ')} in ${f.country?.[0]?.name||cc}. UN OCHA tracking.`,
      };
    }).filter(Boolean);
  }

  // ── GDELT Global Events ─────────────────────────────────────────────
  async function fetchGDELT() {
    const q = '(conflict OR military OR attack OR disaster OR sanctions OR ceasefire OR fire OR explosion OR protest OR blackout)';
    const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(q)}&mode=artlist&maxrecords=30&format=json&timespan=480min&sort=hybridrel`;
    const text = await (await fetch(url, { signal: AbortSignal.timeout(12000) })).text();
    if (!text || !text.trim().startsWith('{')) return [];
    const json = JSON.parse(text);

    return (json.articles || []).slice(0, 25).map(a => {
      const title = a.title || 'Untitled';
      const cat   = classifyGDELT(title);
      const icon  = iconForCat(cat, title);
      const loc   = extractLocation(title, a.sourcecountry || a.domain || 'Global');

      let lat = null, lon = null;
      if (a.geolocation) {
        lat = parseFloat(a.geolocation.lat); lon = parseFloat(a.geolocation.lon);
      } else {
        const crd = lookupCoords(loc);
        if (crd) { lat = crd[0]; lon = crd[1]; }
      }

      return {
        id: makeid(a.url),
        category: cat, icon,
        headline: title,
        location: loc,
        lat, lon,
        severity: classifySev(title),
        time: a.seendate ? parseGDELTDate(a.seendate) : new Date(),
        source: a.domain || 'GDELT',
        url: a.url || 'https://gdeltproject.org',
        description: `From ${a.domain||'global sources'}. Indexed by GDELT.`,
      };
    });
  }

  function iconForCat(cat, title) {
    if (/fire|wildfire|blaze/i.test(title))    return '🔥';
    if (/blackout|power (out|failure|cut)/i.test(title)) return '⚡';
    if (/internet|network (outage|down)/i.test(title))   return '🌐';
    if (/storm|thunder|cyclone|tornado/i.test(title))    return '⛈';
    if (/flood/i.test(title))   return '🌊';
    if (/earthquake/i.test(title)) return '🔴';
    if (/missile|bomb|airstrike|attack/i.test(title)) return '💥';
    if (cat === 'conflict')     return '⚔️';
    if (cat === 'disaster')     return '⚠️';
    if (cat === 'humanitarian') return '🆘';
    if (cat === 'economic')     return '📉';
    return '📌';
  }

  function classifyGDELT(t) {
    if (/attack|war|military|missile|bomb|shoot|troops|army|strike|ceasefire|airstrike/i.test(t)) return 'conflict';
    if (/election|president|congress|senate|vote|diplomat|sanction|parliament|coup/i.test(t))    return 'political';
    if (/refugee|hunger|aid|humanitarian|displaced|famine/i.test(t))  return 'humanitarian';
    if (/earthquake|flood|fire|cyclone|hurricane|tsunami|volcano|disaster|drought|blackout|storm/i.test(t)) return 'disaster';
    if (/economy|market|trade|gdp|bank|inflation|tariff|export|deal|merger/i.test(t)) return 'economic';
    return 'political';
  }
  function classifySev(t) {
    if (/nuclear|catastrophic|massacre|genocide|category [45]|8\.\d magnitude|assassinat|icbm|carrier strike/i.test(t)) return 5;
    if (/dozens killed|hundreds|major|emergency|invasion|hypersonic|ballistic|terrorist|ambush/i.test(t)) return 4;
    if (/killed|dead|attack|strike|launched|escalat|bomb|drone|missile|destroy|casualties|blackout|outage/i.test(t)) return 3;
    if (/concern|tension|warning|protest|sanction|deploy|threat|standoff/i.test(t)) return 2;
    return 1;
  }
  function parseGDELTDate(s) {
    try { return new Date(`${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}T${s.slice(9,11)}:${s.slice(11,13)}:${s.slice(13,15)}Z`); }
    catch { return new Date(); }
  }

  // ── Proxy News ──────────────────────────────────────────────────────
  async function fetchProxyNews() {
    const res  = await fetch(`${CONFIG.PROXY_URL}/api/news`, { signal: AbortSignal.timeout(15000) });
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  }

  // ── Country / City coords ───────────────────────────────────────────
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
    LKA:[7.9,80.8],MMR:[16.9,96.2],MYS:[4.2,108.0],SGP:[1.35,103.8],
    PHL:[12.9,121.8],BGD:[23.7,90.4],NPL:[28.4,84.1],MDG:[-20.0,46.9],
  };

  const CITY_COORDS = {
    'Kyiv':[50.45,30.52],'Moscow':[55.75,37.6],'Washington':[38.9,-77.0],
    'London':[51.5,-0.1],'Paris':[48.8,2.3],'Beijing':[39.9,116.4],
    'Tehran':[35.68,51.38],'Jerusalem':[31.7,35.2],'Tel Aviv':[32.0,34.7],
    'Gaza':[31.5,34.4],'Beirut':[33.89,35.5],'Damascus':[33.51,36.29],
    'Baghdad':[33.31,44.36],'Kabul':[34.55,69.2],'Taipei':[25.0,121.5],
    'Seoul':[37.56,126.97],'Pyongyang':[39.03,125.75],'Tokyo':[35.67,139.65],
    'Brussels':[50.85,4.35],'Berlin':[52.52,13.4],'Geneva':[46.2,6.1],
    'New York':[40.7,-74.0],'Delhi':[28.61,77.2],'Islamabad':[33.68,73.04],
    'Riyadh':[24.71,46.67],'Dubai':[25.2,55.27],'Sanaa':[15.36,44.19],
    'Khartoum':[15.5,32.55],'Mogadishu':[2.04,45.34],'Kinshasa':[-4.44,15.26],
    'Caracas':[10.48,-66.9],'Bogota':[4.71,-74.07],'Havana':[23.11,-82.36],
    'Manila':[14.59,120.98],'Jakarta':[-6.2,106.8],'Myanmar':[16.8,96.1],
    'Muscat':[23.58,58.40],'Middle East':[31.0,35.0],'Europe':[48.0,10.0],
    'USA':[38.0,-97.0],'Russia':[60.0,90.0],'China':[35.0,105.0],
    'Ukraine':[48.37,31.16],'Iran':[32.42,53.68],'Israel':[31.04,34.85],
    'Lebanon':[33.85,35.86],'Pakistan':[30.37,69.34],'Saudi Arabia':[23.88,45.07],
    'California':[36.7,-119.4],'Texas':[31.0,-99.0],'Florida':[27.6,-81.5],
    'Los Angeles':[34.05,-118.24],'Chicago':[41.87,-87.62],'Houston':[29.76,-95.37],
    'San Francisco':[37.77,-122.42],'Seattle':[47.6,-122.3],'Miami':[25.77,-80.19],
    'Toronto':[43.7,-79.4],'Mexico City':[19.43,-99.13],'Sao Paulo':[-23.55,-46.63],
    'Buenos Aires':[-34.6,-58.38],'Sydney':[-33.86,151.2],'Melbourne':[-37.81,144.96],
    'Cape Town':[-33.9,18.4],'Lagos':[6.52,3.37],'Nairobi':[-1.29,36.82],
    'Cairo':[30.04,31.23],'Johannesburg':[-26.2,28.0],'Addis Ababa':[9.02,38.74],
    'Tripoli':[32.9,13.18],'Tunis':[36.8,10.18],'Casablanca':[33.59,-7.62],
    'Kabul':[34.55,69.2],'Karachi':[24.86,67.0],'Lahore':[31.55,74.35],
    'Mumbai':[19.07,72.87],'Dhaka':[23.81,90.41],'Colombo':[6.93,79.84],
    'Bangkok':[13.75,100.5],'Ho Chi Minh City':[10.82,106.63],'Hanoi':[21.02,105.84],
    'Kuala Lumpur':[3.14,101.69],'Singapore':[1.35,103.8],'Hong Kong':[22.3,114.1],
    'Shanghai':[31.23,121.47],'Shenzhen':[22.54,114.06],'Wuhan':[30.58,114.27],
    'Chengdu':[30.67,104.07],'Ulaanbaatar':[47.9,106.9],'Kathmandu':[27.7,85.32],
    'Colombo':[6.93,79.84],'Yangon':[16.87,96.15],'Phnom Penh':[11.57,104.92],
    'Vientiane':[17.97,102.6],'Tbilisi':[41.69,44.83],'Baku':[40.41,49.87],
    'Yerevan':[40.18,44.51],'Tashkent':[41.3,69.27],'Almaty':[43.25,76.94],
    'Minsk':[53.9,27.57],'Warsaw':[52.2,21.0],'Bucharest':[44.43,26.10],
    'Budapest':[47.5,19.04],'Prague':[50.08,14.43],'Vienna':[48.2,16.37],
    'Rome':[41.9,12.5],'Madrid':[40.4,-3.7],'Barcelona':[41.39,2.16],
    'Athens':[37.9,23.7],'Istanbul':[41.0,28.97],'Ankara':[39.9,32.8],
    'Stockholm':[59.33,18.07],'Oslo':[59.91,10.75],'Copenhagen':[55.68,12.57],
    'Amsterdam':[52.37,4.9],'Brussels':[50.85,4.35],'Zurich':[47.38,8.54],
    'Kyiv':[50.45,30.52],'Odessa':[46.48,30.72],'Kharkiv':[49.99,36.25],
  };

  function lookupCoords(name) {
    if (!name) return null;
    const key = Object.keys(CITY_COORDS).find(k => name.toLowerCase().includes(k.toLowerCase()));
    if (key) return CITY_COORDS[key];
    const cc = Object.keys(COUNTRY_COORDS).find(k => name.toUpperCase().startsWith(k));
    if (cc) return COUNTRY_COORDS[cc];
    return null;
  }

  // ── Public API ───────────────────────────────────────────────────────
  async function fetchAll() {
    const [quakes, eonet, gdacs, relief, gdelt, outages, proxyNews] = await Promise.allSettled([
      fetchEarthquakes(),
      fetchEONET(),
      fetchGDACS(),
      fetchReliefWeb(),
      fetchGDELT(),
      fetchInternetOutages(),
      fetchProxyNews(),
    ]);

    const events = [
      ...(quakes.value    || []),
      ...(eonet.value     || []),
      ...(gdacs.value     || []),
      ...(relief.value    || []),
      ...(gdelt.value     || []),
      ...(outages.value   || []),
    ].filter(Boolean);

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

  function getAll()        { return mapEvents; }
  function getNews()       { return newsItems; }
  function onUpdate(fn)    { listeners.push(fn); }
  function getCategories() { return CATS; }
  function timeAgoFn(d)    { return timeAgo(d); }

  return { fetchAll, getAll, getNews, onUpdate, getCategories, timeAgoFn };
})();
