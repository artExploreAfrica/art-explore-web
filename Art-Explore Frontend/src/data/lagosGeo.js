// ─────────────────────────────────────────────────────────────
//  Lagos Detailed GeoJSON — Neighbourhoods, Landmarks, Zones
//  Drop this into /src/data/lagosGeo.js
// ─────────────────────────────────────────────────────────────

export const neighbourhoodsGeoJSON = {
  type: "FeatureCollection",
  features: [
    // ── ISLAND NEIGHBOURHOODS ─────────────────────────────────
    {
      type: "Feature",
      properties: {
        id: "victoria-island",
        name: "Victoria Island",
        region: "Island",
        color: "#1a6bbd",
        description: "Lagos' commercial & diplomatic hub",
      },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [3.4080, 6.4220], [3.4180, 6.4200], [3.4350, 6.4190],
          [3.4480, 6.4200], [3.4520, 6.4280], [3.4500, 6.4380],
          [3.4400, 6.4420], [3.4280, 6.4430], [3.4120, 6.4400],
          [3.4050, 6.4320], [3.4080, 6.4220],
        ]],
      },
    },
    {
      type: "Feature",
      properties: {
        id: "ikoyi",
        name: "Ikoyi",
        region: "Island",
        color: "#2563eb",
        description: "Upscale residential & gallery district",
      },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [3.4220, 6.4420], [3.4380, 6.4410], [3.4560, 6.4430],
          [3.4620, 6.4520], [3.4590, 6.4630], [3.4460, 6.4680],
          [3.4300, 6.4660], [3.4160, 6.4580], [3.4140, 6.4480],
          [3.4220, 6.4420],
        ]],
      },
    },
    {
      type: "Feature",
      properties: {
        id: "lekki-phase1",
        name: "Lekki Phase I",
        region: "Island",
        color: "#0e7490",
        description: "Modern residential & creative hub",
      },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [3.4480, 6.4380], [3.4620, 6.4360], [3.4750, 6.4380],
          [3.4800, 6.4460], [3.4780, 6.4580], [3.4650, 6.4620],
          [3.4500, 6.4600], [3.4420, 6.4520], [3.4430, 6.4420],
          [3.4480, 6.4380],
        ]],
      },
    },
    {
      type: "Feature",
      properties: {
        id: "lagos-island",
        name: "Lagos Island",
        region: "Island",
        color: "#1d4ed8",
        description: "Historic commercial centre & Marina",
      },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [3.3820, 6.4460], [3.3950, 6.4440], [3.4080, 6.4460],
          [3.4120, 6.4540], [3.4100, 6.4620], [3.3980, 6.4650],
          [3.3850, 6.4620], [3.3780, 6.4540], [3.3820, 6.4460],
        ]],
      },
    },
    {
      type: "Feature",
      properties: {
        id: "onikan",
        name: "Onikan",
        region: "Island",
        color: "#1d4ed8",
        description: "Cultural & museum district",
      },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [3.3920, 6.4430], [3.4020, 6.4420], [3.4060, 6.4480],
          [3.4040, 6.4540], [3.3960, 6.4550], [3.3890, 6.4510],
          [3.3870, 6.4460], [3.3920, 6.4430],
        ]],
      },
    },
    // ── MAINLAND NEIGHBOURHOODS ───────────────────────────────
    {
      type: "Feature",
      properties: {
        id: "yaba",
        name: "Yaba",
        region: "Mainland",
        color: "#92400e",
        description: "Tech hub & university district",
      },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [3.3600, 6.4920], [3.3780, 6.4900], [3.3880, 6.4960],
          [3.3860, 6.5080], [3.3740, 6.5120], [3.3600, 6.5080],
          [3.3540, 6.4980], [3.3600, 6.4920],
        ]],
      },
    },
    {
      type: "Feature",
      properties: {
        id: "ikeja",
        name: "Ikeja",
        region: "Mainland",
        color: "#b45309",
        description: "Lagos State capital & airport corridor",
      },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [3.3300, 6.5650], [3.3600, 6.5600], [3.3820, 6.5640],
          [3.3900, 6.5780], [3.3820, 6.5920], [3.3560, 6.5960],
          [3.3300, 6.5880], [3.3200, 6.5750], [3.3300, 6.5650],
        ]],
      },
    },
    {
      type: "Feature",
      properties: {
        id: "surulere",
        name: "Surulere",
        region: "Mainland",
        color: "#a16207",
        description: "Sports & residential belt",
      },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [3.3480, 6.4960], [3.3680, 6.4940], [3.3780, 6.5020],
          [3.3760, 6.5160], [3.3620, 6.5200], [3.3460, 6.5160],
          [3.3380, 6.5060], [3.3420, 6.4980], [3.3480, 6.4960],
        ]],
      },
    },
    {
      type: "Feature",
      properties: {
        id: "apapa",
        name: "Apapa",
        region: "Mainland",
        color: "#78350f",
        description: "Nigeria's largest seaport & logistics hub",
      },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [3.3580, 6.4460], [3.3740, 6.4440], [3.3820, 6.4540],
          [3.3800, 6.4660], [3.3660, 6.4720], [3.3500, 6.4680],
          [3.3440, 6.4570], [3.3500, 6.4480], [3.3580, 6.4460],
        ]],
      },
    },
  ],
};

export const landmarksGeoJSON = {
  type: "FeatureCollection",
  features: [
    // ── PORTS & LOGISTICS ─────────────────────────────────────
    {
      type: "Feature",
      properties: {
        id: "apapa-port",
        name: "Apapa Port",
        category: "port",
        icon: "⚓",
        description: "Nigeria's primary seaport — 80% of national imports",
        showAtZoom: 10,
      },
      geometry: { type: "Point", coordinates: [3.3620, 6.4500] },
    },
    {
      type: "Feature",
      properties: {
        id: "tin-can-port",
        name: "Tin Can Island Port",
        category: "port",
        icon: "⚓",
        description: "Container terminal — 2nd largest port in Lagos",
        showAtZoom: 10,
      },
      geometry: { type: "Point", coordinates: [3.3200, 6.4320] },
    },
    {
      type: "Feature",
      properties: {
        id: "mma-airport",
        name: "Murtala Muhammed Airport",
        category: "airport",
        icon: "✈",
        description: "Lagos International Airport — busiest in West Africa",
        showAtZoom: 10,
      },
      geometry: { type: "Point", coordinates: [3.3213, 6.5774] },
    },
    // ── LANDMARKS & CULTURAL ──────────────────────────────────
    {
      type: "Feature",
      properties: {
        id: "eko-atlantic",
        name: "Eko Atlantic City",
        category: "landmark",
        icon: "🏙",
        description: "Ambitious land reclamation urban development",
        showAtZoom: 12,
      },
      geometry: { type: "Point", coordinates: [3.4120, 6.4090] },
    },
    {
      type: "Feature",
      properties: {
        id: "national-museum",
        name: "National Museum",
        category: "museum",
        icon: "🏛",
        description: "Nigeria's premier museum — Onikan, Lagos Island",
        showAtZoom: 12,
      },
      geometry: { type: "Point", coordinates: [3.3997, 6.4481] },
    },
    {
      type: "Feature",
      properties: {
        id: "tafawa-balewa",
        name: "Tafawa Balewa Square",
        category: "landmark",
        icon: "🏟",
        description: "National venue for state functions",
        showAtZoom: 12,
      },
      geometry: { type: "Point", coordinates: [3.3930, 6.4525] },
    },
    {
      type: "Feature",
      properties: {
        id: "lagos-lagoon",
        name: "Lagos Lagoon Bridge",
        category: "infrastructure",
        icon: "🌉",
        description: "Third Mainland Bridge — connects island to mainland",
        showAtZoom: 10,
      },
      geometry: { type: "Point", coordinates: [3.3780, 6.4720] },
    },
    {
      type: "Feature",
      properties: {
        id: "lekki-conservation",
        name: "Lekki Conservation Centre",
        category: "park",
        icon: "🌿",
        description: "Urban nature reserve with canopy walkway",
        showAtZoom: 12,
      },
      geometry: { type: "Point", coordinates: [3.5120, 6.4680] },
    },
    {
      type: "Feature",
      properties: {
        id: "freedom-park",
        name: "Freedom Park",
        category: "park",
        icon: "🌿",
        description: "Heritage park on former colonial prison site",
        showAtZoom: 13,
      },
      geometry: { type: "Point", coordinates: [3.3948, 6.4509] },
    },
    {
      type: "Feature",
      properties: {
        id: "balogun-market",
        name: "Balogun Market",
        category: "market",
        icon: "🛒",
        description: "Largest open-air market in West Africa",
        showAtZoom: 13,
      },
      geometry: { type: "Point", coordinates: [3.3880, 6.4553] },
    },
    {
      type: "Feature",
      properties: {
        id: "computer-village",
        name: "Computer Village",
        category: "market",
        icon: "💻",
        description: "Largest IT market in Africa — Ikeja",
        showAtZoom: 13,
      },
      geometry: { type: "Point", coordinates: [3.3485, 6.5948] },
    },
    {
      type: "Feature",
      properties: {
        id: "national-theatre",
        name: "National Theatre",
        category: "arts",
        icon: "🎭",
        description: "Iconic brutalist arts complex — Iganmu",
        showAtZoom: 12,
      },
      geometry: { type: "Point", coordinates: [3.3560, 6.4652] },
    },
    // ── TREE-PLANTING / GREEN ZONES ───────────────────────────
    {
      type: "Feature",
      properties: {
        id: "lekki-greenway",
        name: "Lekki Coastal Greenway",
        category: "green-zone",
        description: "Coastal mangrove & drainage buffer",
        showAtZoom: 11,
      },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [3.4800, 6.4180], [3.5100, 6.4150], [3.5400, 6.4200],
          [3.5600, 6.4350], [3.5500, 6.4420], [3.5200, 6.4380],
          [3.4900, 6.4320], [3.4780, 6.4260], [3.4800, 6.4180],
        ]],
      },
    },
    {
      type: "Feature",
      properties: {
        id: "victoria-island-greenway",
        name: "VI Lagoon Buffer",
        category: "green-zone",
        description: "Shoreline drainage & green corridor",
        showAtZoom: 12,
      },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [3.4080, 6.4160], [3.4300, 6.4140], [3.4500, 6.4160],
          [3.4520, 6.4210], [3.4300, 6.4195], [3.4080, 6.4205],
          [3.4080, 6.4160],
        ]],
      },
    },
  ],
};
