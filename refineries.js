/**
 * refineries.js — Top 50 Oil Refineries Overlay
 * Sources: EIA, Statista, Oil & Gas Journal 2023 capacity rankings
 */

const REFINERIES = (() => {

  let leafletMap = null;
  let enabled    = false;
  let rfGroup    = null;

  const REFINERY_DATA = [
    // ── MIDDLE EAST ────────────────────────────────────────────────────────
    { name: 'Ras Tanura Refinery',          lat: 26.64,  lon: 50.16,  country: 'Saudi Arabia', company: 'Saudi Aramco',      capacity_kbd: 550, products: 'Gasoline, Diesel, Jet fuel, Naphtha, LPG', customers: 'Asia-Pacific markets, China, Japan, South Korea, India' },
    { name: 'Abqaiq Processing Complex',    lat: 25.93,  lon: 49.67,  country: 'Saudi Arabia', company: 'Saudi Aramco',      capacity_kbd: 700, products: 'Crude stabilisation, NGL, LPG, Naphtha', customers: 'Global export — largest crude processing plant on Earth' },
    { name: 'Jazan Refinery',               lat: 16.88,  lon: 42.56,  country: 'Saudi Arabia', company: 'Saudi Aramco',      capacity_kbd: 400, products: 'Gasoline, Diesel, Aviation fuel, Petroleum coke', customers: 'Red Sea exports, East Africa, Europe' },
    { name: 'Ruwais Refinery',              lat: 24.11,  lon: 52.73,  country: 'UAE',          company: 'ADNOC Refining',    capacity_kbd: 817, products: 'Diesel, Jet fuel, Gasoline, Naphtha, Polypropylene', customers: 'India, China, Japan, Europe' },
    { name: 'Karbala Refinery',             lat: 32.61,  lon: 44.02,  country: 'Iraq',         company: 'SOMO / MoO Iraq',   capacity_kbd: 140, products: 'Fuel oil, Gasoline, Diesel', customers: 'Domestic Iraq, regional' },
    { name: 'Abadan Refinery',              lat: 30.34,  lon: 48.30,  country: 'Iran',         company: 'NIOC',              capacity_kbd: 400, products: 'Gasoline, Diesel, Kerosene, Asphalt', customers: 'Domestic Iran, Iraq, Syria' },
    { name: 'Bandar Abbas Refinery',        lat: 27.18,  lon: 56.27,  country: 'Iran',         company: 'Persian Gulf Star', capacity_kbd: 480, products: 'Gasoline (Euro-5), Diesel, Kerosene', customers: 'Domestic market, Iraq, Afghanistan' },
    { name: 'Mina Al-Ahmadi Refinery',      lat: 29.08,  lon: 48.14,  country: 'Kuwait',       company: 'KPC / KNPC',        capacity_kbd: 466, products: 'Gasoline, Diesel, Jet fuel, Fuel oil', customers: 'Asia, Europe, US East Coast' },

    // ── ASIA-PACIFIC ───────────────────────────────────────────────────────
    { name: 'Jamnagar Refinery (Reliance)', lat: 22.46,  lon: 70.07,  country: 'India',        company: 'Reliance Industries', capacity_kbd: 1240, products: 'Gasoline, Diesel, Jet fuel, Petcoke, Polymers', customers: "World's largest single-site; exports to USA, Europe, Africa" },
    { name: 'Ulsan Refinery (SK Energy)',   lat: 35.54,  lon: 129.31, country: 'South Korea',  company: 'SK Energy',           capacity_kbd: 840,  products: 'Gasoline, Diesel, Jet fuel, Paraxylene', customers: 'Japan, China, SE Asia, US West Coast' },
    { name: 'Yeosu Refinery (GS Caltex)',   lat: 34.73,  lon: 127.74, country: 'South Korea',  company: 'GS Caltex',           capacity_kbd: 730,  products: 'Diesel, Jet fuel, Naphtha, LPG', customers: 'Japan, Taiwan, China, SE Asia' },
    { name: 'Onsan Refinery (S-OIL)',       lat: 35.44,  lon: 129.35, country: 'South Korea',  company: 'S-OIL',               capacity_kbd: 669,  products: 'Gasoline, Diesel, Olefins, Paraxylene', customers: 'Japan, China, SE Asia, Middle East' },
    { name: 'Zhoushan Refinery (Rongsheng)',lat: 29.97,  lon: 122.08, country: 'China',        company: 'Zhejiang Petroleum',  capacity_kbd: 800,  products: 'Gasoline, Diesel, Jet fuel, Paraxylene, Propylene', customers: 'Domestic China, Asia-Pacific' },
    { name: 'Dalian Refinery (PetroChina)',  lat: 38.91,  lon: 121.61, country: 'China',        company: 'PetroChina',          capacity_kbd: 410,  products: 'Gasoline, Diesel, LPG, Chemical feedstocks', customers: 'Northeast China domestic' },
    { name: 'Quanzhou Refinery (Sinochem)', lat: 24.88,  lon: 118.68, country: 'China',        company: 'Sinochem / Fujian',   capacity_kbd: 480,  products: 'Paraxylene, Diesel, Gasoline, Jet fuel', customers: 'China domestic, SE Asia' },
    { name: 'Hengli Refinery (Dalian)',     lat: 38.87,  lon: 121.53, country: 'China',        company: 'Hengli Petrochemical',capacity_kbd: 400,  products: 'Paraxylene, Diesel, Gasoline, Propylene', customers: 'China domestic, textile/polyester industry' },
    { name: 'Mizushima Refinery (JX)',      lat: 34.52,  lon: 133.78, country: 'Japan',        company: 'ENEOS (JX Nippon)',    capacity_kbd: 255,  products: 'Gasoline, Diesel, Jet fuel, Naphtha', customers: 'Japanese domestic market' },
    { name: 'Chiba Refinery (Idemitsu)',    lat: 35.56,  lon: 140.02, country: 'Japan',        company: 'Idemitsu Kosan',      capacity_kbd: 220,  products: 'Gasoline, Diesel, Kerosene, Lubricants', customers: 'Japan domestic, limited exports' },
    { name: 'Mailiao Refinery (Formosa)',   lat: 23.78,  lon: 120.22, country: 'Taiwan',       company: 'Formosa Petrochemical',capacity_kbd: 540, products: 'Gasoline, Diesel, Paraxylene, Ethylene', customers: 'Domestic Taiwan, China, SE Asia' },
    { name: 'Port Dickson Refinery (Petron)',lat: 2.53,  lon: 101.79, country: 'Malaysia',     company: 'Petron / Petronas',   capacity_kbd: 88,   products: 'Gasoline, Diesel, LPG', customers: 'Malaysia domestic, Singapore' },
    { name: 'Balikpapan Refinery (Pertamina)',lat:-1.27, lon: 116.82, country: 'Indonesia',    company: 'Pertamina',           capacity_kbd: 260,  products: 'Gasoline, Diesel, Jet fuel, Avgas', customers: 'Indonesia domestic (Borneo region)' },

    // ── RUSSIA / CIS ───────────────────────────────────────────────────────
    { name: 'Omsk Refinery (Gazprom Neft)', lat: 54.90,  lon: 73.37,  country: 'Russia',       company: 'Gazprom Neft',        capacity_kbd: 420,  products: 'Gasoline, Diesel, Bitumen, Jet fuel, Lubricants', customers: "Russia's largest refinery; domestic + Central Asia" },
    { name: 'Ryazan Refinery (Rosneft)',    lat: 54.62,  lon: 39.74,  country: 'Russia',       company: 'Rosneft',             capacity_kbd: 342,  products: 'Gasoline, Diesel, Fuel oil, Bitumen', customers: 'Moscow region, domestic Russia' },
    { name: 'Kirishi Refinery (Kinef)',     lat: 59.45,  lon: 32.02,  country: 'Russia',       company: 'Surgutneftegas',      capacity_kbd: 357,  products: 'Diesel, Gasoline, Naphtha, Fuel oil', customers: 'Northwest Russia, Baltic exports (pre-2022)' },

    // ── EUROPE ─────────────────────────────────────────────────────────────
    { name: 'Rotterdam Refinery (Shell)',   lat: 51.88,  lon: 4.30,   country: 'Netherlands',  company: 'Shell Energy & Chemicals', capacity_kbd: 404, products: 'Gasoline, Diesel, Jet fuel, Chemical feedstocks', customers: 'Northwest Europe, UK, Germany' },
    { name: 'Antwerp Refinery (TotalEnergies)',lat:51.28, lon: 4.39,  country: 'Belgium',      company: 'TotalEnergies',       capacity_kbd: 338,  products: 'Gasoline, Diesel, Naphtha, LPG, Polymers', customers: 'Belgium, France, Germany, UK' },
    { name: 'Pernis Refinery (Shell)',      lat: 51.88,  lon: 4.38,   country: 'Netherlands',  company: 'Shell',               capacity_kbd: 416,  products: "Europe's largest refinery; Diesel, Jet fuel, Gasoline, Chemicals", customers: 'UK, Germany, Benelux, Scandinavia' },
    { name: 'Leuna Refinery (TotalEnergies)',lat:51.33,  lon: 12.01,  country: 'Germany',      company: 'TotalEnergies',       capacity_kbd: 240,  products: 'Gasoline, Diesel, Jet fuel, Chemicals, Polymers', customers: 'Germany domestic, Eastern Europe' },
    { name: 'Sines Refinery (Galp)',        lat: 37.95,  lon: -8.87,  country: 'Portugal',     company: 'Galp Energia',        capacity_kbd: 220,  products: 'Diesel, Gasoline, Fuel oil, Naphtha', customers: 'Portugal, Spain, West Africa, Brazil' },
    { name: 'Augusta Refinery (ENI/Sonatrach)',lat:37.22,lon: 15.24,  country: 'Italy',        company: 'ENI / Sonatrach',     capacity_kbd: 200,  products: 'Diesel, Gasoline, Jet fuel, LPG', customers: 'Italy, Mediterranean, North Africa' },
    { name: 'Tarragona Refinery (Repsol)',  lat: 41.07,  lon: 1.14,   country: 'Spain',        company: 'Repsol',              capacity_kbd: 186,  products: 'Gasoline, Diesel, Jet fuel, Polypropylene', customers: 'Spain domestic, France, North Africa' },

    // ── NORTH AMERICA ──────────────────────────────────────────────────────
    { name: 'Port Arthur Refinery (Motiva)', lat: 29.90, lon: -93.94, country: 'USA',          company: 'Motiva (Saudi Aramco/Shell)', capacity_kbd: 630, products: "USA's largest refinery; Gasoline, Diesel, Jet fuel, Petcoke", customers: 'US Gulf Coast, Midwest, Caribbean' },
    { name: 'Galveston Bay Refinery (Marathon)',lat:29.72,lon:-95.01, country: 'USA',          company: 'Marathon Petroleum',  capacity_kbd: 585,  products: 'Gasoline, Diesel, Jet fuel, Petcoke, Asphalt', customers: 'US Gulf Coast, Midwest, Latin America' },
    { name: 'Baytown Refinery (ExxonMobil)', lat: 29.73, lon: -94.97, country: 'USA',          company: 'ExxonMobil',          capacity_kbd: 560,  products: 'Gasoline, Diesel, Lubricants, Chemicals, Polymers', customers: 'US domestic, Caribbean, Latin America' },
    { name: 'Baton Rouge Refinery (ExxonMobil)',lat:30.45,lon:-91.19, country: 'USA',          company: 'ExxonMobil',          capacity_kbd: 540,  products: 'Gasoline, Diesel, Chemicals, Lubricants', customers: 'US Gulf Coast, Midwest' },
    { name: 'Garyville Refinery (Marathon)', lat: 30.09, lon: -90.61, country: 'USA',          company: 'Marathon Petroleum',  capacity_kbd: 578,  products: 'Gasoline, Diesel, Jet fuel, Asphalt', customers: 'US East Coast, Midwest, Caribbean' },
    { name: 'Wood River Refinery (Phillips 66)',lat:38.87,lon:-90.09, country: 'USA',          company: 'Phillips 66',         capacity_kbd: 314,  products: 'Gasoline, Diesel, Jet fuel, Petcoke', customers: 'US Midwest, Canada' },
    { name: 'Whiting Refinery (BP)',        lat: 41.68,  lon: -87.49, country: 'USA',          company: 'BP',                  capacity_kbd: 435,  products: 'Gasoline, Diesel, Asphalt, Petcoke, LPG', customers: 'US Great Lakes, Midwest' },
    { name: 'Los Angeles Refinery (Valero)',lat: 33.81,  lon: -118.26,country: 'USA',          company: 'Valero Energy',       capacity_kbd: 135,  products: 'Gasoline, Diesel, Jet fuel', customers: 'California domestic market' },
    { name: 'Puget Sound Refinery (bp)',    lat: 48.45,  lon: -122.33,country: 'USA',          company: 'bp',                  capacity_kbd: 225,  products: 'Gasoline, Diesel, Jet fuel, Asphalt', customers: 'US Pacific Northwest, Alaska' },
    { name: 'Irving Refinery (Irving Oil)', lat: 45.27,  lon: -66.05, country: 'Canada',       company: 'Irving Oil',          capacity_kbd: 320,  products: "Canada's largest refinery; Gasoline, Diesel, Jet fuel, Heating oil", customers: 'Eastern Canada, US Northeast, Caribbean' },
    { name: 'Sarnia Refinery (Imperial Oil)',lat:42.97,  lon: -82.37, country: 'Canada',       company: 'Imperial Oil (ExxonMobil)', capacity_kbd: 121, products: 'Gasoline, Diesel, Asphalt, Lubricants', customers: 'Ontario domestic, US Midwest' },
    { name: 'Salamanca Refinery (Pemex)',   lat: 20.57,  lon: -101.19,country: 'Mexico',       company: 'Pemex',               capacity_kbd: 246,  products: 'Gasoline, Diesel, Jet fuel, LPG, Asphalt', customers: 'Mexico domestic' },

    // ── AFRICA ─────────────────────────────────────────────────────────────
    { name: 'Ras Lanuf Refinery',           lat: 30.50,  lon: 18.56,  country: 'Libya',        company: 'NOC Libya',           capacity_kbd: 220,  products: 'Gasoline, Diesel, Fuel oil, LPG', customers: 'Libya domestic, Mediterranean exports' },
    { name: 'Skikda Refinery',              lat: 36.88,  lon: 6.90,   country: 'Algeria',      company: 'Sonatrach',           capacity_kbd: 300,  products: 'Gasoline, Diesel, Jet fuel, LNG feedstock', customers: 'Algeria domestic, Mediterranean' },
    { name: 'Durban Refinery (Engen/Natref)',lat:-29.87, lon: 31.01,  country: 'South Africa', company: 'Engen / Natref',      capacity_kbd: 150,  products: 'Gasoline, Diesel, Jet fuel, Bitumen', customers: 'South Africa, Sub-Saharan Africa' },
    { name: 'Port Harcourt Refinery (NNPC)',lat: 4.78,   lon: 7.01,   country: 'Nigeria',      company: 'NNPC',                capacity_kbd: 210,  products: 'Gasoline, Diesel, Kerosene, LPG', customers: 'Nigeria domestic (frequently offline)' },

    // ── LATIN AMERICA ──────────────────────────────────────────────────────
    { name: 'Paulinia Refinery (Petrobras)',  lat:-22.76, lon: -47.15, country: 'Brazil',       company: 'Petrobras',           capacity_kbd: 434,  products: "Brazil's largest; Gasoline, Diesel, Jet fuel, LPG, Asphalt", customers: 'São Paulo region, Brazil domestic' },
    { name: 'Amuay Refinery (PDVSA)',        lat: 11.74,  lon: -70.22, country: 'Venezuela',    company: 'PDVSA',               capacity_kbd: 645,  products: "World's largest complex; Gasoline, Diesel, Fuel oil, Asphalt", customers: 'Caribbean, US (historically), Cuba, China' },
    { name: 'Barrancabermeja Refinery (Ecopetrol)',lat:7.07,lon:-73.85,country: 'Colombia',     company: 'Ecopetrol',           capacity_kbd: 250,  products: 'Gasoline, Diesel, Jet fuel, Lubricants', customers: 'Colombia domestic, Caribbean exports' },
  ];

  const color = '#f97316'; // orange

  function enable(map) {
    leafletMap = map;
    enabled = true;
    render();
  }

  function disable() {
    enabled = false;
    if (rfGroup) { leafletMap?.removeLayer(rfGroup); rfGroup = null; }
  }

  function render() {
    if (!enabled || !leafletMap) return;
    if (!rfGroup) rfGroup = L.layerGroup().addTo(leafletMap);

    REFINERY_DATA.forEach(r => {
      const icon = L.divIcon({
        className: '',
        html: `<div style="width:10px;height:10px;background:${color};border-radius:3px;border:1.5px solid #fdba74;box-shadow:0 0 8px ${color}88;transform:rotate(45deg)"></div>`,
        iconSize: [10, 10],
        iconAnchor: [5, 5],
      });

      const marker = L.marker([r.lat, r.lon], { icon });

      marker.bindTooltip(`
        <div style="font-family:'Share Tech Mono',monospace;font-size:11px;max-width:260px;line-height:1.6">
          <div style="color:#f97316;font-weight:bold;margin-bottom:2px">⬡ ${r.name}</div>
          <div style="color:#fdba74">${r.company} — ${r.country}</div>
          <div style="color:#64748b;margin-top:2px;font-size:10px">Capacity: <span style="color:#e2e8f0">${r.capacity_kbd.toLocaleString()} kbd</span></div>
          <div style="color:#64748b;font-size:10px">Products: <span style="color:#cbd5e1">${r.products}</span></div>
          <div style="color:#64748b;font-size:10px;margin-top:2px">Customers: <span style="color:#94a3b8">${r.customers}</span></div>
        </div>
      `, { sticky: true, opacity: 1, className: 'wm-tooltip' });

      rfGroup.addLayer(marker);
    });
  }

  function count() { return REFINERY_DATA.length; }

  return { enable, disable, count };
})();
