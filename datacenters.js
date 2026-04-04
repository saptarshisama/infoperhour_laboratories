/**
 * datacenters.js — Global Data Center Overlay
 * Top ~100 data centers by traffic/capacity (Cloudscene, DC Byte, DatacenterHawk)
 * Tier 1 hyperscaler campuses (AWS, Azure, GCP, Meta, Alibaba, etc.)
 */

const DATACENTERS = (() => {

  let leafletMap = null;
  let enabled    = false;
  const markers  = [];

  // Tier classification
  // T1 = Hyperscaler mega campus (AWS, Azure, GCP, Meta, Alibaba, ByteDance)
  // T2 = Major colo/enterprise hub (Equinix, Digital Realty, NTT, CyrusOne)
  // T3 = Regional hub

  const DC_DATA = [
    // ── UNITED STATES — NORTHERN VIRGINIA (Largest DC cluster on Earth) ─
    { name: 'AWS us-east-1 (Ashburn)',     lat: 38.99, lon: -77.45, tier: 1, operator: 'Amazon AWS',       traffic: 'Tier 1 — Hyperscale' },
    { name: 'Azure East US (Boydton)',      lat: 36.67, lon: -78.39, tier: 1, operator: 'Microsoft Azure',  traffic: 'Tier 1 — Hyperscale' },
    { name: 'GCP us-east4 (Ashburn)',       lat: 38.95, lon: -77.49, tier: 1, operator: 'Google Cloud',    traffic: 'Tier 1 — Hyperscale' },
    { name: 'Equinix DC (Ashburn)',         lat: 39.04, lon: -77.49, tier: 2, operator: 'Equinix',         traffic: 'Tier 2 — Hyperscale colocation' },
    { name: 'QTS Northern Virginia',        lat: 38.89, lon: -77.44, tier: 2, operator: 'QTS',             traffic: 'Tier 2' },
    { name: 'CyrusOne N. Virginia',         lat: 38.88, lon: -77.42, tier: 2, operator: 'CyrusOne',        traffic: 'Tier 2' },

    // ── US — WEST COAST ─────────────────────────────────────────────────
    { name: 'AWS us-west-2 (Oregon)',       lat: 45.52, lon: -122.68, tier: 1, operator: 'Amazon AWS',      traffic: 'Tier 1 — Hyperscale' },
    { name: 'GCP us-west1 (The Dalles)',    lat: 45.60, lon: -121.19, tier: 1, operator: 'Google Cloud',   traffic: 'Tier 1 — Hyperscale' },
    { name: 'Meta Prineville',              lat: 44.30, lon: -120.84, tier: 1, operator: 'Meta',            traffic: 'Tier 1 — Hyperscale' },
    { name: 'Equinix Los Angeles (LA)',     lat: 34.05, lon: -118.24, tier: 2, operator: 'Equinix',        traffic: 'Tier 2 — Major colocation hub' },
    { name: 'CoreSite Los Angeles',         lat: 34.04, lon: -118.37, tier: 2, operator: 'CoreSite',       traffic: 'Tier 2' },
    { name: 'Switch SuperNAP Las Vegas',    lat: 36.19, lon: -115.17, tier: 2, operator: 'Switch',         traffic: 'Tier 2' },
    { name: 'Equinix San Jose (SV)',        lat: 37.34, lon: -121.89, tier: 2, operator: 'Equinix',        traffic: 'Tier 2 — Hyperscale colocation' },
    { name: 'Digital Realty San Francisco', lat: 37.77, lon: -122.41, tier: 2, operator: 'Digital Realty', traffic: 'Tier 2' },

    // ── US — CENTRAL / SOUTH ────────────────────────────────────────────
    { name: 'AWS us-east-2 (Columbus OH)',  lat: 40.00, lon: -82.99, tier: 1, operator: 'Amazon AWS',      traffic: 'Tier 1 — Hyperscale' },
    { name: 'Azure North Central (Chicago)',lat: 41.88, lon: -87.63, tier: 1, operator: 'Microsoft Azure', traffic: 'Tier 1 — Hyperscale' },
    { name: 'Equinix Chicago (CH)',         lat: 41.87, lon: -87.63, tier: 2, operator: 'Equinix',        traffic: 'Major Midwest hub' },
    { name: 'Equinix Dallas (DA)',          lat: 32.79, lon: -96.80, tier: 2, operator: 'Equinix',        traffic: 'Tier 2' },
    { name: 'CyrusOne Dallas',              lat: 32.90, lon: -97.01, tier: 2, operator: 'CyrusOne',       traffic: 'Tier 2' },
    { name: 'AWS us-gov (Iowa)',            lat: 42.03, lon: -93.65, tier: 1, operator: 'Amazon AWS',      traffic: 'Tier 1 — Gov cloud' },

    // ── US — NEW YORK ────────────────────────────────────────────────────
    { name: 'Equinix New York (NY)',        lat: 40.71, lon: -74.01, tier: 2, operator: 'Equinix',        traffic: 'Major financial hub' },
    { name: 'Digital Realty New York',      lat: 40.75, lon: -73.99, tier: 2, operator: 'Digital Realty', traffic: 'Tier 2' },

    // ── EUROPE ───────────────────────────────────────────────────────────
    { name: 'AWS eu-west-1 (Dublin)',       lat: 53.35, lon: -6.27, tier: 1, operator: 'Amazon AWS',       traffic: 'Tier 1 — Hyperscale' },
    { name: 'Azure North Europe (Dublin)',  lat: 53.30, lon: -6.33, tier: 1, operator: 'Microsoft Azure',  traffic: 'Tier 1 — Hyperscale' },
    { name: 'GCP europe-west1 (Belgium)',   lat: 50.45, lon: 3.82,  tier: 1, operator: 'Google Cloud',    traffic: 'Tier 1 — Hyperscale' },
    { name: 'AWS eu-central-1 (Frankfurt)',  lat: 50.11, lon: 8.68,  tier: 1, operator: 'Amazon AWS',      traffic: 'Tier 1 — Hyperscale' },
    { name: 'Equinix Frankfurt (FR)',       lat: 50.10, lon: 8.65,  tier: 2, operator: 'Equinix',         traffic: 'Tier 2 — Major colocation hub' },
    { name: 'DE-CIX Frankfurt',            lat: 50.12, lon: 8.71,  tier: 2, operator: 'DE-CIX',          traffic: 'Tier 2 — Major peering & colocation hub' },
    { name: 'Azure West Europe (Amsterdam)',lat: 52.37, lon: 4.90,  tier: 1, operator: 'Microsoft Azure',  traffic: 'Tier 1 — Hyperscale' },
    { name: 'AMS-IX Amsterdam',            lat: 52.37, lon: 4.89,  tier: 2, operator: 'AMS-IX',          traffic: 'Tier 2 — Major colocation hub' },
    { name: 'Equinix Amsterdam (AM)',       lat: 52.37, lon: 4.88,  tier: 2, operator: 'Equinix',         traffic: 'Major European hub' },
    { name: 'AWS eu-west-2 (London)',       lat: 51.51, lon: -0.12, tier: 1, operator: 'Amazon AWS',       traffic: 'Tier 1 — Hyperscale' },
    { name: 'Equinix London (LD)',          lat: 51.52, lon: -0.09, tier: 2, operator: 'Equinix',         traffic: 'Major European hub' },
    { name: 'LINX London',                 lat: 51.51, lon: -0.11, tier: 2, operator: 'LINX',             traffic: 'Tier 2 — Major colocation hub' },
    { name: 'AWS eu-south-1 (Milan)',       lat: 45.46, lon: 9.19,  tier: 1, operator: 'Amazon AWS',       traffic: 'Tier 1 — Hyperscale' },
    { name: 'Azure France Central (Paris)', lat: 48.86, lon: 2.34,  tier: 1, operator: 'Microsoft Azure',  traffic: 'Tier 1 — Hyperscale' },
    { name: 'Equinix Paris (PA)',           lat: 48.86, lon: 2.32,  tier: 2, operator: 'Equinix',         traffic: 'Tier 2' },
    { name: 'AWS eu-north-1 (Stockholm)',   lat: 59.33, lon: 18.07, tier: 1, operator: 'Amazon AWS',       traffic: 'Tier 1 — Hyperscale' },
    { name: 'Google Hamina (Finland)',      lat: 60.57, lon: 27.18, tier: 1, operator: 'Google Cloud',    traffic: 'Tier 1 — Hyperscale' },
    { name: 'Meta Lulea (Sweden)',          lat: 65.58, lon: 22.15, tier: 1, operator: 'Meta',             traffic: 'Tier 1 — Arctic cooling' },
    { name: 'AWS eu-west-3 (Warsaw)',       lat: 52.22, lon: 21.01, tier: 1, operator: 'Amazon AWS',       traffic: 'Tier 1 — Hyperscale' },
    { name: 'Equinix Madrid (MD)',          lat: 40.42, lon: -3.70, tier: 2, operator: 'Equinix',         traffic: 'Tier 2' },

    // ── MIDDLE EAST ──────────────────────────────────────────────────────
    { name: 'AWS me-south-1 (Bahrain)',     lat: 26.22, lon: 50.59, tier: 1, operator: 'Amazon AWS',       traffic: 'Tier 1 — Hyperscale' },
    { name: 'Azure UAE North (Dubai)',      lat: 25.20, lon: 55.27, tier: 1, operator: 'Microsoft Azure',  traffic: 'Tier 1 — Hyperscale' },
    { name: 'GCP me-west1 (Tel Aviv)',      lat: 32.09, lon: 34.78, tier: 1, operator: 'Google Cloud',    traffic: 'Tier 1 — Hyperscale' },
    { name: 'Equinix Dubai (DX)',           lat: 25.22, lon: 55.29, tier: 2, operator: 'Equinix',         traffic: 'Middle East hub' },
    { name: 'du datacenters (Dubai)',       lat: 25.20, lon: 55.26, tier: 2, operator: 'du Telecom',      traffic: 'Tier 2' },
    { name: 'STC Riyadh',                  lat: 24.70, lon: 46.73, tier: 2, operator: 'STC',              traffic: 'Tier 2 — Regional colocation hub' },

    // ── ASIA PACIFIC ─────────────────────────────────────────────────────
    { name: 'AWS ap-southeast-1 (Singapore)',lat: 1.35, lon: 103.82, tier: 1, operator: 'Amazon AWS',      traffic: 'Tier 1 — Hyperscale' },
    { name: 'GCP asia-southeast1 (Singapore)',lat:1.34,lon: 103.80, tier: 1, operator: 'Google Cloud',    traffic: 'Tier 1 — Hyperscale' },
    { name: 'Equinix Singapore (SG)',       lat: 1.36,  lon: 103.82, tier: 2, operator: 'Equinix',        traffic: 'Tier 2 — Major APAC colocation hub' },
    { name: 'SGIX Singapore',              lat: 1.35,  lon: 103.81, tier: 2, operator: 'SGIX',            traffic: 'Tier 2 — Regional peering hub' },
    { name: 'AWS ap-northeast-1 (Tokyo)',   lat: 35.69, lon: 139.70, tier: 1, operator: 'Amazon AWS',      traffic: 'Tier 1 — Hyperscale' },
    { name: 'GCP asia-northeast1 (Tokyo)',  lat: 35.67, lon: 139.68, tier: 1, operator: 'Google Cloud',   traffic: 'Tier 1 — Hyperscale' },
    { name: 'Equinix Tokyo (TY)',           lat: 35.66, lon: 139.72, tier: 2, operator: 'Equinix',        traffic: 'Major APAC hub' },
    { name: 'JPIX Tokyo',                  lat: 35.70, lon: 139.71, tier: 2, operator: 'JPIX',            traffic: 'Tier 2 — Regional peering hub' },
    { name: 'AWS ap-northeast-2 (Seoul)',   lat: 37.57, lon: 126.98, tier: 1, operator: 'Amazon AWS',      traffic: 'Tier 1 — Hyperscale' },
    { name: 'Azure Korea Central (Seoul)',  lat: 37.56, lon: 126.97, tier: 1, operator: 'Microsoft Azure', traffic: 'Tier 1 — Hyperscale' },
    { name: 'KT Cloud Seoul',              lat: 37.55, lon: 126.96, tier: 2, operator: 'KT Corp',         traffic: 'Tier 2 — Regional colocation hub' },
    { name: 'AWS ap-east-1 (Hong Kong)',    lat: 22.32, lon: 114.17, tier: 1, operator: 'Amazon AWS',      traffic: 'Tier 1 — Hyperscale' },
    { name: 'Equinix Hong Kong (HK)',       lat: 22.30, lon: 114.18, tier: 2, operator: 'Equinix',        traffic: 'Major APAC hub' },
    { name: 'HKIX Hong Kong',              lat: 22.31, lon: 114.16, tier: 2, operator: 'HKIX',            traffic: 'Tier 2 — Regional peering hub' },
    { name: 'GCP asia-east1 (Taiwan)',      lat: 24.94, lon: 121.37, tier: 1, operator: 'Google Cloud',   traffic: 'Tier 1 — Hyperscale' },
    { name: 'Azure East Asia (Taipei)',     lat: 25.05, lon: 121.53, tier: 1, operator: 'Microsoft Azure', traffic: 'Tier 1 — Hyperscale' },
    { name: 'AWS ap-southeast-2 (Sydney)',  lat: -33.87,lon: 151.21, tier: 1, operator: 'Amazon AWS',      traffic: 'Tier 1 — Hyperscale' },
    { name: 'Equinix Sydney (SY)',          lat: -33.87,lon: 151.22, tier: 2, operator: 'Equinix',        traffic: 'APAC hub' },
    { name: 'GCP asia-south1 (Mumbai)',     lat: 19.08, lon: 72.88,  tier: 1, operator: 'Google Cloud',   traffic: 'Tier 1 — Hyperscale' },
    { name: 'AWS ap-south-1 (Mumbai)',      lat: 19.07, lon: 72.87,  tier: 1, operator: 'Amazon AWS',      traffic: 'Tier 1 — Hyperscale' },
    { name: 'Yotta NM1 (Navi Mumbai)',      lat: 19.04, lon: 73.03,  tier: 2, operator: 'Yotta',          traffic: 'India Tier 2' },
    { name: 'CtrlS Hyderabad',             lat: 17.38, lon: 78.47,  tier: 2, operator: 'CtrlS',           traffic: 'India Tier 2' },

    // ── CHINA ────────────────────────────────────────────────────────────
    { name: 'Alibaba Cloud (Hangzhou)',     lat: 30.27, lon: 120.15, tier: 1, operator: 'Alibaba Cloud',   traffic: 'Tier 1 — Hyperscale' },
    { name: 'Tencent (Shenzhen)',           lat: 22.54, lon: 114.06, tier: 1, operator: 'Tencent Cloud',   traffic: 'Tier 1 — Hyperscale' },
    { name: 'Baidu Cloud (Beijing)',        lat: 40.05, lon: 116.30, tier: 1, operator: 'Baidu Cloud',     traffic: 'Tier 1 — Hyperscale' },
    { name: 'ByteDance (Beijing)',          lat: 39.98, lon: 116.39, tier: 1, operator: 'ByteDance',       traffic: 'Tier 1 — TikTok infra' },
    { name: 'GDS Shanghai',                lat: 31.20, lon: 121.47, tier: 2, operator: 'GDS Holdings',    traffic: 'China Tier 2' },
    { name: 'ChinaNet PoP (Beijing)',       lat: 39.91, lon: 116.39, tier: 2, operator: 'China Telecom',  traffic: 'National backbone' },

    // ── AFRICA ───────────────────────────────────────────────────────────
    { name: 'AWS af-south-1 (Cape Town)',   lat: -33.92,lon: 18.42,  tier: 1, operator: 'Amazon AWS',      traffic: 'Tier 1 — Hyperscale' },
    { name: 'Teraco Johannesburg',          lat: -26.12,lon: 28.07,  tier: 2, operator: 'Teraco',          traffic: 'Tier 2 — Top Africa colocation hub' },
    { name: 'IXPN Lagos',                  lat: 6.52,  lon: 3.37,   tier: 3, operator: 'IXPN',            traffic: 'Tier 3 — Regional peering hub' },
    { name: 'KIXP Nairobi',                lat: -1.30, lon: 36.82,  tier: 3, operator: 'KIXP',            traffic: 'Tier 3 — Regional peering hub' },
    { name: 'Raxio Kampala',               lat: 0.32,  lon: 32.58,  tier: 3, operator: 'Raxio',           traffic: 'Tier 3' },
    { name: 'MTN Carriers Lagos',          lat: 6.50,  lon: 3.36,   tier: 3, operator: 'MTN',             traffic: 'West Africa hub' },

    // ── LATIN AMERICA ────────────────────────────────────────────────────
    { name: 'AWS sa-east-1 (Sao Paulo)',    lat: -23.55,lon: -46.63, tier: 1, operator: 'Amazon AWS',      traffic: 'Tier 1 — Hyperscale' },
    { name: 'GCP southamerica-east1',       lat: -23.50,lon: -46.62, tier: 1, operator: 'Google Cloud',   traffic: 'Tier 1 — Hyperscale' },
    { name: 'Equinix Sao Paulo (SP)',       lat: -23.57,lon: -46.64, tier: 2, operator: 'Equinix',        traffic: 'LATAM hub' },
    { name: 'PTT-Telesp IX (Sao Paulo)',    lat: -23.54,lon: -46.63, tier: 2, operator: 'NIC.br',         traffic: 'Tier 2 — Regional colocation hub' },
    { name: 'Cirion Miami',                lat: 25.77, lon: -80.19, tier: 2, operator: 'Cirion',          traffic: 'LATAM-NA hub' },
    { name: 'CenturyLink Bogota',          lat: 4.71,  lon: -74.07, tier: 3, operator: 'Lumen',           traffic: 'LATAM Tier 3' },
    { name: 'NAP do Caribe (Miami)',        lat: 25.78, lon: -80.20, tier: 2, operator: 'Terremark',      traffic: 'Caribbean hub' },

    // ── CANADA ───────────────────────────────────────────────────────────
    { name: 'AWS ca-central-1 (Montreal)',  lat: 45.50, lon: -73.57, tier: 1, operator: 'Amazon AWS',      traffic: 'Tier 1 — Hyperscale' },
    { name: 'Cologix Toronto',             lat: 43.70, lon: -79.42, tier: 2, operator: 'Cologix',         traffic: 'Canada Tier 2' },
    { name: 'Equinix Toronto (TR)',        lat: 43.71, lon: -79.41, tier: 2, operator: 'Equinix',         traffic: 'Canada hub' },
  ];

  // Tier colors
  const TIER_COLORS = {
    1: { bg: '#b060ff', border: '#d090ff', glow: 'rgba(176,96,255,0.7)', size: 10 },
    2: { bg: '#22d3ee', border: '#67e8f9', glow: 'rgba(34,211,238,0.5)', size: 7  },
    3: { bg: '#4ade80', border: '#86efac', glow: 'rgba(74,222,128,0.4)', size: 5  },
  };

  function enable(map) {
    leafletMap = map;
    enabled    = true;
    render();
  }

  function render() {
    if (!enabled || !leafletMap) return;

    DC_DATA.forEach(dc => {
      const t = TIER_COLORS[dc.tier] || TIER_COLORS[3];
      const s = t.size;
      const icon = L.divIcon({
        className: '',
        html: `<div style="
          width:${s}px;height:${s}px;
          background:${t.bg};
          border:1.5px solid ${t.border};
          border-radius:2px;
          box-shadow:0 0 ${s*1.5}px ${t.glow};
          cursor:pointer;
          transform:rotate(45deg);
        "></div>`,
        iconSize:   [s, s],
        iconAnchor: [s/2, s/2],
      });

      const tierLabel = dc.tier === 1 ? 'Hyperscaler' : dc.tier === 2 ? 'Major Colo/Hub' : 'Regional';
      const m = L.marker([dc.lat, dc.lon], { icon, zIndexOffset: dc.tier === 1 ? 1000 : 0 });
      m.bindTooltip(
        `<div style="font-family:'Share Tech Mono',monospace;font-size:11px;line-height:1.7;min-width:200px">
          <strong style="color:${t.border}">◈ ${dc.name}</strong><br/>
          Operator: <span style="color:#c8e8f0">${dc.operator}</span><br/>
          Class: <span style="color:${t.bg}">${tierLabel}</span><br/>
          Traffic: ${dc.traffic}
        </div>`,
        { direction: 'top', className: 'wm-tooltip', opacity: 1, offset: [0, -6] }
      );
      m.addTo(leafletMap);
      markers.push(m);
    });

    console.log(`[DataCenters] Rendered ${DC_DATA.length} facilities`);
  }

  function disable() {
    enabled = false;
    markers.forEach(m => leafletMap?.removeLayer(m));
    markers.length = 0;
  }

  function count() { return DC_DATA.length; }

  return { enable, disable, count };
})();
