/**
 * cables.js — Submarine Internet Cable Overlay
 * Data: TeleGeography Submarine Cable Map (public GeoJSON)
 * Cable routes based on real world paths from submarinecablemap.com data
 */

const CABLES = (() => {

  let leafletMap   = null;
  let enabled      = false;
  let cableGroup   = null; // L.layerGroup — persists through zoom
  const layers     = [];
  const landingMarkers = [];

  // Major submarine cables with real approximate routes
  // Each cable: { name, color, owner, capacity, path: [[lat,lon],...] }
  const CABLE_DATA = [
    // ── TRANS-ATLANTIC ────────────────────────────────────────────────
    {
      name: 'AEC-1 (Atlantic Crossing)', color: '#f59e0b',
      owner: 'Various', capacity: '20 Tbps',
      path: [[50.1,-5.5],[47.0,-12.0],[40.0,-25.0],[35.0,-35.0],[25.0,-55.0],[18.5,-66.1],[25.0,-77.0],[25.7,-80.2]]
    },
    {
      name: 'FLAG Atlantic-1', color: '#f59e0b',
      owner: 'Reliance', capacity: '10.2 Tbps',
      path: [[51.5,-0.1],[49.0,-5.0],[43.0,-18.0],[36.0,-30.0],[28.0,-45.0],[22.0,-63.0],[18.4,-66.0]]
    },
    {
      name: 'TAT-14', color: '#fb923c',
      owner: 'Consortium', capacity: '3.2 Tbps',
      path: [[52.3,4.9],[50.0,-2.0],[46.0,-15.0],[40.0,-30.0],[35.0,-45.0],[28.0,-60.0],[40.7,-74.0]]
    },
    {
      name: 'MAREA', color: '#f59e0b',
      owner: 'Microsoft/Facebook', capacity: '200 Tbps',
      path: [[43.36,-8.4],[40.0,-18.0],[35.0,-30.0],[30.0,-45.0],[25.0,-60.0],[18.5,-66.1]]
    },
    {
      name: 'Dunant', color: '#fbbf24',
      owner: 'Google', capacity: '250 Tbps',
      path: [[50.0,-5.0],[45.0,-20.0],[38.0,-35.0],[30.0,-50.0],[22.0,-65.0],[33.8,-78.4]]
    },
    {
      name: 'Hibernia Atlantic', color: '#fb923c',
      owner: 'GTT', capacity: '8 Tbps',
      path: [[53.3,-6.3],[54.0,-15.0],[53.0,-30.0],[51.0,-45.0],[47.5,-52.7],[44.6,-63.6]]
    },
    {
      name: 'Grace Hopper', color: '#fbbf24',
      owner: 'Google', capacity: '340 Tbps',
      path: [[51.5,-0.1],[48.0,-10.0],[42.0,-25.0],[35.0,-40.0],[25.0,-60.0],[18.5,-66.1],[40.7,-74.0]]
    },

    // ── TRANS-PACIFIC ─────────────────────────────────────────────────
    {
      name: 'Unity/EAC Pacific', color: '#22d3ee',
      owner: 'Google/Consortium', capacity: '7.68 Tbps',
      path: [[35.7,139.7],[30.0,155.0],[20.0,175.0],[0.0,-175.0],[-10.0,-155.0],[-20.0,-130.0],[-33.9,151.2]]
    },
    {
      name: 'FASTER', color: '#06b6d4',
      owner: 'Google/Consortium', capacity: '60 Tbps',
      path: [[37.8,-122.4],[40.0,-150.0],[42.0,-170.0],[40.0,170.0],[35.7,139.7],[34.7,135.5]]
    },
    {
      name: 'Pacific Light Cable Network', color: '#22d3ee',
      owner: 'Google/Facebook', capacity: '144 Tbps',
      path: [[34.05,-118.2],[25.0,-140.0],[15.0,-160.0],[0.0,-175.0],[22.3,114.1]]
    },
    {
      name: 'NCP (Northern Cross Pacific)', color: '#67e8f9',
      owner: 'SoftBank/Microsoft', capacity: '60 Tbps',
      path: [[37.8,-122.4],[45.0,-140.0],[50.0,-170.0],[45.0,170.0],[35.7,139.7]]
    },
    {
      name: 'Southern Cross', color: '#22d3ee',
      owner: 'Vocus/Spark', capacity: '20 Tbps',
      path: [[-33.9,151.2],[-30.0,165.0],[-25.0,-170.0],[21.3,-157.8]]
    },
    {
      name: 'PIPE Pacific-1', color: '#06b6d4',
      owner: 'Vocus', capacity: '4.8 Tbps',
      path: [[-33.9,151.2],[-36.9,174.8],[-25.0,-165.0],[21.3,-157.8]]
    },
    {
      name: 'TPE (Trans-Pacific Express)', color: '#22d3ee',
      owner: 'Consortium', capacity: '5.12 Tbps',
      path: [[37.8,-122.4],[38.0,-150.0],[35.0,-175.0],[35.7,139.7],[37.6,126.9],[39.9,116.4],[25.0,121.5]]
    },

    // ── AFRICA / EUROPE / ASIA ─────────────────────────────────────────
    {
      name: 'SEA-ME-WE 3', color: '#a78bfa',
      owner: 'Consortium', capacity: '960 Gbps',
      path: [[51.5,-0.1],[43.0,6.0],[37.9,23.7],[36.0,28.0],[31.0,32.0],[21.0,39.0],[11.8,44.0],[1.3,103.8],[6.9,79.8],[22.3,114.1],[35.7,139.7]]
    },
    {
      name: 'SEA-ME-WE 4', color: '#8b5cf6',
      owner: 'Consortium', capacity: '1.28 Tbps',
      path: [[43.3,5.4],[37.9,23.7],[31.0,32.0],[21.0,39.0],[25.3,55.3],[23.6,58.6],[1.3,103.8],[7.0,79.9],[10.0,99.0],[22.3,114.1]]
    },
    {
      name: 'SEA-ME-WE 5', color: '#7c3aed',
      owner: 'Consortium', capacity: '24 Tbps',
      path: [[43.3,5.4],[30.0,32.0],[15.0,42.0],[11.8,44.0],[1.3,103.8],[13.1,80.3]]
    },
    {
      name: 'EIG (Europe India Gateway)', color: '#a78bfa',
      owner: 'Consortium', capacity: '3.84 Tbps',
      path: [[51.5,-0.1],[37.9,23.7],[31.0,32.0],[21.0,39.0],[25.3,55.3],[22.3,114.1],[19.1,72.9]]
    },
    {
      name: 'PEACE Cable', color: '#8b5cf6',
      owner: 'PEACE Cable', capacity: '60 Tbps',
      path: [[22.0,38.0],[11.8,44.0],[2.0,45.0],[-4.3,39.6],[-33.9,18.4],[43.3,5.4],[51.5,-0.1]]
    },
    {
      name: 'SEACOM', color: '#c4b5fd',
      owner: 'SEACOM', capacity: '1.28 Tbps',
      path: [[-33.9,18.4],[-25.0,35.0],[-4.3,39.6],[1.3,103.8],[19.1,72.9],[11.8,44.0]]
    },
    {
      name: 'TEAMS', color: '#a78bfa',
      owner: 'TEAMS', capacity: '1.28 Tbps',
      path: [[-1.3,36.8],[11.8,44.0],[25.3,55.3],[23.6,58.6]]
    },
    {
      name: 'Africa Coast to Europe (ACE)', color: '#10b981',
      owner: 'Orange', capacity: '5.12 Tbps',
      path: [[51.5,-0.1],[43.3,5.4],[36.8,-5.9],[28.1,-15.5],[14.7,-17.5],[-0.2,-9.3],[-4.3,15.3],[-8.8,13.2],[-33.9,18.4]]
    },
    {
      name: 'West Africa Cable System (WACS)', color: '#34d399',
      owner: 'Consortium', capacity: '5.12 Tbps',
      path: [[51.5,-0.1],[43.3,5.4],[28.1,-15.5],[14.7,-17.5],[6.5,-2.5],[-4.3,15.3],[-33.9,18.4]]
    },
    {
      name: 'SAex (South Atlantic Express)', color: '#10b981',
      owner: 'Angola Cables', capacity: '40 Tbps',
      path: [[-8.8,13.2],[-23.0,-10.0],[-23.5,-46.6],[-22.9,-43.2]]
    },
    {
      name: 'SACS (South Atlantic Cable System)', color: '#34d399',
      owner: 'Angola Cables', capacity: '40 Tbps',
      path: [[-8.8,13.2],[-20.0,-15.0],[-33.9,-70.7]]
    },

    // ── INTRA-ASIA ─────────────────────────────────────────────────────
    {
      name: 'Asia-Africa-Europe 1 (AAE-1)', color: '#f472b6',
      owner: 'Consortium', capacity: '40 Tbps',
      path: [[22.3,114.1],[1.3,103.8],[7.0,79.9],[25.3,55.3],[21.0,39.0],[30.0,32.0],[37.9,23.7],[43.3,5.4],[51.5,-0.1]]
    },
    {
      name: 'Bay of Bengal Gateway (BBG)', color: '#ec4899',
      owner: 'Consortium', capacity: '10 Tbps',
      path: [[22.3,114.1],[1.3,103.8],[7.0,79.9],[23.8,90.4],[19.1,72.9]]
    },
    {
      name: 'Asia Pacific Gateway (APG)', color: '#f472b6',
      owner: 'Consortium', capacity: '54.8 Tbps',
      path: [[35.7,139.7],[37.6,126.9],[22.3,114.1],[1.3,103.8],[7.0,79.9],[19.1,72.9]]
    },
    {
      name: 'SJC (Southeast Asia–Japan Cable)', color: '#ec4899',
      owner: 'Google/Consortium', capacity: '28 Tbps',
      path: [[35.7,139.7],[34.7,135.5],[14.6,121.0],[1.3,103.8],[10.8,106.6],[22.3,114.1]]
    },

    // ── ARCTIC / POLAR ─────────────────────────────────────────────────
    {
      name: 'Arctic Fibre / Quintillion', color: '#67e8f9',
      owner: 'Quintillion', capacity: '20 Tbps',
      path: [[51.5,-0.1],[62.0,-10.0],[65.0,-15.0],[68.0,-15.0],[70.0,-25.0],[70.0,-50.0],[66.0,-53.0],[63.0,-70.0],[60.0,-77.0],[53.5,-60.0],[44.6,-63.6],[40.7,-74.0]]
    },

    // ── 2023–2024 NEW CABLES ───────────────────────────────────────────
    {
      name: '2Africa', color: '#10b981',
      owner: 'Meta/Consortium', capacity: '180 Tbps',
      // Longest cable ever: circles entire African continent + Middle East spurs
      path: [
        [51.5,-0.1],[48.0,-5.0],[38.4,-9.1],[28.0,-15.0],[14.7,-17.5],
        [4.0,-2.0],[-4.0,9.0],[-8.8,13.2],[-22.9,-43.2],  // W Africa branch
        [-33.9,18.4],[-25.9,32.9],[-4.0,39.7],[11.6,43.2],  // S & E Africa
        [15.0,42.0],[25.1,56.3],[22.3,114.1],[1.3,103.8],  // Middle East & Asia spur
        [13.1,43.1],[30.1,31.2],[32.1,34.8],[36.9,10.3],   // Egypt & Tunisia
        [43.3,5.4],[51.5,-0.1]                              // back to UK
      ]
    },
    {
      name: 'Echo (Google)', color: '#34d399',
      owner: 'Google', capacity: '256 Tbps',
      // Trans-Pacific: Oregon → Hawaii → Guam → Philippines → Singapore
      path: [[45.5,-122.7],[21.3,-157.8],[13.5,144.8],[14.6,121.0],[1.3,103.8]]
    },
    {
      name: 'Bifrost (Meta)', color: '#6ee7b7',
      owner: 'Meta', capacity: '200 Tbps',
      // Trans-Pacific: California → Hawaii → Philippines → Singapore (separate route)
      path: [[37.8,-122.5],[21.3,-157.8],[9.0,168.0],[14.6,121.0],[1.3,103.8]]
    },
    {
      name: 'Apricot (Google)', color: '#fcd34d',
      owner: 'Google/NTT/PLCN', capacity: '190 Tbps',
      // Japan → Taiwan → Philippines → Guam → Indonesia → Singapore
      path: [[35.7,139.7],[25.2,121.5],[14.6,121.0],[13.5,144.8],[-8.4,115.3],[1.3,103.8]]
    },
    {
      name: 'Blue Raman', color: '#60a5fa',
      owner: 'Google', capacity: '16 Tbps',
      // Italy → Egypt → Saudi Arabia → India (bypasses Suez Canal chokepoint)
      path: [[38.1,15.6],[30.1,31.2],[20.0,38.5],[12.8,45.0],[13.1,43.1],[22.2,68.9],[19.1,72.9]]
    },
    {
      name: 'SAS-1 (South Atlantic)', color: '#f87171',
      owner: 'Angola Cables', capacity: '72 Tbps',
      // Brazil → Ascension Island → Angola → South Africa
      path: [[-3.7,-38.5],[-7.9,-14.4],[-8.8,13.2],[-33.9,18.4]]
    },
    {
      name: 'Medusa', color: '#c084fc',
      owner: 'Consortium', capacity: '25 Tbps',
      // Portugal → Spain → France → Italy → Greece → Egypt → Morocco
      path: [[38.4,-9.1],[36.7,-4.4],[43.3,5.4],[37.5,15.1],[35.3,25.1],[30.1,31.2],[14.7,-17.5],[38.4,-9.1]]
    },
    {
      name: 'Hawaiki Nui', color: '#fb923c',
      owner: 'Hawaiki Nui', capacity: '100 Tbps',
      // US West → Hawaii → Samoa → New Zealand → Australia
      path: [[45.5,-122.7],[21.3,-157.8],[-13.8,-172.0],[-36.8,174.8],[-33.9,151.2]]
    },
  ];

  // Landing point stations (major cable hubs)
  const LANDING_POINTS = [
    { name: 'Porthcurno, UK',       lat: 50.04,  lon: -5.67,  cables: 8 },
    { name: 'Bude, UK',             lat: 50.83,  lon: -4.54,  cables: 6 },
    { name: 'Marseille, France',    lat: 43.30,  lon: 5.35,   cables: 12 },
    { name: 'Sesimbra, Portugal',   lat: 38.44,  lon: -9.10,  cables: 5 },
    { name: 'Fujairah, UAE',        lat: 25.10,  lon: 56.33,  cables: 14 },
    { name: 'Chennai, India',       lat: 13.06,  lon: 80.28,  cables: 10 },
    { name: 'Mumbai, India',        lat: 18.90,  lon: 72.82,  cables: 8 },
    { name: 'Singapore',            lat: 1.37,   lon: 103.75, cables: 25 },
    { name: 'Hong Kong',            lat: 22.31,  lon: 114.20, cables: 12 },
    { name: 'Tokyo, Japan',         lat: 35.45,  lon: 139.80, cables: 15 },
    { name: 'Chiba, Japan',         lat: 35.60,  lon: 140.10, cables: 8 },
    { name: 'Los Angeles, CA',      lat: 33.76,  lon: -118.39,cables: 18 },
    { name: 'San Luis Obispo, CA',  lat: 35.15,  lon: -120.64,cables: 6 },
    { name: 'New York, NY',         lat: 40.61,  lon: -73.80, cables: 12 },
    { name: 'Jacksonville, FL',     lat: 30.31,  lon: -81.39, cables: 6 },
    { name: 'Fortaleza, Brazil',    lat: -3.72,  lon: -38.52, cables: 10 },
    { name: 'Rio de Janeiro, BR',   lat: -22.97, lon: -43.19, cables: 5 },
    { name: 'Luanda, Angola',       lat: -8.84,  lon: 13.25,  cables: 7 },
    { name: 'Cape Town, SA',        lat: -33.93, lon: 18.38,  cables: 8 },
    { name: 'Mombasa, Kenya',       lat: -4.04,  lon: 39.67,  cables: 6 },
    { name: 'Djibouti',             lat: 11.56,  lon: 43.15,  cables: 10 },
    { name: 'Sydney, Australia',    lat: -33.95, lon: 151.25, cables: 8 },
    { name: 'Dakar, Senegal',       lat: 14.72,  lon: -17.49, cables: 7 },
    { name: 'Halifax, Canada',      lat: 44.65,  lon: -63.60, cables: 6 },
    { name: 'St John\'s, Canada',   lat: 47.56,  lon: -52.71, cables: 5 },
    { name: 'Puerto Rico',          lat: 18.47,  lon: -66.15, cables: 9 },
    { name: 'Tuckerton, NJ',        lat: 39.62,  lon: -74.33, cables: 8 },
    { name: 'Manasquan, NJ',        lat: 40.12,  lon: -74.04, cables: 5 },
    { name: 'Busan, Korea',         lat: 35.09,  lon: 129.07, cables: 9 },
    { name: 'Taipei, Taiwan',       lat: 25.18,  lon: 121.47, cables: 8 },
    { name: 'Accra, Ghana',         lat: 5.56,   lon: -0.22,  cables: 5 },
    { name: 'Lagos, Nigeria',       lat: 6.45,   lon: 3.40,   cables: 6 },
    { name: 'Guam',                 lat: 13.44,  lon: 144.79, cables: 8 },
    { name: 'Auckland, NZ',         lat: -36.84, lon: 174.76, cables: 4 },
    { name: 'Jeddah, Saudi Arabia', lat: 21.52,  lon: 39.18,  cables: 7 },
    { name: 'Bali, Indonesia',      lat: -8.40,  lon: 115.19, cables: 5 },
    { name: 'Tunis, Tunisia',       lat: 36.82,  lon: 10.17,  cables: 4 },
  ];

  // Color per cable for variety
  const CABLE_COLORS = [
    '#f59e0b','#22d3ee','#a78bfa','#10b981','#f472b6',
    '#fb923c','#06b6d4','#8b5cf6','#34d399','#ec4899',
    '#fbbf24','#67e8f9','#c4b5fd','#6ee7b7','#fca5a5',
  ];

  function enable(map) {
    leafletMap = map;
    enabled    = true;
    render();
  }

  function render() {
    if (!enabled || !leafletMap) return;
    // Use a LayerGroup so all cable lines persist through zoom/pan
    if (!cableGroup) cableGroup = L.layerGroup().addTo(leafletMap);

    CABLE_DATA.forEach((cable, i) => {
      const color = cable.color || CABLE_COLORS[i % CABLE_COLORS.length];
      const line = L.polyline(cable.path, {
        color,
        weight: 1.8,
        opacity: 0.65,
        className: 'cable-line',
        smoothFactor: 2,
        interactive: true,
      });
      line.bindTooltip(
        `<div style="font-family:'Share Tech Mono',monospace;font-size:11px;line-height:1.7">
          <strong style="color:${color}">${cable.name}</strong><br/>
          Owner: ${cable.owner}<br/>
          Capacity: ${cable.capacity}
        </div>`,
        { direction: 'top', className: 'wm-tooltip', opacity: 1, sticky: true }
      );
      cableGroup.addLayer(line);
      layers.push(line);
    });

    // Landing station markers
    LANDING_POINTS.forEach(lp => {
      const size = Math.min(6 + lp.cables * 0.6, 14);
      const icon = L.divIcon({
        className: '',
        html: `<div style="
          width:${size}px;height:${size}px;
          border-radius:50%;
          background:#f59e0b;
          border:1.5px solid rgba(255,179,0,0.8);
          box-shadow:0 0 ${size}px rgba(245,158,11,0.7);
          cursor:pointer;
        "></div>`,
        iconSize:   [size, size],
        iconAnchor: [size/2, size/2],
      });
      const m = L.marker([lp.lat, lp.lon], { icon });
      m.bindTooltip(
        `<div style="font-family:'Share Tech Mono',monospace;font-size:11px;line-height:1.7">
          <strong style="color:#f59e0b">📡 ${lp.name}</strong><br/>
          Cable landing station<br/>
          Active cables: <strong>${lp.cables}</strong>
        </div>`,
        { direction: 'top', className: 'wm-tooltip', opacity: 1 }
      );
      cableGroup.addLayer(m);
      landingMarkers.push(m);
    });

    console.log(`[Cables] Rendered ${CABLE_DATA.length} cables, ${LANDING_POINTS.length} landing points`);
  }

  function disable() {
    enabled = false;
    if (cableGroup) { leafletMap?.removeLayer(cableGroup); cableGroup = null; }
    layers.length = 0;
    landingMarkers.forEach(m => leafletMap?.removeLayer(m));
    landingMarkers.length = 0;
  }

  function count() { return CABLE_DATA.length; }

  return { enable, disable, count };
})();
