// Enrichment data for all 20 postcodes
// Each entry provides: floodRisk, councilTax, propertyTypeSplit, commuteTable,
// planningActivity, rentalMarket, broadband, airQuality, rentalDemand,
// nearbyDevelopments, recentSoldPrices

export interface EnrichmentProfile {
  floodRisk: {
    zone: string;
    surfaceWater: string;
    riskBadge: "Low" | "Medium" | "High";
    detail: string;
    // Optional — merged in by deriveClimateResilience post-processing
    resilienceLabel?: "Low risk" | "Some exposure" | "Elevated risk" | "High risk";
    climateSignals?: Array<{ label: string; value: string; context: string; flagged: boolean }>;
    nextSteps?: string[];
  };
  councilTax: {
    mostCommonBand: string;
    annualCost: string;
    borough: string;
    note: string;
  };
  propertyTypeSplit: {
    flats: number;
    terraced: number;
    semiDetached: number;
    detached: number;
    other: number;
    dominantType: string;
  };
  commuteTable: Array<{ destination: string; time: string; mode: string; via: string }>;
  planningActivity: {
    recentApplications: number;
    majorDevelopments: string;
    councilPortalUrl: string;
    note: string;
  };
  rentalMarket: {
    oneBedAskingRent: string;
    twoBedAskingRent: string;
    threeBedAskingRent: string;
    oneBedYield: string;
    twoBedYield: string;
    demandLevel: string;
    note: string;
  };
  broadband: {
    avgDownloadSpeed: string;
    fullFibreAvailability: string;
    rating: "Excellent" | "Good" | "Fair" | "Poor";
    providers: string;
    note: string;
  };
  airQuality: {
    no2Level: string;
    pm25Level: string;
    rating: "Good" | "Moderate" | "Poor" | "Very Poor";
    note: string;
  };
  rentalDemand: {
    avgDaysToLet: number;
    vsNationalAvg: string;
    score: number;
    note: string;
  };
  nearbyDevelopments: Array<{
    name: string;
    type: string;
    status: string;
    impact: "Positive" | "Neutral" | "Monitor";
    detail: string;
  }>;
  recentSoldPrices: Array<{
    address: string;
    price: string;
    date: string;
    type: string;
    lat: number;
    lng: number;
  }>;
}

export const enrichmentProfiles: Record<string, EnrichmentProfile> = {

  // ─── SW1 — Belgravia / Pimlico / Westminster ──────────────────────────────
  SW1: {
    floodRisk: {
      zone: "Zone 1 (Low)",
      surfaceWater: "Low",
      riskBadge: "Low",
      detail: "SW1 sits above tidal flood risk level on Thames flood defences modelling. The Grosvenor Estate's drainage infrastructure is well-maintained. Surface water risk is low across the majority of the postcode.",
    },
    councilTax: {
      mostCommonBand: "Band G",
      annualCost: "£2,642",
      borough: "City of Westminster",
      note: "Westminster's council tax rate is among the lowest in London — subsidised historically by commercial business rates revenue. Band G covers the majority of Belgravia and Pimlico properties; Band H (£3,143/yr) applies to the largest townhouses.",
    },
    propertyTypeSplit: { flats: 71, terraced: 18, semiDetached: 3, detached: 4, other: 4, dominantType: "Flats dominate at 71% — primarily mansion block conversions and purpose-built apartments" },
    commuteTable: [
      { destination: "City of London", time: "12 min", mode: "Tube", via: "Victoria → Bank (Victoria line)" },
      { destination: "Canary Wharf", time: "21 min", mode: "Tube", via: "Victoria → Canary Wharf (Jubilee)" },
      { destination: "Heathrow T2/T3", time: "42 min", mode: "Tube", via: "Victoria → Heathrow (Piccadilly)" },
      { destination: "West End (Oxford Circus)", time: "8 min", mode: "Tube", via: "Victoria line direct" },
    ],
    planningActivity: {
      recentApplications: 312,
      majorDevelopments: "1 Palace Street SW1E (luxury residential conversion of former government offices, 72 units, complete 2024). Nova, Victoria (mixed-use complete). No major consented schemes outstanding.",
      councilPortalUrl: "https://www.westminster.gov.uk/planning-and-building-control/planning-applications",
      note: "Westminster's planning environment is restrictive by design — conservation area coverage exceeds 75% of SW1. Application volume is high but major new residential supply is structurally limited.",
    },
    rentalMarket: {
      oneBedAskingRent: "£2,600 pcm",
      twoBedAskingRent: "£4,200 pcm",
      threeBedAskingRent: "£7,500 pcm",
      oneBedYield: "3.2%",
      twoBedYield: "3.0%",
      demandLevel: "Very High",
      note: "SW1 rental demand is structural — embassies, financial institutions, and central government employment create permanent high-quality tenant flow. Void periods are short. Premium Belgravia townhouses let on short-term furnished lets at significant premiums.",
    },
    broadband: {
      avgDownloadSpeed: "210 Mbps",
      fullFibreAvailability: "82%",
      rating: "Excellent",
      providers: "Openreach FTTP, Virgin Media, Hyperoptic, BT",
      note: "SW1 has strong fibre infrastructure driven by commercial and embassy demand. Hyperoptic serves many mansion blocks directly. Average speeds are well above the London median.",
    },
    airQuality: {
      no2Level: "38 µg/m³",
      pm25Level: "14 µg/m³",
      rating: "Moderate",
      note: "Victoria's bus terminus and heavy traffic on Buckingham Palace Road and Vauxhall Bridge Road elevate NO₂ above the WHO guideline (10 µg/m³). Quiet garden squares within the estate return significantly lower readings. ULEZ compliance has improved readings ~18% since 2023.",
    },
    rentalDemand: {
      avgDaysToLet: 12,
      vsNationalAvg: "3.5× faster than national average (42 days)",
      score: 9,
      note: "Prime central London rental demand remains structurally elevated. SW1 1-bed properties average 12 days to let; 2-beds average 16 days. Embassy and government-related relocations provide year-round demand floor.",
    },
    nearbyDevelopments: [
      { name: "1 Palace Street SW1E", type: "Residential", status: "Complete (2024)", impact: "Positive", detail: "72 luxury units converted from former Crown Estate offices. Added high-quality supply without materially impacting values — absorbed by international buyer demand." },
      { name: "Victoria Crossrail Place (Proposed)", type: "Transport", status: "Under review", impact: "Positive", detail: "Speculative long-term proposal to add Victoria to the Elizabeth line network. No confirmed planning — monitor only." },
      { name: "Pimlico Road Streetscape", type: "Commercial", status: "Planning approved 2024", impact: "Positive", detail: "Westminster Council improvements to Pimlico Road public realm — wider pavements, cycle lanes, improved lighting. Enhances the Belgravia/Pimlico character street." },
    ],
    recentSoldPrices: [
      { address: "Eaton Square SW1W", price: "£6,250,000", date: "Jan 2025", type: "Flat", lat: 51.4963, lng: -0.1534 },
      { address: "Chester Square SW1W", price: "£8,100,000", date: "Dec 2024", type: "Terraced", lat: 51.4944, lng: -0.1551 },
      { address: "Eccleston Square SW1V", price: "£1,950,000", date: "Feb 2025", type: "Flat", lat: 51.4921, lng: -0.1489 },
      { address: "Warwick Way SW1V", price: "£875,000", date: "Jan 2025", type: "Flat", lat: 51.4904, lng: -0.1467 },
      { address: "Belgrave Road SW1V", price: "£1,200,000", date: "Mar 2025", type: "Flat", lat: 51.4919, lng: -0.1440 },
    ],
  },

  // ─── SW3 — Chelsea ────────────────────────────────────────────────────────
  SW3: {
    floodRisk: {
      zone: "Zone 2 (Medium) — riverside streets only",
      surfaceWater: "Low",
      riskBadge: "Low",
      detail: "Cheyne Walk and the immediate Chelsea Embankment (within ~150m of the Thames) sit in EA Flood Zone 2. The vast majority of SW3 — Chelsea village, the garden squares, streets around the King's Road — is Zone 1 (Low). Thames Tideway Tunnel completion (2025) significantly reduces surface water overflow risk.",
    },
    councilTax: {
      mostCommonBand: "Band G",
      annualCost: "£1,698",
      borough: "Royal Borough of Kensington & Chelsea",
      note: "RBKC has the lowest council tax rate of any London borough. Band G (covering most Chelsea flats and houses) is £1,698/yr — less than half the rate in many outer London boroughs. Band H (largest properties) is £2,022/yr.",
    },
    propertyTypeSplit: { flats: 65, terraced: 26, semiDetached: 5, detached: 3, other: 1, dominantType: "Flats at 65% and terraced houses at 26% — a mix reflecting the Victorian terrace grid and mansion block stock" },
    commuteTable: [
      { destination: "City of London", time: "19 min", mode: "Tube", via: "Sloane Square → Bank (District/Circle)" },
      { destination: "Canary Wharf", time: "28 min", mode: "Tube", via: "Sloane Square → Canary Wharf (District/Jubilee)" },
      { destination: "Heathrow T2/T3", time: "45 min", mode: "Tube", via: "Sloane Square → Heathrow (District/Piccadilly)" },
      { destination: "West End (South Kensington)", time: "5 min", mode: "Tube", via: "Sloane Square → South Kensington (District/Circle)" },
    ],
    planningActivity: {
      recentApplications: 287,
      majorDevelopments: "Royal Brompton Hospital redevelopment (Chelsea & Westminster NHS Trust — long-term phased). Lots Road Power Station (mixed-use, 740 units, completing 2025–26). Duke of York Square retail expansion (minor).",
      councilPortalUrl: "https://www.rbkc.gov.uk/planning-and-building-control/planning-applications-and-decisions",
      note: "RBKC is one of London's most restrictive planning authorities. Conservation area coverage across SW3 is near-total. The Lots Road development is the most significant residential addition in a decade.",
    },
    rentalMarket: {
      oneBedAskingRent: "£2,800 pcm",
      twoBedAskingRent: "£4,600 pcm",
      threeBedAskingRent: "£8,200 pcm",
      oneBedYield: "3.1%",
      twoBedYield: "2.9%",
      demandLevel: "Very High",
      note: "Chelsea rental demand is driven by the professional/financial sector and international families. King's Road and Sloane Square proximity command significant premiums. Void periods on quality stock are typically under 2 weeks.",
    },
    broadband: {
      avgDownloadSpeed: "195 Mbps",
      fullFibreAvailability: "78%",
      rating: "Excellent",
      providers: "Openreach FTTP, Virgin Media, Hyperoptic",
      note: "Strong fibre availability across SW3. Older mansion blocks in some streets are served by FTTC rather than full FTTP — worth checking at address level via Openreach checker before exchange.",
    },
    airQuality: {
      no2Level: "33 µg/m³",
      pm25Level: "12 µg/m³",
      rating: "Moderate",
      note: "King's Road and Fulham Road carry significant traffic. Quieter streets within the SW3 grid — Carlyle Square, Jubilee Place — return cleaner readings. ULEZ zone compliance has reduced NO₂ measurably since 2023.",
    },
    rentalDemand: {
      avgDaysToLet: 14,
      vsNationalAvg: "3× faster than national average (42 days)",
      score: 9,
      note: "Chelsea consistently ranks among London's top 5 rental demand postcodes. 1-bed flats average 14 days to let; 2-beds average 18 days. International family demand for 3-bed+ is the most competitive segment — supply is extremely tight.",
    },
    nearbyDevelopments: [
      { name: "Lots Road Power Station", type: "Mixed-use", status: "Under construction (completing 2025–26)", impact: "Positive", detail: "740 residential units, retail, and community space on the former power station site at the SW3/SW10 border. Adds supply to Chelsea World's End — watch for any short-term softening in the SW10 overlap zone." },
      { name: "Royal Brompton Hospital Site", type: "Residential", status: "Proposed (long-term)", impact: "Positive", detail: "NHS England's long-term plan to consolidate heart and lung services may release the Royal Brompton site on Fulham Road for residential development. Timeline uncertain — 5+ years." },
    ],
    recentSoldPrices: [
      { address: "Cheyne Walk SW3", price: "£7,850,000", date: "Feb 2025", type: "Terraced", lat: 51.4832, lng: -0.1699 },
      { address: "Carlyle Square SW3", price: "£3,200,000", date: "Jan 2025", type: "Terraced", lat: 51.4872, lng: -0.1688 },
      { address: "Sloane Avenue SW3", price: "£1,450,000", date: "Mar 2025", type: "Flat", lat: 51.4900, lng: -0.1700 },
      { address: "Jubilee Place SW3", price: "£2,100,000", date: "Dec 2024", type: "Flat", lat: 51.4878, lng: -0.1671 },
      { address: "Flood Street SW3", price: "£4,500,000", date: "Jan 2025", type: "Terraced", lat: 51.4843, lng: -0.1662 },
    ],
  },

  // ─── W1 — Mayfair / Marylebone / Soho ────────────────────────────────────
  W1: {
    floodRisk: {
      zone: "Zone 1 (Low)",
      surfaceWater: "Low",
      riskBadge: "Low",
      detail: "W1 sits on well-drained gravel terraces above tidal flood level. The area has no significant surface water flood risk. The Fleet and Tyburn rivers (both now culverted) run beneath parts of Marylebone but pose no flood risk to surface properties.",
    },
    councilTax: {
      mostCommonBand: "Band G",
      annualCost: "£2,642",
      borough: "City of Westminster",
      note: "Westminster's exceptionally low council tax rate (subsidised by commercial rate income) applies across W1. A Band G property at £15m pays the same annual council tax as a Band G property at £1.5m — a significant effective discount for prime buyers.",
    },
    propertyTypeSplit: { flats: 83, terraced: 10, semiDetached: 2, detached: 2, other: 3, dominantType: "Flats overwhelmingly dominate at 83% — reflecting W1's position as London's highest-density residential postcode" },
    commuteTable: [
      { destination: "City of London", time: "10 min", mode: "Tube", via: "Bond Street → Bank (Central/Jubilee)" },
      { destination: "Canary Wharf", time: "16 min", mode: "Tube", via: "Bond Street → Canary Wharf (Jubilee)" },
      { destination: "Heathrow T2/T3", time: "38 min", mode: "Tube", via: "Bond Street → Heathrow (Elizabeth line)" },
      { destination: "Paddington", time: "6 min", mode: "Tube", via: "Bond Street (Elizabeth line/Jubilee)" },
    ],
    planningActivity: {
      recentApplications: 418,
      majorDevelopments: "Oxford Street District masterplan (Westminster City Council/TfL — pedestrianisation and public realm, phased 2025–2030). Soho Place (completed 2024 — Apollo/Lyric Theatre and offices above). Howard de Walden Estate ongoing refurbishments throughout Marylebone.",
      councilPortalUrl: "https://www.westminster.gov.uk/planning-and-building-control/planning-applications",
      note: "Oxford Street pedestrianisation (if delivered) would be transformative for W1 residential values on adjoining streets. Marylebone is well-protected by the Howard de Walden Estate's stewardship — applications for demolition or material change of use are typically resisted.",
    },
    rentalMarket: {
      oneBedAskingRent: "£3,200 pcm",
      twoBedAskingRent: "£5,400 pcm",
      threeBedAskingRent: "£9,500 pcm",
      oneBedYield: "3.4%",
      twoBedYield: "3.1%",
      demandLevel: "Very High",
      note: "W1 BTL demand is permanently elevated by financial sector employment, luxury retail, and international tenant demand. Marylebone's 1-beds are among the most liquid rental assets in London — 1-week void periods are achievable on well-presented stock.",
    },
    broadband: {
      avgDownloadSpeed: "240 Mbps",
      fullFibreAvailability: "91%",
      rating: "Excellent",
      providers: "Openreach FTTP, Virgin Media, Hyperoptic, CityFibre",
      note: "W1 has the highest full fibre availability of any London residential postcode — driven by commercial district infrastructure. Hyperoptic serves the majority of new-build and converted residential blocks throughout Marylebone and Mayfair.",
    },
    airQuality: {
      no2Level: "42 µg/m³",
      pm25Level: "15 µg/m³",
      rating: "Moderate",
      note: "Oxford Street historically had the worst NO₂ readings in Europe. ULEZ expansion and bus fleet electrification have reduced readings substantially, but W1 remains above WHO guidelines. Marylebone High Street and the quieter Howard de Walden estate streets return cleaner readings than the main commercial corridors.",
    },
    rentalDemand: {
      avgDaysToLet: 9,
      vsNationalAvg: "4.7× faster than national average (42 days)",
      score: 10,
      note: "W1 is London's most liquid rental market. 1-bed apartments in Marylebone average 9 days to let; 2-beds average 13 days. International demand, financial sector relocation, and short-let premium pricing make W1 one of the strongest yield postcodes in Zone 1 relative to purchase price.",
    },
    nearbyDevelopments: [
      { name: "Oxford Street Pedestrianisation", type: "Transport/Public Realm", status: "Phased delivery 2025–2030", impact: "Positive", detail: "Westminster's plan to pedestrianise Oxford Street and create a major public realm improvement. If delivered, would materially lift residential values on adjoining streets — particularly W1C and W1U sub-sectors." },
      { name: "Soho Place", type: "Commercial/Cultural", status: "Complete (2024)", impact: "Positive", detail: "New Apollo Theatre above Tottenham Court Road Elizabeth line entrance. Enhances Soho's cultural offer and footfall — net positive for W1D residential values." },
    ],
    recentSoldPrices: [
      { address: "Grosvenor Square W1K", price: "£12,500,000", date: "Jan 2025", type: "Flat", lat: 51.5121, lng: -0.1536 },
      { address: "Wimpole Street W1G", price: "£3,800,000", date: "Feb 2025", type: "Flat", lat: 51.5188, lng: -0.1479 },
      { address: "Chiltern Street W1U", price: "£2,100,000", date: "Mar 2025", type: "Flat", lat: 51.5213, lng: -0.1565 },
      { address: "Manchester Square W1U", price: "£5,400,000", date: "Dec 2024", type: "Flat", lat: 51.5172, lng: -0.1536 },
      { address: "Blandford Street W1U", price: "£1,650,000", date: "Jan 2025", type: "Flat", lat: 51.5208, lng: -0.1581 },
    ],
  },

  // ─── W8 — Kensington ──────────────────────────────────────────────────────
  W8: {
    floodRisk: {
      zone: "Zone 1 (Low)",
      surfaceWater: "Low",
      riskBadge: "Low",
      detail: "W8 has no significant flood risk. The area sits on elevated gravel and brick earth geology well above any tidal or fluvial flood levels. Surface water drainage infrastructure is well-maintained under RBKC.",
    },
    councilTax: {
      mostCommonBand: "Band G",
      annualCost: "£1,698",
      borough: "Royal Borough of Kensington & Chelsea",
      note: "RBKC's council tax is the lowest in London. Band G (£1,698/yr) covers the majority of W8 properties. Holland Park townhouses (Band H) pay £2,022/yr — extraordinary value relative to property values in the £5m–£20m range.",
    },
    propertyTypeSplit: { flats: 62, terraced: 24, semiDetached: 7, detached: 5, other: 2, dominantType: "Flats at 62% with a significant terraced house stock (24%) — reflects Victorian terrace grid around Holland Park" },
    commuteTable: [
      { destination: "City of London", time: "22 min", mode: "Tube", via: "High Street Kensington → Bank (District/Circle)" },
      { destination: "Canary Wharf", time: "31 min", mode: "Tube", via: "High Street Kensington → Canary Wharf (District/Jubilee)" },
      { destination: "Heathrow T2/T3", time: "35 min", mode: "Tube", via: "High Street Kensington → Heathrow (District/Piccadilly)" },
      { destination: "West End (Bond Street)", time: "14 min", mode: "Tube", via: "High Street Kensington → Bond Street (Circle/Central)" },
    ],
    planningActivity: {
      recentApplications: 198,
      majorDevelopments: "Kensington Forum Hotel (Cromwell Road — major refurbishment/extension, ongoing). Phillimore Estate incremental restoration programme. No major residential development schemes within W8 — planning restrictions effectively prevent it.",
      councilPortalUrl: "https://www.rbkc.gov.uk/planning-and-building-control/planning-applications-and-decisions",
      note: "RBKC's Kensington conservation area framework makes material new residential supply in W8 effectively impossible. This is a structural positive for existing owners — values are protected by absolute supply constraint.",
    },
    rentalMarket: {
      oneBedAskingRent: "£2,500 pcm",
      twoBedAskingRent: "£4,000 pcm",
      threeBedAskingRent: "£7,200 pcm",
      oneBedYield: "2.9%",
      twoBedYield: "2.7%",
      demandLevel: "High",
      note: "W8 attracts long-term tenants — international families with children in nearby schools, and executives from the tech and media sectors. Void periods on quality stock are typically 2–3 weeks. The family house market (4-bed+) is the most liquid segment.",
    },
    broadband: {
      avgDownloadSpeed: "185 Mbps",
      fullFibreAvailability: "74%",
      rating: "Good",
      providers: "Openreach FTTP, Virgin Media, Hyperoptic",
      note: "Good fibre availability in newer builds and converted flats. Some Victorian terraces in W8 are still on FTTC — worth confirming via Openreach checker. Virgin Media cable covers most of the postcode.",
    },
    airQuality: {
      no2Level: "29 µg/m³",
      pm25Level: "11 µg/m³",
      rating: "Moderate",
      note: "W8 is quieter than neighbouring W1 and SW7 in terms of traffic pollution. Holland Park itself returns near-rural readings. The A4 Cromwell Road border (south) elevates readings on adjacent streets — garden square interiors are significantly cleaner.",
    },
    rentalDemand: {
      avgDaysToLet: 18,
      vsNationalAvg: "2.3× faster than national average (42 days)",
      score: 8,
      note: "W8 family houses (3–4 bed) are the fastest-letting segment — typically under 2 weeks. 1-bed flats average 18–22 days. School year timing drives a September/January spike in demand from international families relocating.",
    },
    nearbyDevelopments: [
      { name: "Kensington Forum Hotel Extension", type: "Commercial", status: "Under construction", impact: "Neutral", detail: "Large hotel refurbishment on Cromwell Road. Construction noise/traffic on the W8/SW7 border during build phase — not expected to impact residential values post-completion." },
      { name: "Holland Park School Expansion", type: "Commercial", status: "Planning approved", impact: "Positive", detail: "RBKC-approved expansion of Holland Park School (Outstanding Ofsted) — increases capacity and strengthens the school premium that underpins W8 residential values." },
    ],
    recentSoldPrices: [
      { address: "Phillimore Gardens W8", price: "£7,200,000", date: "Feb 2025", type: "Terraced", lat: 51.5012, lng: -0.1992 },
      { address: "Edwardes Square W8", price: "£4,800,000", date: "Jan 2025", type: "Terraced", lat: 51.4982, lng: -0.1942 },
      { address: "Holland Park W8", price: "£9,500,000", date: "Mar 2025", type: "Detached", lat: 51.5032, lng: -0.2002 },
      { address: "Pembridge Villas W8", price: "£2,200,000", date: "Dec 2024", type: "Flat", lat: 51.5105, lng: -0.1980 },
      { address: "Kensington Court W8", price: "£1,800,000", date: "Jan 2025", type: "Flat", lat: 51.5006, lng: -0.1907 },
    ],
  },

  // ─── W11 — Notting Hill ───────────────────────────────────────────────────
  W11: {
    floodRisk: {
      zone: "Zone 1 (Low)",
      surfaceWater: "Low — isolated medium risk on Westbourne basin streets",
      riskBadge: "Low",
      detail: "W11 is generally low flood risk. The Westbourne river (culverted) runs beneath parts of the postcode near Notting Hill Gate — some streets at the W2 border show medium surface water risk on EA mapping, but this is unlikely to affect properties built above ground level.",
    },
    councilTax: {
      mostCommonBand: "Band F",
      annualCost: "£1,614",
      borough: "Royal Borough of Kensington & Chelsea",
      note: "RBKC's low council tax rate applies across W11. Band F (most common for Notting Hill flats and terraced houses) is £1,614/yr. Garden square houses typically fall in Band G (£1,698/yr) or H (£2,022/yr).",
    },
    propertyTypeSplit: { flats: 58, terraced: 33, semiDetached: 6, detached: 2, other: 1, dominantType: "Flats (58%) and terraced houses (33%) — the Notting Hill Victorian terrace stock is among the finest in London" },
    commuteTable: [
      { destination: "City of London", time: "20 min", mode: "Tube", via: "Notting Hill Gate → Bank (Central/Circle)" },
      { destination: "Canary Wharf", time: "30 min", mode: "Tube", via: "Notting Hill Gate → Canary Wharf (Central/Jubilee)" },
      { destination: "Heathrow T2/T3", time: "32 min", mode: "Tube", via: "Notting Hill Gate → Heathrow (Central/Piccadilly)" },
      { destination: "West End (Oxford Circus)", time: "10 min", mode: "Tube", via: "Notting Hill Gate → Oxford Circus (Central)" },
    ],
    planningActivity: {
      recentApplications: 224,
      majorDevelopments: "Portobello Village area public realm improvements (RBKC, ongoing). Notting Hill Gate Junction improvements (TfL cycling/pedestrian scheme, approved 2024). No major residential development — planning restrictions effective.",
      councilPortalUrl: "https://www.rbkc.gov.uk/planning-and-building-control/planning-applications-and-decisions",
      note: "W11 conservation area coverage is comprehensive. Portobello Road's retail character is protected by Article 4 directions restricting change of use. New residential supply is limited to occasional basement conversions and loft extensions.",
    },
    rentalMarket: {
      oneBedAskingRent: "£2,400 pcm",
      twoBedAskingRent: "£3,900 pcm",
      threeBedAskingRent: "£6,800 pcm",
      oneBedYield: "3.0%",
      twoBedYield: "2.8%",
      demandLevel: "High",
      note: "Notting Hill rental demand is driven by creative industry professionals, young families, and international tenants drawn by the area's lifestyle offer. Portobello Road-facing flats command a charm premium — but Saturday market noise is a legitimate disclosure point.",
    },
    broadband: {
      avgDownloadSpeed: "178 Mbps",
      fullFibreAvailability: "71%",
      rating: "Good",
      providers: "Openreach FTTP, Virgin Media, Sky Ultrafast",
      note: "Good coverage across W11 with Virgin Media cable available on most streets. Some Victorian terrace conversions remain on FTTC — full fibre rollout is ongoing under the government's Project Gigabit programme.",
    },
    airQuality: {
      no2Level: "31 µg/m³",
      pm25Level: "12 µg/m³",
      rating: "Moderate",
      note: "Holland Park Avenue (A4018) is the primary pollution corridor in W11. Side streets and garden squares away from the main road return cleaner readings. The W11 air quality is meaningfully better than W1/SW1 due to lower through-traffic volumes.",
    },
    rentalDemand: {
      avgDaysToLet: 16,
      vsNationalAvg: "2.6× faster than national average (42 days)",
      score: 8,
      note: "W11's lifestyle premium sustains strong rental demand. Houses on the best streets (Elgin Crescent, Ledbury Road) let quickly with minimal void — typically under 2 weeks for well-presented stock. Carnival weekend (August Bank Holiday) creates a short-term letting spike on premium properties.",
    },
    nearbyDevelopments: [
      { name: "Notting Hill Gate Junction Improvements", type: "Transport", status: "Approved 2024", impact: "Positive", detail: "TfL scheme to improve cycling and pedestrian access at the Notting Hill Gate junction. Minor construction disruption during delivery — positive long-term public realm outcome." },
      { name: "Portobello Village Public Realm", type: "Commercial", status: "Ongoing", impact: "Positive", detail: "RBKC incremental improvements to Portobello Road's public realm — repaving, lighting, market infrastructure. Strengthens the area's character and the premium buyers pay for it." },
    ],
    recentSoldPrices: [
      { address: "Elgin Crescent W11", price: "£3,800,000", date: "Feb 2025", type: "Terraced", lat: 51.5148, lng: -0.2069 },
      { address: "Ledbury Road W11", price: "£5,200,000", date: "Jan 2025", type: "Terraced", lat: 51.5168, lng: -0.2024 },
      { address: "Ladbroke Grove W11", price: "£1,650,000", date: "Mar 2025", type: "Flat", lat: 51.5133, lng: -0.2085 },
      { address: "Stanley Gardens W11", price: "£4,100,000", date: "Dec 2024", type: "Terraced", lat: 51.5158, lng: -0.2056 },
      { address: "Pembridge Road W11", price: "£1,450,000", date: "Jan 2025", type: "Flat", lat: 51.5128, lng: -0.1990 },
    ],
  },

  // ─── NW3 — Hampstead ──────────────────────────────────────────────────────
  NW3: {
    floodRisk: {
      zone: "Zone 1 (Low) — except Hampstead Heath ponds area",
      surfaceWater: "Low — medium risk adjacent to Heath ponds",
      riskBadge: "Low",
      detail: "NW3 is low flood risk. The Hampstead Heath swimming ponds (Highgate/Hampstead) are in a managed flood zone but residential streets are not at risk. The Fleet river headwaters rise in the Heath — streets adjacent to the Vale of Health pond show isolated surface water risk.",
    },
    councilTax: {
      mostCommonBand: "Band F",
      annualCost: "£1,788",
      borough: "London Borough of Camden",
      note: "Camden's council tax is higher than RBKC and Westminster but remains below the London average. Band F (most common in Belsize Park and South Hampstead) is £1,788/yr. Hampstead village houses (Band G/H) pay £2,086–£2,384/yr.",
    },
    propertyTypeSplit: { flats: 52, terraced: 30, semiDetached: 12, detached: 6, other: 0, dominantType: "A balanced split between flats (52%) and houses (48%) — NW3 has one of the highest proportions of detached houses of any inner London postcode" },
    commuteTable: [
      { destination: "City of London", time: "22 min", mode: "Tube", via: "Hampstead → Bank (Northern line)" },
      { destination: "Canary Wharf", time: "35 min", mode: "Tube", via: "Hampstead → Canary Wharf (Northern/Jubilee)" },
      { destination: "West End (Oxford Circus)", time: "15 min", mode: "Tube", via: "Hampstead → Tottenham Court Road (Northern)" },
      { destination: "Heathrow T2/T3", time: "55 min", mode: "Tube", via: "Hampstead → Heathrow (Northern/Piccadilly)" },
    ],
    planningActivity: {
      recentApplications: 176,
      majorDevelopments: "Hampstead Town conservation area — no major developments. Swiss Cottage leisure centre refurbishment (Camden, ongoing). Occasional large basement extensions in Hampstead village (subject to Camden's Basement Development Policy).",
      councilPortalUrl: "https://www.camden.gov.uk/planning-applications",
      note: "Camden has some of London's toughest basement extension policies following flood and structural concerns — relevant for NW3 buyers considering a major extension. Conservation area status constrains virtually all external alterations in Hampstead village.",
    },
    rentalMarket: {
      oneBedAskingRent: "£2,100 pcm",
      twoBedAskingRent: "£3,400 pcm",
      threeBedAskingRent: "£5,800 pcm",
      oneBedYield: "3.2%",
      twoBedYield: "3.0%",
      demandLevel: "High",
      note: "NW3 attracts a specific, high-quality tenant profile — academics, professionals, and families drawn by the Heath and the schools. Demand is strongest for 3–4 bed houses; 1-bed flat demand is more seasonal. New End Primary catchment addresses command a meaningful rent premium.",
    },
    broadband: {
      avgDownloadSpeed: "165 Mbps",
      fullFibreAvailability: "68%",
      rating: "Good",
      providers: "Openreach FTTP, Virgin Media, Sky Ultrafast",
      note: "Full fibre availability in NW3 is slightly below the London average — Hampstead village's heritage street infrastructure has slowed rollout. The majority of Belsize Park is well served. Project Gigabit fibre expansion is ongoing across the NW3 footprint.",
    },
    airQuality: {
      no2Level: "22 µg/m³",
      pm25Level: "9 µg/m³",
      rating: "Good",
      note: "NW3 has some of the best air quality of any inner London postcode — Hampstead Heath (790 acres) acts as a significant clean air buffer. Streets adjacent to Finchley Road (A504) return higher readings, but the Heath-adjacent village core is well within WHO guidelines.",
    },
    rentalDemand: {
      avgDaysToLet: 21,
      vsNationalAvg: "2× faster than national average (42 days)",
      score: 8,
      note: "NW3 rental demand is characterised by long tenancies (2–4 years) and low void rates rather than rapid turnover. Families with Heath proximity requirements are loyal tenants. Academic year timing (UCL, Royal Free Hospital) drives a September demand peak.",
    },
    nearbyDevelopments: [
      { name: "Swiss Cottage Leisure Centre", type: "Commercial", status: "Refurbishment ongoing", impact: "Positive", detail: "Camden's major refurbishment of Swiss Cottage Leisure Centre (NW3 south). Improves local amenity — net positive for NW3 values on the Belsize Park/Swiss Cottage border." },
      { name: "Hampstead Heath Management Plan", type: "Green Space", status: "Ongoing (City of London)", impact: "Positive", detail: "City of London's rolling Heath management improvements — paths, ponds, woodland management. The Heath's quality is a fundamental driver of NW3 values and is actively maintained." },
    ],
    recentSoldPrices: [
      { address: "Cannon Place NW3", price: "£5,800,000", date: "Feb 2025", type: "Detached", lat: 51.5564, lng: -0.1752 },
      { address: "Well Walk NW3", price: "£4,200,000", date: "Jan 2025", type: "Terraced", lat: 51.5573, lng: -0.1682 },
      { address: "Belsize Avenue NW3", price: "£2,800,000", date: "Mar 2025", type: "Terraced", lat: 51.5504, lng: -0.1668 },
      { address: "Eton Avenue NW3", price: "£3,500,000", date: "Dec 2024", type: "Terraced", lat: 51.5512, lng: -0.1732 },
      { address: "England's Lane NW3", price: "£1,200,000", date: "Jan 2025", type: "Flat", lat: 51.5483, lng: -0.1644 },
    ],
  },

  // ─── NW1 — Primrose Hill / Camden ─────────────────────────────────────────
  NW1: {
    floodRisk: {
      zone: "Zone 2 (Medium) — Regent's Canal corridor",
      surfaceWater: "Low–Medium",
      riskBadge: "Medium",
      detail: "Most of NW1 is Zone 1 (Low). The Regent's Canal corridor (Camden Lock area, Regent's Park Road south) is EA Zone 2 (Medium). Properties within 50m of the canal should be checked individually. The Canal & River Trust manages flood risk actively.",
    },
    councilTax: {
      mostCommonBand: "Band E",
      annualCost: "£1,574",
      borough: "London Borough of Camden",
      note: "Camden Band E covers most NW1 flats and smaller terraced houses. Camden's rate is moderate by London standards. Primrose Hill houses (Band G) pay £2,086/yr.",
    },
    propertyTypeSplit: { flats: 61, terraced: 28, semiDetached: 7, detached: 2, other: 2, dominantType: "Flats at 61% with a strong terraced house stock (28%) — the Primrose Hill Regency grid contains some of London's most desirable terraces" },
    commuteTable: [
      { destination: "City of London", time: "18 min", mode: "Tube", via: "Chalk Farm → Bank (Northern line)" },
      { destination: "Canary Wharf", time: "32 min", mode: "Tube", via: "Camden Town → Canary Wharf (Northern/Jubilee)" },
      { destination: "West End (Oxford Circus)", time: "12 min", mode: "Tube", via: "Camden Town → Oxford Circus (Northern/Victoria)" },
      { destination: "Heathrow T2/T3", time: "52 min", mode: "Tube", via: "Camden Town → Heathrow (Northern/Piccadilly)" },
    ],
    planningActivity: {
      recentApplications: 198,
      majorDevelopments: "King's Cross/NW1 2 regeneration (Google DeepMind campus, Coal Drops Yard — substantially complete). Regent's Park Road area — incremental conservation works. Euston HS2 station (NW1 2 — major infrastructure, 2026–2032 construction phase).",
      councilPortalUrl: "https://www.camden.gov.uk/planning-applications",
      note: "Euston HS2 construction is the most significant nearby development — noise and disruption will affect NW1 2 properties for ~6 years. Primrose Hill and Regent's Park Road are well removed from the HS2 zone. The King's Cross regeneration has structurally boosted NW1 9 values.",
    },
    rentalMarket: {
      oneBedAskingRent: "£2,000 pcm",
      twoBedAskingRent: "£3,200 pcm",
      threeBedAskingRent: "£5,200 pcm",
      oneBedYield: "3.5%",
      twoBedYield: "3.2%",
      demandLevel: "High",
      note: "NW1 rental demand is driven by creative, media, and tech professionals. Primrose Hill properties attract particularly high-quality tenants — long tenancies, low void rates. Camden Town's rental market is more transient but achieves strong yields on 1-bed stock.",
    },
    broadband: {
      avgDownloadSpeed: "172 Mbps",
      fullFibreAvailability: "72%",
      rating: "Good",
      providers: "Openreach FTTP, Virgin Media, Hyperoptic (King's Cross zone)",
      note: "Good fibre availability with King's Cross/NW1 9 particularly well-served by commercial infrastructure rollout. Primrose Hill's residential streets have seen progressive full fibre rollout. Camden Town area is well covered by Virgin Media cable.",
    },
    airQuality: {
      no2Level: "27 µg/m³",
      pm25Level: "11 µg/m³",
      rating: "Moderate",
      note: "NW1's air quality varies significantly within the postcode. Camden Town (high bus and traffic volume) returns elevated NO₂. Primrose Hill and the Regent's Park boundary return significantly cleaner readings — comparable to NW3 in parts.",
    },
    rentalDemand: {
      avgDaysToLet: 17,
      vsNationalAvg: "2.5× faster than national average (42 days)",
      score: 8,
      note: "Primrose Hill houses are among the most sought-after rental properties in north London — typically let within 2 weeks with multiple competing applicants. Camden Town 1-beds let fastest (10–14 days) due to high demand from young professionals.",
    },
    nearbyDevelopments: [
      { name: "Euston HS2 Station", type: "Transport", status: "Under construction (2026–2032)", impact: "Monitor", detail: "Major construction phase for HS2's Euston terminus will cause significant noise, traffic, and disruption within ~500m. Longer-term (post-2033), a new major terminus would be a structural positive for NW1 values. Monitor closely if considering NW1 2 properties." },
      { name: "Google DeepMind King's Cross Campus", type: "Commercial", status: "Complete (2024)", impact: "Positive", detail: "Google DeepMind's consolidated London HQ at King's Cross brings 7,000+ high-salary employees to NW1's doorstep. Structural demand driver for NW1 9 and adjacent NW1 2 residential values." },
    ],
    recentSoldPrices: [
      { address: "Fitzroy Road NW1", price: "£4,800,000", date: "Feb 2025", type: "Terraced", lat: 51.5415, lng: -0.1636 },
      { address: "Chalcot Crescent NW1", price: "£3,900,000", date: "Jan 2025", type: "Terraced", lat: 51.5432, lng: -0.1620 },
      { address: "Regent's Park Road NW1", price: "£5,200,000", date: "Mar 2025", type: "Terraced", lat: 51.5421, lng: -0.1607 },
      { address: "Albert Street NW1", price: "£1,450,000", date: "Dec 2024", type: "Flat", lat: 51.5368, lng: -0.1424 },
      { address: "Delancey Street NW1", price: "£950,000", date: "Jan 2025", type: "Flat", lat: 51.5378, lng: -0.1436 },
    ],
  },

  // ─── N1 — Islington ───────────────────────────────────────────────────────
  N1: {
    floodRisk: {
      zone: "Zone 1 (Low)",
      surfaceWater: "Low — isolated medium risk near New River walk",
      riskBadge: "Low",
      detail: "N1 is low flood risk. The New River walk (a former water supply channel, now a green corridor) creates isolated surface water risk on immediately adjacent streets but has not caused residential flooding in recent history.",
    },
    councilTax: {
      mostCommonBand: "Band D",
      annualCost: "£1,619",
      borough: "London Borough of Islington",
      note: "Islington's council tax is mid-range for inner London. Band D (most common for N1 flats and smaller houses) is £1,619/yr. Barnsbury garden square houses (Band F/G) pay £2,019–£2,321/yr.",
    },
    propertyTypeSplit: { flats: 63, terraced: 30, semiDetached: 5, detached: 1, other: 1, dominantType: "Flats at 63% and terraced houses at 30% — Barnsbury's Georgian terraces and Islington's Victorian stock provide the house supply" },
    commuteTable: [
      { destination: "City of London", time: "10 min", mode: "Tube", via: "Angel → Bank (Northern line)" },
      { destination: "Canary Wharf", time: "20 min", mode: "Tube", via: "Angel → Canary Wharf (Northern/Jubilee)" },
      { destination: "West End (Oxford Circus)", time: "12 min", mode: "Tube", via: "Angel → Oxford Circus (Northern/Victoria)" },
      { destination: "Heathrow T2/T3", time: "50 min", mode: "Tube", via: "Angel → Heathrow (Northern/Piccadilly)" },
    ],
    planningActivity: {
      recentApplications: 231,
      majorDevelopments: "Angel Central redevelopment (retail, ongoing refurbishment). Pentonville Road streetscape improvements. King's Cross NW1/N1 border regeneration spill-over — several commercial-to-residential conversions approved.",
      councilPortalUrl: "https://www.islington.gov.uk/planning/planning-applications",
      note: "Islington has a progressive planning stance on affordable housing requirements but a protective attitude to the Barnsbury conservation area. Conversions of commercial buildings on the EC1 fringe are the primary source of new N1 residential supply.",
    },
    rentalMarket: {
      oneBedAskingRent: "£2,100 pcm",
      twoBedAskingRent: "£3,100 pcm",
      threeBedAskingRent: "£4,800 pcm",
      oneBedYield: "3.8%",
      twoBedYield: "3.5%",
      demandLevel: "Very High",
      note: "N1's Angel/Upper Street location makes it one of London's most liquid rental postcodes. City worker demand, tech sector (Silicon Roundabout), and the extensive restaurant/bar scene drive year-round demand. 1-bed flats have among the highest rental yield in Zone 1 London.",
    },
    broadband: {
      avgDownloadSpeed: "198 Mbps",
      fullFibreAvailability: "81%",
      rating: "Excellent",
      providers: "Openreach FTTP, Virgin Media, CityFibre, Hyperoptic",
      note: "N1's proximity to the EC1 tech cluster has driven excellent fibre infrastructure. CityFibre has an active buildout in the N1/EC1 corridor. Very good speeds throughout the postcode.",
    },
    airQuality: {
      no2Level: "34 µg/m³",
      pm25Level: "13 µg/m³",
      rating: "Moderate",
      note: "Upper Street and the A1 are the primary pollution corridors. Barnsbury's residential streets are measurably cleaner. ULEZ has improved readings across N1 significantly since 2023. Garden square interiors approach WHO guidelines.",
    },
    rentalDemand: {
      avgDaysToLet: 11,
      vsNationalAvg: "3.8× faster than national average (42 days)",
      score: 9,
      note: "N1 is consistently one of London's top 5 rental demand postcodes. 1-bed flats average 11 days to let; 2-beds average 15 days. Multiple competing applications are the norm on well-presented stock. Short-let premium on Angel/Upper Street-adjacent properties is significant.",
    },
    nearbyDevelopments: [
      { name: "Angel Central", type: "Commercial", status: "Refurbishment ongoing", impact: "Positive", detail: "Ongoing improvement to the Angel Central retail destination strengthens N1's amenity offer — net positive for adjacent residential values." },
      { name: "King's Cross Ripple Effect", type: "Residential/Commercial", status: "Ongoing", impact: "Positive", detail: "The King's Cross regeneration continues to push values northward into N1's southern border (EC1/N1 transition zone). Properties on the Caledonian Road corridor are benefiting from progressive gentrification." },
    ],
    recentSoldPrices: [
      { address: "Gibson Square N1", price: "£3,200,000", date: "Feb 2025", type: "Terraced", lat: 51.5374, lng: -0.1015 },
      { address: "Lonsdale Square N1", price: "£2,800,000", date: "Jan 2025", type: "Terraced", lat: 51.5365, lng: -0.1037 },
      { address: "Upper Street N1", price: "£1,100,000", date: "Mar 2025", type: "Flat", lat: 51.5381, lng: -0.1020 },
      { address: "Cloudesley Road N1", price: "£1,850,000", date: "Dec 2024", type: "Terraced", lat: 51.5360, lng: -0.1074 },
      { address: "Barnsbury Street N1", price: "£2,400,000", date: "Jan 2025", type: "Terraced", lat: 51.5387, lng: -0.1098 },
    ],
  },

  // ─── E1 — Spitalfields / Whitechapel ──────────────────────────────────────
  E1: {
    floodRisk: {
      zone: "Zone 2 (Medium) — eastern E1 near Lea Valley",
      surfaceWater: "Medium",
      riskBadge: "Medium",
      detail: "Western E1 (Spitalfields, Brick Lane) is Zone 1 (Low). Eastern E1 (Whitechapel, Stepney) sits in EA Zone 2 (Medium). The Thames Tideway and Bazalgette tunnels reduce combined sewer overflow risk. Properties below ground level in the Whitechapel corridor warrant additional survey scrutiny.",
    },
    councilTax: {
      mostCommonBand: "Band C",
      annualCost: "£1,196",
      borough: "London Borough of Tower Hamlets",
      note: "Tower Hamlets' council tax is below the London average. Band C (most common for E1 flats) is £1,196/yr — significantly lower than equivalent Zone 1 properties in Westminster or RBKC. Whitechapel terraced houses typically fall in Band D (£1,594/yr).",
    },
    propertyTypeSplit: { flats: 76, terraced: 16, semiDetached: 3, detached: 1, other: 4, dominantType: "Flats overwhelmingly dominate at 76% — a mix of period conversions, warehouse lofts, and new-build residential towers" },
    commuteTable: [
      { destination: "City of London", time: "7 min", mode: "Tube", via: "Liverpool Street (Elizabeth line/Central/Circle)" },
      { destination: "Canary Wharf", time: "12 min", mode: "Tube", via: "Whitechapel → Canary Wharf (Elizabeth line)" },
      { destination: "Heathrow T2/T3", time: "44 min", mode: "Elizabeth line", via: "Whitechapel → Heathrow (Elizabeth line direct)" },
      { destination: "West End (Bond Street)", time: "14 min", mode: "Elizabeth line", via: "Whitechapel → Bond Street (Elizabeth line)" },
    ],
    planningActivity: {
      recentApplications: 298,
      majorDevelopments: "Whitechapel masterplan (Tower Hamlets — major mixed-use regeneration around the new Elizabeth line station, 5,000+ homes in pipeline). Truman Brewery site (Brick Lane — ongoing dispute between developer and community; planning contended). Aldgate Tower area new-builds ongoing.",
      councilPortalUrl: "https://www.towerhamlets.gov.uk/lgnl/planning_and_building_control/planning_applications/planning_applications.aspx",
      note: "E1 has the most active planning pipeline of any inner east London postcode. The Whitechapel masterplan will deliver significant new residential supply — net positive for the area's status and amenity, but monitor for short-term supply pressure on new-build pricing.",
    },
    rentalMarket: {
      oneBedAskingRent: "£2,000 pcm",
      twoBedAskingRent: "£2,900 pcm",
      threeBedAskingRent: "£4,200 pcm",
      oneBedYield: "4.4%",
      twoBedYield: "4.1%",
      demandLevel: "Very High",
      note: "E1 offers the best yield-to-Zone 1 ratio in London. Elizabeth line access to Canary Wharf (12 min) and City (7 min) drives high tenant demand from finance and tech workers. Spitalfields warehouse conversions command a significant premium over standard new-build flats.",
    },
    broadband: {
      avgDownloadSpeed: "188 Mbps",
      fullFibreAvailability: "79%",
      rating: "Excellent",
      providers: "Openreach FTTP, Virgin Media, Hyperoptic, CityFibre",
      note: "E1's commercial and tech sector presence has driven strong fibre infrastructure. New-build developments are universally FTTP. Older warehouse conversions typically have dedicated gigabit connections. Very strong coverage across the postcode.",
    },
    airQuality: {
      no2Level: "36 µg/m³",
      pm25Level: "14 µg/m³",
      rating: "Moderate",
      note: "Whitechapel Road (A11) and Commercial Road (A13) are the primary pollution corridors. Spitalfields and Brick Lane return better readings — Elder Street and the Georgian conservation area streets are noticeably cleaner. ULEZ compliance is high but heavy goods vehicle routes maintain elevated readings on major roads.",
    },
    rentalDemand: {
      avgDaysToLet: 10,
      vsNationalAvg: "4.2× faster than national average (42 days)",
      score: 9,
      note: "E1 is one of London's top 3 rental demand postcodes by days-to-let. Spitalfields 1-bed warehouse conversions average 8 days to let; standard new-build 1-beds average 12 days. Elizabeth line access to Canary Wharf has transformed E1's appeal to finance sector tenants.",
    },
    nearbyDevelopments: [
      { name: "Whitechapel Masterplan", type: "Mixed-use", status: "Planning approved, phased delivery 2024–2035", impact: "Positive", detail: "Tower Hamlets' major masterplan for Whitechapel — 5,000+ homes, a new library, public spaces, and commercial around the Elizabeth line station. Long-term transformative for E1 status and values." },
      { name: "Truman Brewery Development", type: "Mixed-use", status: "Contended — community opposition ongoing", impact: "Monitor", detail: "Developer plans for commercial/retail expansion of the Truman Brewery site on Brick Lane continue to face community opposition. Planning outcome uncertain. Monitor closely for E1/Spitalfields character implications." },
    ],
    recentSoldPrices: [
      { address: "Elder Street E1", price: "£1,850,000", date: "Feb 2025", type: "Terraced", lat: 51.5220, lng: -0.0784 },
      { address: "Princelet Street E1", price: "£2,100,000", date: "Jan 2025", type: "Terraced", lat: 51.5208, lng: -0.0738 },
      { address: "Commercial Street E1", price: "£820,000", date: "Mar 2025", type: "Flat", lat: 51.5183, lng: -0.0768 },
      { address: "Fournier Street E1", price: "£1,650,000", date: "Dec 2024", type: "Terraced", lat: 51.5204, lng: -0.0748 },
      { address: "Alie Street E1", price: "£680,000", date: "Jan 2025", type: "Flat", lat: 51.5147, lng: -0.0732 },
    ],
  },

  // ─── E8 — London Fields / Hackney ─────────────────────────────────────────
  E8: {
    floodRisk: {
      zone: "Zone 1 (Low)",
      surfaceWater: "Low–Medium near Hackney Brook",
      riskBadge: "Low",
      detail: "E8 is predominantly Zone 1 (Low). The Hackney Brook (culverted) runs beneath parts of the E8/E9 border — isolated surface water risk in the London Fields eastern periphery. The culvert has been managed by Thames Water and has not caused residential flooding in recent history.",
    },
    councilTax: {
      mostCommonBand: "Band C",
      annualCost: "£1,418",
      borough: "London Borough of Hackney",
      note: "Hackney's council tax has increased above London average in recent years but remains below Zone 1 boroughs. Band C (most common for E8 flats) is £1,418/yr. London Fields Victorian terraces (Band D/E) pay £1,890–£2,200/yr.",
    },
    propertyTypeSplit: { flats: 55, terraced: 36, semiDetached: 7, detached: 1, other: 1, dominantType: "A more balanced split than most inner east London — terraced houses at 36% reflect E8's Victorian grid, making it one of the higher-house-stock postcodes in the east" },
    commuteTable: [
      { destination: "City of London", time: "18 min", mode: "Overground", via: "London Fields → Liverpool Street (Overground)" },
      { destination: "Canary Wharf", time: "26 min", mode: "Overground/DLR", via: "London Fields → Shadwell → Canary Wharf" },
      { destination: "West End (Oxford Circus)", time: "22 min", mode: "Overground/Tube", via: "Hackney Central → Oxford Circus (Overground/Victoria)" },
      { destination: "King's Cross", time: "20 min", mode: "Overground", via: "Hackney Central → Caledonian Road (Overground)" },
    ],
    planningActivity: {
      recentApplications: 212,
      majorDevelopments: "Hackney Walk designer outlet (Mare Street — expanding). Pembury Estate regeneration (ongoing, LB Hackney). London Fields Lido refurbishment (complete 2024). Dalston Curve Garden area — several planning applications for mixed-use submitted.",
      councilPortalUrl: "https://hackney.gov.uk/planning",
      note: "Hackney Council has an active planning pipeline but also strong community resistance to developments that alter E8's independent character. The Dalston/E8 border is the most active zone for new applications.",
    },
    rentalMarket: {
      oneBedAskingRent: "£1,850 pcm",
      twoBedAskingRent: "£2,600 pcm",
      threeBedAskingRent: "£3,800 pcm",
      oneBedYield: "4.2%",
      twoBedYield: "3.9%",
      demandLevel: "High",
      note: "E8 offers strong yield relative to its cultural cachet. Broadway Market and London Fields proximity drive premium on the western side. Creative sector tenants (media, tech, arts) are the dominant demographic. Void periods on well-presented stock are typically 2–3 weeks.",
    },
    broadband: {
      avgDownloadSpeed: "162 Mbps",
      fullFibreAvailability: "65%",
      rating: "Good",
      providers: "Openreach FTTP, Virgin Media, Sky Ultrafast",
      note: "Good but not exceptional fibre availability in E8. Full fibre rollout is ongoing across Hackney — coverage improving year-on-year. Older Victorian terraces are the most likely to be on FTTC rather than FTTP.",
    },
    airQuality: {
      no2Level: "26 µg/m³",
      pm25Level: "10 µg/m³",
      rating: "Good",
      note: "E8 has notably good air quality for inner east London — lower through-traffic than E1/E2, and London Fields (31 acres) provides a local clean air buffer. Readings near the A10 Kingsland Road are higher, but residential streets away from the main road return Good-rated levels.",
    },
    rentalDemand: {
      avgDaysToLet: 15,
      vsNationalAvg: "2.8× faster than national average (42 days)",
      score: 8,
      note: "E8 rental demand is consistent and high-quality. Broadway Market-adjacent 2-beds are the fastest-letting segment (8–12 days). The creative sector tenant base tends to stay longer than average — typical tenancies are 18–24 months, reducing void frequency.",
    },
    nearbyDevelopments: [
      { name: "London Fields Lido", type: "Leisure", status: "Refurbishment complete (2024)", impact: "Positive", detail: "Hackney Council's £5m refurbishment of the E8 Lido is complete. The Lido is a significant value driver for London Fields-adjacent properties — its reopening has been positively received." },
      { name: "Hackney Walk Expansion", type: "Commercial", status: "Planning approved", impact: "Positive", detail: "Expansion of Hackney Walk designer outlet on Mare Street strengthens E8's retail and destination offer. Net positive for commercial vitality and residential values on the E8/E9 corridor." },
    ],
    recentSoldPrices: [
      { address: "Martello Street E8", price: "£1,650,000", date: "Feb 2025", type: "Terraced", lat: 51.5408, lng: -0.0558 },
      { address: "Ada Street E8", price: "£1,850,000", date: "Jan 2025", type: "Terraced", lat: 51.5395, lng: -0.0543 },
      { address: "Broadway Market E8", price: "£1,200,000", date: "Mar 2025", type: "Flat", lat: 51.5380, lng: -0.0556 },
      { address: "London Fields West Side E8", price: "£2,100,000", date: "Dec 2024", type: "Terraced", lat: 51.5413, lng: -0.0534 },
      { address: "Wilton Way E8", price: "£980,000", date: "Jan 2025", type: "Flat", lat: 51.5401, lng: -0.0527 },
    ],
  },

  // ─── SE1 — Southwark / Bermondsey / Bankside ──────────────────────────────
  SE1: {
    floodRisk: {
      zone: "Zone 2–3 (Medium–High) — Thames frontage",
      surfaceWater: "Medium",
      riskBadge: "Medium",
      detail: "SE1's Thames-adjacent properties (Bankside, Bermondsey waterfront) sit in EA Flood Zone 2–3. The Thames Barrier protects against tidal flooding in normal conditions. All riverside properties in SE1 should be checked individually — flood resilience measures (raised entry levels, flood doors) are increasingly common in newer riverside builds. Borough and Elephant & Castle are Zone 1.",
    },
    councilTax: {
      mostCommonBand: "Band D",
      annualCost: "£1,616",
      borough: "London Borough of Southwark",
      note: "Southwark's council tax is mid-range for inner London. Band D (most common for SE1 flats including NEO Bankside and riverside schemes) is £1,616/yr. A significant discount vs the equivalent property north of the river in WC2 (Westminster Band D: £1,985/yr).",
    },
    propertyTypeSplit: { flats: 82, terraced: 10, semiDetached: 3, detached: 1, other: 4, dominantType: "Flats overwhelmingly dominate at 82% — SE1's residential stock is almost entirely new-build riverside schemes and period conversions" },
    commuteTable: [
      { destination: "City of London", time: "6 min", mode: "Tube", via: "Borough → Bank (Northern line)" },
      { destination: "Canary Wharf", time: "18 min", mode: "Tube", via: "London Bridge → Canary Wharf (Jubilee)" },
      { destination: "West End (Oxford Circus)", time: "14 min", mode: "Tube", via: "Waterloo → Oxford Circus (Bakerloo/Victoria)" },
      { destination: "Heathrow T2/T3", time: "38 min", mode: "Tube", via: "Waterloo → Heathrow (Elizabeth line)" },
    ],
    planningActivity: {
      recentApplications: 276,
      majorDevelopments: "Elephant Park (Elephant & Castle regeneration — 3,000 homes, Lendlease, ongoing through 2030). Bermondsey Yards (The Old Tannery mixed-use, approved). Bankside Yards (Waterloo Road — major mixed-use, planning approved, delivery from 2025).",
      councilPortalUrl: "https://www.southwark.gov.uk/planning-and-building-control/planning-applications",
      note: "SE1 has the largest active development pipeline south of the river. Elephant Park and Bankside Yards will add significant supply over 5–7 years — monitor for impact on adjacent new-build values. The Bermondsey core is more protected.",
    },
    rentalMarket: {
      oneBedAskingRent: "£2,200 pcm",
      twoBedAskingRent: "£3,100 pcm",
      threeBedAskingRent: "£4,500 pcm",
      oneBedYield: "4.0%",
      twoBedYield: "3.7%",
      demandLevel: "Very High",
      note: "SE1 delivers strong yield relative to equivalent north-of-river locations. Bermondsey Street and Borough Market proximity drive a lifestyle premium. Finance sector demand from Canary Wharf and City workers seeking shorter commutes is structurally high. NEO Bankside and The Shard-adjacent schemes attract premium international tenants.",
    },
    broadband: {
      avgDownloadSpeed: "205 Mbps",
      fullFibreAvailability: "85%",
      rating: "Excellent",
      providers: "Openreach FTTP, Virgin Media, Hyperoptic, CityFibre",
      note: "SE1's new-build-dominated residential stock means very high fibre availability. Most post-2010 residential developments are FTTP by default. Excellent speeds particularly in the Bankside and London Bridge cluster.",
    },
    airQuality: {
      no2Level: "38 µg/m³",
      pm25Level: "14 µg/m³",
      rating: "Moderate",
      note: "Borough High Street and the major road network around London Bridge elevate NO₂ in SE1. The Thames riverside promenade returns better readings. Bermondsey Street's lower traffic levels make it SE1's cleanest residential sub-area. ULEZ compliance is broadly high.",
    },
    rentalDemand: {
      avgDaysToLet: 13,
      vsNationalAvg: "3.2× faster than national average (42 days)",
      score: 9,
      note: "SE1 is consistently in London's top 5 rental demand postcodes. Bermondsey Street properties average 10 days to let. Borough Market-adjacent flats attract applicants within days of listing. Finance sector demand from Canary Wharf and City workers means year-round strong demand.",
    },
    nearbyDevelopments: [
      { name: "Bankside Yards", type: "Mixed-use", status: "Planning approved, delivering 2025–2030", impact: "Positive", detail: "Major mixed-use scheme on the South Bank (former Network Rail depot) — residential, office, cultural space, public riverside. Long-term positive for SE1 SE cultural offer and connectivity." },
      { name: "Elephant Park", type: "Residential", status: "Under construction (completing ~2030)", impact: "Monitor", detail: "3,000-home Lendlease regeneration scheme. Significant new supply in SE1 7 and SE17 — monitor for impact on new-build SE1 flat values. The overall masterplan is positive for SE1 long-term." },
    ],
    recentSoldPrices: [
      { address: "Bermondsey Street SE1", price: "£1,450,000", date: "Feb 2025", type: "Flat", lat: 51.4992, lng: -0.0832 },
      { address: "Shad Thames SE1", price: "£2,200,000", date: "Jan 2025", type: "Flat", lat: 51.5028, lng: -0.0749 },
      { address: "Borough High Street SE1", price: "£780,000", date: "Mar 2025", type: "Flat", lat: 51.5012, lng: -0.0928 },
      { address: "Tooley Street SE1", price: "£1,100,000", date: "Dec 2024", type: "Flat", lat: 51.5033, lng: -0.0827 },
      { address: "Blackfriars Road SE1", price: "£920,000", date: "Jan 2025", type: "Flat", lat: 51.5042, lng: -0.1052 },
    ],
  },

  // ─── EC1 — Clerkenwell / Farringdon ───────────────────────────────────────
  EC1: {
    floodRisk: {
      zone: "Zone 1 (Low)",
      surfaceWater: "Low",
      riskBadge: "Low",
      detail: "EC1 is low flood risk. The Fleet river (culverted beneath Farringdon Road) has not caused surface flooding in recorded history at this location. The area sits on raised ground above tidal flood level with well-maintained Victorian drainage infrastructure.",
    },
    councilTax: {
      mostCommonBand: "Band D",
      annualCost: "£1,985",
      borough: "City of London / London Borough of Islington",
      note: "EC1 spans two authorities. City of London (EC1A/EC1V south) charge £1,985/yr for Band D — among London's higher rates. Islington (EC1R/EC1V north) charge £1,619/yr Band D. Verify the correct authority at address level — it can meaningfully affect annual costs.",
    },
    propertyTypeSplit: { flats: 89, terraced: 7, semiDetached: 1, detached: 0, other: 3, dominantType: "Flats at 89% — almost entirely warehouse/commercial conversions and purpose-built residential schemes" },
    commuteTable: [
      { destination: "City of London", time: "5 min", mode: "Tube", via: "Farringdon/Barbican (Elizabeth/Metropolitan/Circle)" },
      { destination: "Canary Wharf", time: "15 min", mode: "Elizabeth line", via: "Farringdon → Canary Wharf (Elizabeth line)" },
      { destination: "West End (Bond Street)", time: "10 min", mode: "Elizabeth line", via: "Farringdon → Bond Street (Elizabeth line)" },
      { destination: "Heathrow T2/T3", time: "35 min", mode: "Elizabeth line", via: "Farringdon → Heathrow (Elizabeth line direct)" },
    ],
    planningActivity: {
      recentApplications: 187,
      majorDevelopments: "St Bartholomew's Hospital expansion (ongoing — major NHS infrastructure adjacent to EC1A). Barbican Estate refurbishment programme (City of London, long-term). Farringdon East area — several office-to-residential conversions under PD rights approved.",
      councilPortalUrl: "https://www.islington.gov.uk/planning/planning-applications",
      note: "EC1's planning environment is driven by the tech/creative sector demand for workspace. Office-to-residential conversions under Permitted Development Rights are the primary source of new residential supply. The Barbican Estate's future refurbishment will be significant — monitor City of London planning portal.",
    },
    rentalMarket: {
      oneBedAskingRent: "£2,400 pcm",
      twoBedAskingRent: "£3,400 pcm",
      threeBedAskingRent: "£5,000 pcm",
      oneBedYield: "4.5%",
      twoBedYield: "4.2%",
      demandLevel: "Very High",
      note: "EC1 delivers some of London's best BTL yields in Zone 1 — Farringdon's Elizabeth line access to Canary Wharf (15 min) and City (5 min) creates a permanent high-quality tenant pool. Converted loft spaces consistently achieve 10–15% rental premiums over standard flats.",
    },
    broadband: {
      avgDownloadSpeed: "285 Mbps",
      fullFibreAvailability: "94%",
      rating: "Excellent",
      providers: "Openreach FTTP, Virgin Media, Hyperoptic, CityFibre, Zayo",
      note: "EC1 has the best broadband infrastructure of any London residential postcode — driven by the tech and creative sector's commercial requirements. Full fibre availability at 94% is near-universal. Commercial-grade connections are available in most converted loft buildings.",
    },
    airQuality: {
      no2Level: "35 µg/m³",
      pm25Level: "13 µg/m³",
      rating: "Moderate",
      note: "Farringdon Road and the Clerkenwell Road corridor carry significant traffic. Side streets within EC1 — Exmouth Market, Lloyd Baker Street, Sekforde Street — return cleaner readings. ULEZ compliance is very high in EC1 given the Zone 1 location.",
    },
    rentalDemand: {
      avgDaysToLet: 8,
      vsNationalAvg: "5.25× faster than national average (42 days)",
      score: 10,
      note: "EC1 is London's fastest-letting residential postcode by days-to-let. Farringdon warehouse lofts average 7–8 days to let; standard flats average 10–12 days. Finance, legal, and tech sector workers consistently list EC1 as their preferred address — demand exceeds supply by a significant margin.",
    },
    nearbyDevelopments: [
      { name: "Barbican Estate Refurbishment", type: "Residential", status: "Long-term programme, City of London", impact: "Positive", detail: "City of London's commitment to maintaining and improving the Barbican Estate — one of London's most significant post-war residential complexes. Ongoing investment protects values in EC2/EC1 adjacent." },
      { name: "Farringdon East Office-to-Residential", type: "Residential", status: "Multiple schemes approved", impact: "Positive", detail: "Several office-to-residential PD conversions approved in EC1M/EC1V — adding high-quality loft residential stock to the postcode. Net positive for the area's residential character and demand depth." },
    ],
    recentSoldPrices: [
      { address: "Sekforde Street EC1R", price: "£1,650,000", date: "Feb 2025", type: "Flat", lat: 51.5254, lng: -0.1044 },
      { address: "Lloyd Baker Street EC1R", price: "£1,450,000", date: "Jan 2025", type: "Flat", lat: 51.5262, lng: -0.1085 },
      { address: "St John Street EC1V", price: "£1,100,000", date: "Mar 2025", type: "Flat", lat: 51.5228, lng: -0.1011 },
      { address: "Exmouth Market EC1R", price: "£920,000", date: "Dec 2024", type: "Flat", lat: 51.5243, lng: -0.1094 },
      { address: "Amwell Street EC1R", price: "£780,000", date: "Jan 2025", type: "Flat", lat: 51.5258, lng: -0.1102 },
    ],
  },

  // ─── M1 — Manchester City Centre / Ancoats ────────────────────────────────
  M1: {
    floodRisk: {
      zone: "Zone 2 (Medium) — Medlock / Irwell corridors",
      surfaceWater: "Medium",
      riskBadge: "Medium",
      detail: "M1 city centre has flood risk from both the River Medlock and Irwell. EA Zone 2 applies to the NOMA/Northern Quarter border and Piccadilly fringe. The 2015 Boxing Day floods affected parts of Salford adjacent to M1. The Manchester Flood Alleviation Scheme (Phase 2) is significantly improving the city's flood resilience. New-build developments are designed above flood risk levels.",
    },
    councilTax: {
      mostCommonBand: "Band B",
      annualCost: "£1,518",
      borough: "Manchester City Council",
      note: "Manchester City Council's council tax is moderate. Band B (most common for M1 studio and 1-bed flats) is £1,518/yr. A significant discount versus equivalent Zone 1 London properties.",
    },
    propertyTypeSplit: { flats: 92, terraced: 5, semiDetached: 1, detached: 0, other: 2, dominantType: "Flats at 92% — M1 is one of the UK's flattest-dominated postcodes outside central London, with converted mill buildings and purpose-built towers" },
    commuteTable: [
      { destination: "Manchester Piccadilly", time: "5 min", mode: "Walk/Tram", via: "Metrolink city centre loop" },
      { destination: "MediaCityUK (Salford)", time: "18 min", mode: "Tram", via: "Piccadilly → MediaCityUK (Metrolink)" },
      { destination: "Manchester Airport", time: "22 min", mode: "Tram", via: "Piccadilly → Airport (Metrolink)" },
      { destination: "Leeds", time: "55 min", mode: "Train", via: "Manchester Victoria → Leeds (Northern)" },
    ],
    planningActivity: {
      recentApplications: 312,
      majorDevelopments: "NOMA (Northern Gateway masterplan — ongoing, 20+ acres, mixed-use). St Michael's Quarter (Gary Neville's 'Beetham 2' complex — hotel, residential, approved). First Street phase 2 (commercial/residential, ongoing). HS2 Manchester Piccadilly terminus (long-term).",
      councilPortalUrl: "https://secure.manchester.gov.uk/planning",
      note: "Manchester has the most active city-centre planning pipeline outside London. NOMA and the St Michael's Quarter will add significant high-quality mixed-use development to M1's north and west. Supply is growing — target heritage conversions over new-build towers for capital growth.",
    },
    rentalMarket: {
      oneBedAskingRent: "£1,200 pcm",
      twoBedAskingRent: "£1,650 pcm",
      threeBedAskingRent: "£2,200 pcm",
      oneBedYield: "5.8%",
      twoBedYield: "5.4%",
      demandLevel: "Very High",
      note: "M1 delivers the best BTL yield of any major UK city-centre postcode. Near-permanent student and young professional demand (University of Manchester and MMU are both within 1 mile) ensures minimal void periods. Ancoats mill conversions achieve 10–15% rental premiums over equivalent new-build flats.",
    },
    broadband: {
      avgDownloadSpeed: "245 Mbps",
      fullFibreAvailability: "88%",
      rating: "Excellent",
      providers: "Openreach FTTP, Virgin Media, CityFibre, Hyperoptic",
      note: "M1 has exceptional broadband infrastructure driven by commercial sector investment. CityFibre's Manchester buildout covers most of the M1 residential postcode. New-build developments are universally FTTP.",
    },
    airQuality: {
      no2Level: "32 µg/m³",
      pm25Level: "11 µg/m³",
      rating: "Moderate",
      note: "Manchester city centre's NO₂ has improved significantly since Clean Air Zone implementation in 2023. Piccadilly Gardens and the main arterial routes return elevated readings. Ancoats residential streets away from the commercial core return Good-rated levels.",
    },
    rentalDemand: {
      avgDaysToLet: 8,
      vsNationalAvg: "5.25× faster than national average (42 days)",
      score: 10,
      note: "M1 is the fastest-letting postcode outside London. Ancoats 1-bed mill conversions average 7 days to let; standard new-build apartments average 9 days. The student population creates a reliable September demand spike. Year-round professional demand means very low void periods.",
    },
    nearbyDevelopments: [
      { name: "NOMA Masterplan", type: "Mixed-use", status: "Ongoing (20+ acres, 10+ year delivery)", impact: "Positive", detail: "The Co-operative Group's major city-centre masterplan — offices, residential, retail, public space on the north M1 border. Structural positive for M1 and adjacent M4 values as the area matures." },
      { name: "St Michael's Quarter", type: "Mixed-use", status: "Planning approved", impact: "Positive", detail: "High-profile mixed-use development including hotel, residential, and public space on the Peter Street/Bootle Street site. Adds premium residential supply and further activates M1's western edge." },
    ],
    recentSoldPrices: [
      { address: "Crusader Mill M1", price: "£285,000", date: "Feb 2025", type: "Flat", lat: 53.4812, lng: -2.2241 },
      { address: "Royal Mills Ancoats M4", price: "£320,000", date: "Jan 2025", type: "Flat", lat: 53.4847, lng: -2.2185 },
      { address: "Piccadilly Gardens M1", price: "£195,000", date: "Mar 2025", type: "Flat", lat: 53.4802, lng: -2.2352 },
      { address: "Great Ancoats Street M4", price: "£265,000", date: "Dec 2024", type: "Flat", lat: 53.4838, lng: -2.2197 },
      { address: "Northern Quarter M4", price: "£310,000", date: "Jan 2025", type: "Flat", lat: 53.4843, lng: -2.2316 },
    ],
  },

  // ─── B1 — Birmingham Jewellery Quarter / City Centre ──────────────────────
  B1: {
    floodRisk: {
      zone: "Zone 1 (Low)",
      surfaceWater: "Low",
      riskBadge: "Low",
      detail: "B1 is low flood risk. The city centre sits on well-drained Triassic sandstone geology above the River Rea and River Tame flood plains. The Jewellery Quarter specifically has no significant flood risk.",
    },
    councilTax: {
      mostCommonBand: "Band B",
      annualCost: "£1,488",
      borough: "Birmingham City Council",
      note: "Birmingham's council tax has increased significantly since the 2023 S114 notice (financial emergency) but remains below London equivalents. Band B covers most B1 1-bed and studio flats. A 2025 further increase of ~8% is budgeted — factor ongoing increases into hold cost calculations.",
    },
    propertyTypeSplit: { flats: 87, terraced: 8, semiDetached: 2, detached: 0, other: 3, dominantType: "Flats at 87% — a mix of JQ heritage conversions, new-build towers, and converted commercial buildings" },
    commuteTable: [
      { destination: "Birmingham New Street", time: "8 min", mode: "Tram", via: "Jewellery Quarter → New Street (West Midlands Metro)" },
      { destination: "London Euston", time: "84 min", mode: "Train", via: "New Street → Euston (Avanti West Coast)" },
      { destination: "Birmingham Airport", time: "28 min", mode: "Train", via: "New Street → Airport (CrossCity)" },
      { destination: "Wolverhampton", time: "30 min", mode: "Tram", via: "West Midlands Metro direct" },
    ],
    planningActivity: {
      recentApplications: 246,
      majorDevelopments: "HS2 Curzon Street Station (B4/B5 — major infrastructure, ~52 min to London on opening ~2033). Digbeth regeneration (East Side City Centre masterplan — 5,000+ homes, ongoing). Paradise Birmingham (commercial/civic, phase 2 ongoing). Smithfield Market redevelopment (Southside).",
      councilPortalUrl: "https://eplanning.birmingham.gov.uk/swift/apas/run/wphappcriteria.display",
      note: "HS2 Curzon Street (B4, immediately east of B1) is the most significant demand driver for B1 values in the medium term. The Digbeth East Side City masterplan will transform B4/B5 adjacent to B1 — buy close to the HS2 station for the infrastructure premium.",
    },
    rentalMarket: {
      oneBedAskingRent: "£1,050 pcm",
      twoBedAskingRent: "£1,450 pcm",
      threeBedAskingRent: "£1,900 pcm",
      oneBedYield: "6.2%",
      twoBedYield: "5.8%",
      demandLevel: "High",
      note: "B1 delivers strong BTL yield underpinned by the JQ's permanent creative/professional population and proximity to three universities (Aston, BCU, UoB all within 2 miles). Heritage JQ conversions consistently achieve premium rents over equivalent new-build flats. HS2 opening will be a step-change for Curzon Street-adjacent properties.",
    },
    broadband: {
      avgDownloadSpeed: "218 Mbps",
      fullFibreAvailability: "86%",
      rating: "Excellent",
      providers: "Openreach FTTP, Virgin Media, CityFibre, Gigaclear",
      note: "B1 has excellent broadband infrastructure — CityFibre's Birmingham buildout covers most of the JQ and city centre. New-build residential schemes are universally FTTP. Good commercial-grade connectivity is a feature of most JQ conversions.",
    },
    airQuality: {
      no2Level: "28 µg/m³",
      pm25Level: "10 µg/m³",
      rating: "Moderate",
      note: "Birmingham's Clean Air Zone (implemented 2021) has significantly reduced city-centre NO₂. The JQ's quieter road network returns better readings than the Broad Street or Queensway corridors. Air quality has improved measurably year-on-year since 2021.",
    },
    rentalDemand: {
      avgDaysToLet: 14,
      vsNationalAvg: "3× faster than national average (42 days)",
      score: 8,
      note: "B1 JQ properties average 14 days to let — strong demand from young professionals, creative sector workers, and students from all three adjacent universities. The HS2 announcement has attracted London buyers looking to front-run the infrastructure premium.",
    },
    nearbyDevelopments: [
      { name: "HS2 Curzon Street Station", type: "Transport", status: "Under construction (~2033 opening)", impact: "Positive", detail: "High Speed 2's Birmingham terminus — ~52 minutes to London Euston on opening. Within 1km of B1's eastern boundary. The single most significant value driver for B1 and B4 properties in the medium term." },
      { name: "Digbeth East Side City", type: "Mixed-use", status: "Masterplan approved, phased delivery", impact: "Positive", detail: "Birmingham City Council's 5,000+ home masterplan for Digbeth, immediately east of B1. Major cultural, commercial, and residential investment will transform the B1 eastern fringe." },
    ],
    recentSoldPrices: [
      { address: "Vyse Street B18", price: "£285,000", date: "Feb 2025", type: "Flat", lat: 52.4881, lng: -1.9078 },
      { address: "Spencer Street B18", price: "£265,000", date: "Jan 2025", type: "Flat", lat: 52.4875, lng: -1.9102 },
      { address: "St Paul's Square B3", price: "£320,000", date: "Mar 2025", type: "Flat", lat: 52.4857, lng: -1.9033 },
      { address: "Newhall Street B3", price: "£210,000", date: "Dec 2024", type: "Flat", lat: 52.4844, lng: -1.9021 },
      { address: "Hockley Hill B18", price: "£245,000", date: "Jan 2025", type: "Flat", lat: 52.4892, lng: -1.9125 },
    ],
  },

  // ─── LS1 — Leeds City Centre ───────────────────────────────────────────────
  LS1: {
    floodRisk: {
      zone: "Zone 2–3 (Medium–High) — River Aire corridor",
      surfaceWater: "Medium",
      riskBadge: "Medium",
      detail: "LS1's Granary Wharf, Brewery Wharf, and South Bank (River Aire adjacent) are EA Zone 2–3. The 2015 Boxing Day flood caused significant damage in the LS1 riverside area. Leeds Flood Alleviation Scheme Phase 2 (£112m, completing 2025) significantly improves resilience for Waterfront properties. New riverside builds have mandatory flood resilience measures.",
    },
    councilTax: {
      mostCommonBand: "Band B",
      annualCost: "£1,608",
      borough: "Leeds City Council",
      note: "Leeds City Council's council tax is slightly above the English average but remains significantly below London equivalents. Band B covers most LS1 flats and city-centre apartments.",
    },
    propertyTypeSplit: { flats: 91, terraced: 5, semiDetached: 2, detached: 0, other: 2, dominantType: "Flats at 91% — LS1 is almost entirely apartments, with warehouse conversions (Dock Street, Water Lane) and purpose-built towers" },
    commuteTable: [
      { destination: "Leeds railway station", time: "5 min", mode: "Walk", via: "Direct from LS1 core" },
      { destination: "Manchester Piccadilly", time: "55 min", mode: "Train", via: "Leeds → Manchester (TransPennine)" },
      { destination: "London King's Cross", time: "2hr 10min", mode: "Train", via: "Leeds → King's Cross (LNER)" },
      { destination: "Leeds Bradford Airport", time: "25 min", mode: "Car/Bus", via: "A65 (bus service 757)" },
    ],
    planningActivity: {
      recentApplications: 278,
      majorDevelopments: "South Bank masterplan (60+ acres, 35,000 jobs, 8,000 homes — largest regeneration scheme in northern England, long-term delivery). West Yorkshire Mass Transit (tram network, approval expected ~2026–2028). Victoria Gate phase 2 (retail, approved). Temple Green (employment park, east LS1).",
      councilPortalUrl: "https://www.leeds.gov.uk/planning/planning-applications-and-decisions",
      note: "The South Bank masterplan is transformative — buy South Bank-adjacent properties now for the 10-year infrastructure premium. West Yorkshire Mass Transit approval would be a step-change for all LS1 and LS2 values. Monitor the tram network consultation outcome closely.",
    },
    rentalMarket: {
      oneBedAskingRent: "£1,050 pcm",
      twoBedAskingRent: "£1,450 pcm",
      threeBedAskingRent: "£2,000 pcm",
      oneBedYield: "6.5%",
      twoBedYield: "6.1%",
      demandLevel: "Very High",
      note: "LS1 delivers the UK's best yield-to-city-centre-quality ratio outside London. Near-permanent student demand (University of Leeds, Leeds Beckett — 65,000 students between them) combined with Leeds' FIRE sector employment base ensures minimal void. Heritage warehouse conversions consistently outperform towers on both yield and capital growth.",
    },
    broadband: {
      avgDownloadSpeed: "232 Mbps",
      fullFibreAvailability: "87%",
      rating: "Excellent",
      providers: "Openreach FTTP, Virgin Media, CityFibre, TalkTalk Business",
      note: "LS1 has excellent broadband infrastructure. CityFibre's Leeds buildout covers most of the city centre. New-build developments are FTTP by default. Heritage warehouse conversions typically have building-level gigabit connections.",
    },
    airQuality: {
      no2Level: "26 µg/m³",
      pm25Level: "9 µg/m³",
      rating: "Good",
      note: "Leeds city centre has improved significantly since Clean Air Zone introduction. The LS1 core away from the Inner Ring Road returns Good-rated readings. The South Bank riverside area benefits from open river corridor ventilation.",
    },
    rentalDemand: {
      avgDaysToLet: 9,
      vsNationalAvg: "4.7× faster than national average (42 days)",
      score: 9,
      note: "LS1 is the fastest-letting postcode outside London and Manchester. Warehouse conversion 1-beds average 7 days to let; standard apartments average 10–12 days. The September student demand surge is extreme — properties listed in August are typically committed before October.",
    },
    nearbyDevelopments: [
      { name: "South Bank Masterplan", type: "Mixed-use", status: "Long-term delivery (10–15 years)", impact: "Positive", detail: "60+ acres of brownfield land immediately south of Leeds station — 8,000 homes, 35,000 jobs, the new Channel 4 national headquarters. Largest regeneration scheme in northern England. Buy adjacent properties now." },
      { name: "West Yorkshire Mass Transit", type: "Transport", status: "Approval expected 2026–2028", impact: "Positive", detail: "The long-awaited West Yorkshire tram network — if approved, would transform LS1 and suburban Leeds connectivity. A major structural positive for all Leeds city-centre values. Monitor the West Yorkshire Combined Authority consultation." },
    ],
    recentSoldPrices: [
      { address: "Water Lane LS11", price: "£245,000", date: "Feb 2025", type: "Flat", lat: 53.7931, lng: -1.5507 },
      { address: "Dock Street LS10", price: "£285,000", date: "Jan 2025", type: "Flat", lat: 53.7927, lng: -1.5430 },
      { address: "Brewery Wharf LS10", price: "£220,000", date: "Mar 2025", type: "Flat", lat: 53.7939, lng: -1.5399 },
      { address: "Granary Wharf LS1", price: "£265,000", date: "Dec 2024", type: "Flat", lat: 53.7945, lng: -1.5480 },
      { address: "Wellington Street LS1", price: "£195,000", date: "Jan 2025", type: "Flat", lat: 53.7982, lng: -1.5512 },
    ],
  },

  // ─── BS1 — Bristol Harbourside ────────────────────────────────────────────
  BS1: {
    floodRisk: {
      zone: "Zone 2–3 (Medium–High) — Floating Harbour",
      surfaceWater: "Medium",
      riskBadge: "Medium",
      detail: "BS1's Harbourside properties (Wapping Wharf, Gas Ferry Road, Canons Road frontage) sit in EA Zone 2–3 due to tidal Avon risk. The Floating Harbour is a managed water body — Bristol City Council and the harbour authority actively manage flood risk. New Harbourside residential developments are built with mandatory flood resilience. Properties 200m+ from the Harbour return Zone 1.",
    },
    councilTax: {
      mostCommonBand: "Band C",
      annualCost: "£1,987",
      borough: "Bristol City Council",
      note: "Bristol City Council's council tax is above the English average. Band C (most common for BS1 1-bed flats) is £1,987/yr — higher than Birmingham and Leeds equivalents but significantly below inner London rates.",
    },
    propertyTypeSplit: { flats: 84, terraced: 10, semiDetached: 3, detached: 1, other: 2, dominantType: "Flats at 84% — dominated by Harbourside new-builds and converted industrial/commercial buildings" },
    commuteTable: [
      { destination: "Bristol Temple Meads", time: "12 min", mode: "Walk/Bus", via: "20-min walk or First Bus service" },
      { destination: "London Paddington", time: "1hr 42min", mode: "Train", via: "Temple Meads → Paddington (GWR)" },
      { destination: "Cardiff Central", time: "50 min", mode: "Train", via: "Temple Meads → Cardiff (GWR)" },
      { destination: "Bristol Airport", time: "28 min", mode: "Bus/Car", via: "Bristol Flyer A1 bus or A38" },
    ],
    planningActivity: {
      recentApplications: 198,
      majorDevelopments: "Redcliffe Quarter (mixed-use, 900 homes, adjacent to BS1 — planning approved). Finzel's Reach phase 2 (residential, completing 2025). Temple Quarter Enterprise Zone (TQ EZ — 10,000 jobs, University of Bristol campus, long-term). Bristol Arena (Temple Gate — planning contended).",
      councilPortalUrl: "https://www.bristol.gov.uk/planning-and-building-regulations/planning-applications",
      note: "Bristol's Temple Quarter Enterprise Zone is the most significant regeneration catalyst — the University of Bristol's new Temple Quarter campus (opening 2025) brings 10,000 students and faculty to the BS1 border. Buy adjacent to TQ EZ now for the 5–10 year infrastructure premium.",
    },
    rentalMarket: {
      oneBedAskingRent: "£1,450 pcm",
      twoBedAskingRent: "£2,000 pcm",
      threeBedAskingRent: "£2,800 pcm",
      oneBedYield: "4.8%",
      twoBedYield: "4.4%",
      demandLevel: "High",
      note: "BS1 delivers strong BTL yield driven by creative/media sector demand, Channel 4 employees, and University of Bristol postgraduate students. Harbourside waterfront units command 15–20% premium over equivalent inland BS1 stock. Void periods on quality stock are typically 3–4 weeks.",
    },
    broadband: {
      avgDownloadSpeed: "198 Mbps",
      fullFibreAvailability: "79%",
      rating: "Excellent",
      providers: "Openreach FTTP, Virgin Media, CityFibre",
      note: "Good fibre availability across BS1. CityFibre's Bristol buildout has significantly improved full fibre coverage in the city centre. New Harbourside developments are FTTP by default.",
    },
    airQuality: {
      no2Level: "24 µg/m³",
      pm25Level: "9 µg/m³",
      rating: "Good",
      note: "BS1 has good air quality by UK city-centre standards. The open Floating Harbour acts as a ventilation corridor. The A4 Temple Way ring road returns elevated readings on immediately adjacent streets. Bristol's high cycling and public transport modal share keeps city-centre traffic volumes below comparable English cities.",
    },
    rentalDemand: {
      avgDaysToLet: 16,
      vsNationalAvg: "2.6× faster than national average (42 days)",
      score: 8,
      note: "BS1 rental demand is strong and quality-led. Harbourside 2-beds with water views let fastest (10–14 days). Channel 4 employees and creative sector workers are the dominant tenant profile. University of Bristol's new Temple Quarter campus (from 2025) will add significant postgraduate demand.",
    },
    nearbyDevelopments: [
      { name: "University of Bristol Temple Quarter Campus", type: "Education/Commercial", status: "Under construction, opening 2025", impact: "Positive", detail: "UoB's £300m new campus adjacent to Temple Meads will bring 10,000 students and staff to the BS1 border. Structural demand driver for BS1 residential rental and owner-occupier values." },
      { name: "Finzel's Reach Phase 2", type: "Residential", status: "Completing 2025", impact: "Neutral", detail: "240 additional residential units on the Finzel's Reach site. Adds quality supply to the BS1 market — monitor for any short-term softening on equivalent new-build product." },
    ],
    recentSoldPrices: [
      { address: "Wapping Wharf BS1", price: "£480,000", date: "Feb 2025", type: "Flat", lat: 51.4499, lng: -2.5989 },
      { address: "Gas Ferry Road BS1", price: "£620,000", date: "Jan 2025", type: "Flat", lat: 51.4508, lng: -2.6012 },
      { address: "Baldwin Street BS1", price: "£320,000", date: "Mar 2025", type: "Flat", lat: 51.4545, lng: -2.5956 },
      { address: "King Street BS1", price: "£295,000", date: "Dec 2024", type: "Flat", lat: 51.4523, lng: -2.5982 },
      { address: "Redcliff Street BS1", price: "£365,000", date: "Jan 2025", type: "Flat", lat: 51.4488, lng: -2.5923 },
    ],
  },

  // ─── EH1 — Edinburgh Old Town ─────────────────────────────────────────────
  EH1: {
    floodRisk: {
      zone: "Zone 1 (Low) — note: Scotland uses SEPA flood mapping",
      surfaceWater: "Low",
      riskBadge: "Low",
      detail: "EH1 uses SEPA (Scottish Environment Protection Agency) flood risk mapping rather than EA. The Old Town's elevated volcanic rock position (Castle Rock, Royal Mile ridge) provides natural flood protection. SEPA maps show low risk across EH1. Note: Scotland uses a different legal framework — engage a Scottish solicitor for full due diligence.",
    },
    councilTax: {
      mostCommonBand: "Band E",
      annualCost: "£2,074",
      borough: "City of Edinburgh Council",
      note: "Edinburgh's council tax is above the Scottish and UK averages. Band E covers most EH1 flats and city-centre conversions. Note: Scotland's system uses different band descriptions — Band E in Scotland is comparable to Band D in England. Additional Dwelling Supplement (ADS) of 6% applies to buy-to-let purchases in Scotland.",
    },
    propertyTypeSplit: { flats: 88, terraced: 7, semiDetached: 2, detached: 2, other: 1, dominantType: "Flats at 88% — EH1 is almost entirely tenement flats, Georgian first-floor conversions, and New Town apartments" },
    commuteTable: [
      { destination: "Edinburgh Waverley", time: "8 min", mode: "Walk", via: "Direct from EH1 core" },
      { destination: "Glasgow Queen Street", time: "48 min", mode: "Train", via: "Waverley → Glasgow (ScotRail)" },
      { destination: "London King's Cross", time: "4hr 20min", mode: "Train", via: "Waverley → King's Cross (LNER Azuma)" },
      { destination: "Edinburgh Airport", time: "28 min", mode: "Tram", via: "York Place → Airport (Edinburgh Trams)" },
    ],
    planningActivity: {
      recentApplications: 198,
      majorDevelopments: "Waverley Valley regeneration (City of Edinburgh — long-term). St James Quarter (completed 2021 — transformative retail/hotel/residential). Edinburgh St James 2 (hotel/residential above, Phase 2 planning). Caltongate (Canongate/Holyrood — mixed-use, ongoing).",
      councilPortalUrl: "https://www.edinburgh.gov.uk/planning-2",
      note: "EH1's UNESCO World Heritage Site status creates the most restrictive planning environment in the UK outside London's royal palaces. Any visible external alteration requires Historic Environment Scotland and Edinburgh World Heritage Trust consent. This planning constraint is the structural driver of EH1's supply scarcity and value resilience.",
    },
    rentalMarket: {
      oneBedAskingRent: "£1,400 pcm",
      twoBedAskingRent: "£2,100 pcm",
      threeBedAskingRent: "£3,200 pcm",
      oneBedYield: "4.2%",
      twoBedYield: "3.9%",
      demandLevel: "Very High",
      note: "EH1 has Scotland's most competitive rental market — vacancy rates below 1% are documented in recent LettingWeb data. Edinburgh's financial sector, tourism industry, and university employment base create permanent high-quality tenant demand. Note: Scotland's Private Residential Tenancy (PRT) framework limits rent increases during tenancy — factor this into yield modelling.",
    },
    broadband: {
      avgDownloadSpeed: "175 Mbps",
      fullFibreAvailability: "72%",
      rating: "Good",
      providers: "Openreach FTTP, Virgin Media, CityFibre, BT",
      note: "Good broadband in EH1. Full fibre rollout has been slower in the Old Town due to construction restrictions in the conservation area. New builds and modern conversions are FTTP. Some older tenement buildings remain on FTTC.",
    },
    airQuality: {
      no2Level: "22 µg/m³",
      pm25Level: "8 µg/m³",
      rating: "Good",
      note: "Edinburgh has some of the best air quality of any UK city centre. Low industrial activity, good Atlantic ventilation, and a compact high-density city plan keep readings well below the UK average. The main road corridors (Princes Street, Royal Mile) return the highest readings — side streets are notably clean.",
    },
    rentalDemand: {
      avgDaysToLet: 7,
      vsNationalAvg: "6× faster than national average (42 days)",
      score: 10,
      note: "EH1 is the tightest rental market in the UK outside Zone 1 London. Properties list and let within days — multiple competing applications within 24 hours of listing are the norm. August (Festival month) creates extraordinary short-let demand — many EH1 owners switch to short-let for August, achieving 5–10× normal rental rates.",
    },
    nearbyDevelopments: [
      { name: "Caltongate / Canongate", type: "Mixed-use", status: "Ongoing", impact: "Positive", detail: "Mixed-use development at the foot of the Royal Mile (Canongate/Holyrood) — hotel, residential, commercial. Improves the southern approach to the Old Town and adds amenity to the EH8 border." },
      { name: "St James Quarter Phase 2", type: "Residential/Hotel", status: "Planning submitted", impact: "Positive", detail: "Additional hotel and residential units above the completed St James Quarter retail. Net positive for Edinburgh's hotel capacity and EH1 residential demand during major events." },
    ],
    recentSoldPrices: [
      { address: "Royal Mile EH1", price: "£485,000", date: "Feb 2025", type: "Flat", lat: 55.9495, lng: -3.1883 },
      { address: "Canongate EH8", price: "£380,000", date: "Jan 2025", type: "Flat", lat: 55.9502, lng: -3.1802 },
      { address: "Cockburn Street EH1", price: "£320,000", date: "Mar 2025", type: "Flat", lat: 55.9487, lng: -3.1908 },
      { address: "Jeffrey Street EH1", price: "£415,000", date: "Dec 2024", type: "Flat", lat: 55.9505, lng: -3.1872 },
      { address: "Cowgate EH1", price: "£295,000", date: "Jan 2025", type: "Flat", lat: 55.9471, lng: -3.1895 },
    ],
  },

  // ─── OX1 — Oxford City Centre ─────────────────────────────────────────────
  OX1: {
    floodRisk: {
      zone: "Zone 2 (Medium) — Cherwell and Thames flood plains",
      surfaceWater: "Medium",
      riskBadge: "Medium",
      detail: "OX1's eastern boundary (Magdalen Bridge, Cherwell meadows) and southern boundary (Christ Church Meadow, Thames/Isis) are EA Zone 2–3. The city centre ridge (High Street, Carfax) is Zone 1. The 2007 Oxford floods were significant — properties in the OX1 4 and OX1 2 sectors near the rivers require specific Level 3 survey flood assessment.",
    },
    councilTax: {
      mostCommonBand: "Band D",
      annualCost: "£1,956",
      borough: "Oxford City Council",
      note: "Oxford City Council's council tax is above the English average. Band D (most common for OX1 flats and smaller terraced houses) is £1,956/yr. Jericho Victorian terraces (Band E/F) pay £2,259–£2,562/yr.",
    },
    propertyTypeSplit: { flats: 57, terraced: 34, semiDetached: 7, detached: 1, other: 1, dominantType: "A more balanced split than most city-centre postcodes — terraced houses at 34% reflect Jericho and St Clement's Victorian stock" },
    commuteTable: [
      { destination: "London Paddington", time: "56 min", mode: "Train", via: "Oxford → Paddington (GWR)" },
      { destination: "Birmingham New Street", time: "1hr 5min", mode: "Train", via: "Oxford → Birmingham (Chiltern Railways)" },
      { destination: "Bristol Temple Meads", time: "1hr 30min", mode: "Train", via: "Oxford → Bristol (GWR)" },
      { destination: "London Marylebone", time: "1hr 8min", mode: "Train", via: "Oxford → Marylebone (Chiltern Railways)" },
    ],
    planningActivity: {
      recentApplications: 187,
      majorDevelopments: "Oxford Biomedical Campus (OX3/OX4 — AstraZeneca, Novo Nordisk expansion). Oxford Station masterplan (Network Rail/OCC — new station frontage, mixed-use, approved). West End development (Oxpens/Osney Mead — major mixed-use, planning contended). East West Rail (Oxford–Cambridge–London, major infrastructure).",
      councilPortalUrl: "https://www.oxford.gov.uk/planning-applications",
      note: "East West Rail's Oxford leg (delivering improved connectivity to Cambridge and Milton Keynes) is the most significant future demand driver for OX1. The Biomedical Campus expansion continues to add high-salary research employment to the Oxford market — structural demand positive.",
    },
    rentalMarket: {
      oneBedAskingRent: "£1,450 pcm",
      twoBedAskingRent: "£2,100 pcm",
      threeBedAskingRent: "£3,000 pcm",
      oneBedYield: "3.8%",
      twoBedYield: "3.5%",
      demandLevel: "Very High",
      note: "Oxford's rental market is the most supply-constrained of any non-London UK city. University-affiliated demand (faculty, postdoctoral researchers, medical professionals) combined with Biomedical Campus employment creates year-round high-quality tenant demand. Vacancy rates are among the lowest outside London.",
    },
    broadband: {
      avgDownloadSpeed: "182 Mbps",
      fullFibreAvailability: "73%",
      rating: "Good",
      providers: "Openreach FTTP, Virgin Media, CityFibre",
      note: "Good broadband in OX1. Full fibre rollout has been slower than in larger cities due to OX1's predominantly Victorian terraced street pattern. CityFibre's Oxford buildout is ongoing. University colleges have their own high-speed network infrastructure.",
    },
    airQuality: {
      no2Level: "28 µg/m³",
      pm25Level: "10 µg/m³",
      rating: "Moderate",
      note: "Oxford's city centre has improved significantly since the Zero Emission Zone (ZEZ) implementation in 2022 — the UK's first. The High Street and St Aldate's return much better readings than pre-ZEZ. Jericho and North Oxford residential streets are well within WHO guidelines.",
    },
    rentalDemand: {
      avgDaysToLet: 8,
      vsNationalAvg: "5.25× faster than national average (42 days)",
      score: 10,
      note: "Oxford is the tightest rental market outside London and Edinburgh. Properties list and receive applications within days. The Biomedical Campus postdoctoral researcher demographic is Oxford's most competitive tenant segment — typically seeking 2-bed houses within cycling distance of the OX3/OX4 campus.",
    },
    nearbyDevelopments: [
      { name: "East West Rail (Oxford Phase)", type: "Transport", status: "Under construction", impact: "Positive", detail: "East West Rail's Oxford–Milton Keynes–Cambridge corridor will significantly improve OX1's connectivity to Cambridge's knowledge economy. Structural demand positive — opens a new buyer segment from the Oxford-Cambridge arc." },
      { name: "Oxford Station Masterplan", type: "Mixed-use/Transport", status: "Planning approved", impact: "Positive", detail: "Network Rail and Oxford City Council's approved masterplan for Oxford station — improved interchange, public realm, and mixed-use development. Strengthens OX1's arrival experience and connectivity." },
    ],
    recentSoldPrices: [
      { address: "Cardigan Street OX2", price: "£680,000", date: "Feb 2025", type: "Terraced", lat: 51.7596, lng: -1.2641 },
      { address: "Great Clarendon Street OX2", price: "£920,000", date: "Jan 2025", type: "Terraced", lat: 51.7604, lng: -1.2620 },
      { address: "High Street OX1", price: "£545,000", date: "Mar 2025", type: "Flat", lat: 51.7519, lng: -1.2548 },
      { address: "St John Street OX1", price: "£620,000", date: "Dec 2024", type: "Flat", lat: 51.7538, lng: -1.2584 },
      { address: "Park End Street OX1", price: "£420,000", date: "Jan 2025", type: "Flat", lat: 51.7531, lng: -1.2651 },
    ],
  },

  // ─── CB1 — Cambridge ──────────────────────────────────────────────────────
  CB1: {
    floodRisk: {
      zone: "Zone 2 (Medium) — River Cam / Fens approach",
      surfaceWater: "Medium",
      riskBadge: "Medium",
      detail: "CB1's eastern fringe (Ditton Meadows, Riverside area) sits in EA Zone 2. The River Cam and Fen drainage system require careful assessment for properties east of Mill Road. The CB1 Victorian terrace grid (Petersfield, Romsey) is Zone 1 (Low). CB1 station quarter new-builds are designed above flood risk levels.",
    },
    councilTax: {
      mostCommonBand: "Band D",
      annualCost: "£1,924",
      borough: "Cambridge City Council",
      note: "Cambridge City Council's council tax is above average for England. Band D (most common for CB1 flats and Petersfield terraces) is £1,924/yr. Similar to Oxford — premium city council tax reflects high service demand relative to constrained housing supply.",
    },
    propertyTypeSplit: { flats: 52, terraced: 40, semiDetached: 6, detached: 1, other: 1, dominantType: "Almost equal split between flats (52%) and terraced houses (40%) — CB1's Petersfield Victorian terrace grid is the strongest house-stock proportion of any knowledge-economy postcode" },
    commuteTable: [
      { destination: "London King's Cross", time: "52 min", mode: "Train", via: "Cambridge → King's Cross (LNER/Thameslink)" },
      { destination: "London Liverpool Street", time: "1hr 18min", mode: "Train", via: "Cambridge → Liverpool Street (Greater Anglia)" },
      { destination: "Cambridge Biomedical Campus", time: "10 min", mode: "Cycle/Bus", via: "Direct cycle or Citi 1 bus" },
      { destination: "London Stansted Airport", time: "35 min", mode: "Train", via: "Cambridge → Stansted (Greater Anglia)" },
    ],
    planningActivity: {
      recentApplications: 162,
      majorDevelopments: "Cambridge Biomedical Campus phase 2 (AstraZeneca, Cambridge Cancer Research Hospital — £300m+ investment, ongoing). CB1 Station Quarter (mixed-use, largely complete). East West Rail (Cambridge–Oxford, major infrastructure, delivering 2030s). North East Cambridge (1,800 acres, 8,000 homes — long-term masterplan).",
      councilPortalUrl: "https://www.cambridge.gov.uk/planning-applications",
      note: "Green Belt constraints mean Cambridge's Local Plan chronically underdelivers against housing targets. East West Rail will open significant new buyer demand from the Oxford corridor — structural positive for CB1 values. North East Cambridge's 8,000-home masterplan is the most significant supply addition in Cambridge's history but will take 15+ years to deliver.",
    },
    rentalMarket: {
      oneBedAskingRent: "£1,350 pcm",
      twoBedAskingRent: "£1,900 pcm",
      threeBedAskingRent: "£2,700 pcm",
      oneBedYield: "3.9%",
      twoBedYield: "3.6%",
      demandLevel: "Very High",
      note: "Cambridge has the UK's most supply-constrained rental market outside London. Biomedical Campus employment (AstraZeneca, Wellcome, multiple spinouts) creates permanent high-salary tenant demand. Mill Road corridor properties attract premium rents from postdoctoral researchers and tech sector workers.",
    },
    broadband: {
      avgDownloadSpeed: "195 Mbps",
      fullFibreAvailability: "77%",
      rating: "Excellent",
      providers: "Openreach FTTP, Virgin Media, CityFibre",
      note: "Good fibre coverage across CB1. The CB1 station quarter new developments are universally FTTP. Mill Road Victorian terraces have seen progressive full fibre upgrade. CityFibre's Cambridge buildout is expanding coverage in Petersfield.",
    },
    airQuality: {
      no2Level: "18 µg/m³",
      pm25Level: "7 µg/m³",
      rating: "Good",
      note: "Cambridge has excellent air quality — among the best of any UK city. The city's near-universal cycling culture dramatically reduces motor vehicle traffic, particularly in CB1's residential streets. Mill Road is the highest-traffic corridor but still returns Good-rated readings.",
    },
    rentalDemand: {
      avgDaysToLet: 6,
      vsNationalAvg: "7× faster than national average (42 days)",
      score: 10,
      note: "Cambridge is the UK's fastest-letting rental market outside London's Zone 1. Properties in Petersfield and near the Biomedical Campus receive applications within 24–48 hours of listing. The AstraZeneca relocation (2016) permanently shifted CB1's tenant demographic toward high-salary biotech professionals — a structural premium.",
    },
    nearbyDevelopments: [
      { name: "Cambridge Cancer Research Hospital", type: "Education/Healthcare", status: "Under construction, opening ~2027", impact: "Positive", detail: "£300m+ Cancer Research UK hospital on the Biomedical Campus — will bring additional high-salary medical researchers and clinicians to CB1's catchment. Structural demand positive for CB1/CB2 residential values." },
      { name: "East West Rail", type: "Transport", status: "Under construction (Oxford-Cambridge delivery 2030s)", impact: "Positive", detail: "East West Rail's Cambridge–Oxford corridor will open a new buyer segment and dramatically improve Cambridge's connectivity. Structural positive for CB1 — adds London buyers commuting from Cambridge as a realistic option." },
    ],
    recentSoldPrices: [
      { address: "Sedgwick Street CB1", price: "£685,000", date: "Feb 2025", type: "Terraced", lat: 52.1991, lng: 0.1338 },
      { address: "Norfolk Street CB1", price: "£720,000", date: "Jan 2025", type: "Terraced", lat: 52.2002, lng: 0.1321 },
      { address: "Mill Road CB1", price: "£485,000", date: "Mar 2025", type: "Flat", lat: 52.1985, lng: 0.1297 },
      { address: "Catharine Street CB1", price: "£655,000", date: "Dec 2024", type: "Terraced", lat: 52.1978, lng: 0.1349 },
      { address: "Station Road CB1", price: "£425,000", date: "Jan 2025", type: "Flat", lat: 52.1948, lng: 0.1373 },
    ],
  },

  // ─── RG1 — Reading ────────────────────────────────────────────────────────
  RG1: {
    floodRisk: {
      zone: "Zone 2 (Medium) — Thames and Kennet frontage",
      surfaceWater: "Medium",
      riskBadge: "Medium",
      detail: "RG1's Thames riverside (Caversham Road end) and Kennet riverside (Minster Street to Oracle shopping centre area) are EA Zone 2. The 2003 and 2007 Thames floods affected Caversham Bridge-adjacent properties. The Victorian terrace conservation area (Southampton Street, Zinzan Street) is Zone 1 (Low). The Environment Agency's Kennet and Thames flood alleviation programme has improved resilience since 2014.",
    },
    councilTax: {
      mostCommonBand: "Band D",
      annualCost: "£2,108",
      borough: "Reading Borough Council",
      note: "Reading Borough Council's council tax is above the English average. Band D (most common for RG1 flats and conservation area terraces) is £2,108/yr. Good value relative to London equivalents — a grammar school catchment 22 minutes from Bond Street at less than a third of Westminster's property prices.",
    },
    propertyTypeSplit: { flats: 58, terraced: 32, semiDetached: 7, detached: 2, other: 1, dominantType: "A balanced split — the RG1 conservation area terraces (32%) provide house stock that is meaningfully scarcer in most city-centre postcodes" },
    commuteTable: [
      { destination: "London Paddington", time: "22 min", mode: "Elizabeth line", via: "Reading → Paddington (Elizabeth line)" },
      { destination: "London Bond Street", time: "33 min", mode: "Elizabeth line", via: "Reading → Bond Street (Elizabeth line)" },
      { destination: "London Canary Wharf", time: "48 min", mode: "Elizabeth line", via: "Reading → Canary Wharf (Elizabeth line)" },
      { destination: "Bristol Temple Meads", time: "1hr 2min", mode: "Train", via: "Reading → Bristol (GWR)" },
    ],
    planningActivity: {
      recentApplications: 218,
      majorDevelopments: "Station Hill (1,500 homes, retail, office — delivering from 2024). Reading Prison development (heritage residential conversion, approved). Broad Street Mall redevelopment (retail/residential, planning approved). IDR (Inner Distribution Road) improvements (Reading BC, ongoing).",
      councilPortalUrl: "https://www.reading.gov.uk/planning",
      note: "Station Hill is the most significant new residential supply addition in RG1 — 1,500 new units may moderate new-build flat prices short-term. Focus on RG1 conservation area terraces (Southampton Street, Zinzan Street) which are insulated from new supply. Reading Prison's residential conversion will add distinctive period units to a heritage site.",
    },
    rentalMarket: {
      oneBedAskingRent: "£1,200 pcm",
      twoBedAskingRent: "£1,600 pcm",
      threeBedAskingRent: "£2,200 pcm",
      oneBedYield: "4.6%",
      twoBedYield: "4.2%",
      demandLevel: "High",
      note: "RG1 delivers strong yield with excellent London commuter demand. Elizabeth line access means Reading's rental market competes directly with Zone 4–5 London for City/Canary Wharf workers. Grammar school catchment addresses command meaningful rental premiums. Void periods on well-presented stock are typically 2–3 weeks.",
    },
    broadband: {
      avgDownloadSpeed: "228 Mbps",
      fullFibreAvailability: "84%",
      rating: "Excellent",
      providers: "Openreach FTTP, Virgin Media, CityFibre, Vodafone",
      note: "Excellent broadband coverage in RG1 — CityFibre's Reading buildout is among the most complete of any UK town. New builds (Station Hill) are universally FTTP. Conservation area terraces have benefited from progressive fibre upgrade programmes.",
    },
    airQuality: {
      no2Level: "24 µg/m³",
      pm25Level: "9 µg/m³",
      rating: "Good",
      note: "Reading's air quality is among the best of any large English town. The Thames corridor provides natural ventilation. The town centre Clean Air Zone (proposed but not yet implemented) would further reduce road traffic NO₂ on the IDR and Broad Street corridor.",
    },
    rentalDemand: {
      avgDaysToLet: 14,
      vsNationalAvg: "3× faster than national average (42 days)",
      score: 8,
      note: "RG1 attracts London commuter tenants who consistently cite the Elizabeth line as the primary decision driver. Conservation area 2-bed terraces are the fastest-letting segment (10–14 days). Reading grammar school catchment is a significant draw for families — 3-bed house supply is extremely tight.",
    },
    nearbyDevelopments: [
      { name: "Station Hill", type: "Mixed-use/Residential", status: "Delivering from 2024 (1,500 homes)", impact: "Monitor", detail: "Major new residential development adjacent to Reading station — 1,500 homes, retail, office. High-quality addition to RG1 but adds new-build supply. Period terraces in the conservation area are insulated from this supply pressure." },
      { name: "Reading Prison Conversion", type: "Residential", status: "Planning approved", impact: "Positive", detail: "The Grade I-listed former HM Prison Reading (Oscar Wilde's incarceration site) is approved for residential conversion. Unique heritage apartments on Forbury Road — will command significant premium on completion." },
    ],
    recentSoldPrices: [
      { address: "Southampton Street RG1", price: "£485,000", date: "Feb 2025", type: "Terraced", lat: 51.4553, lng: -0.9716 },
      { address: "Zinzan Street RG1", price: "£520,000", date: "Jan 2025", type: "Terraced", lat: 51.4559, lng: -0.9732 },
      { address: "Station Road RG1", price: "£295,000", date: "Mar 2025", type: "Flat", lat: 51.4588, lng: -0.9695 },
      { address: "Russell Street RG1", price: "£445,000", date: "Dec 2024", type: "Terraced", lat: 51.4568, lng: -0.9748 },
      { address: "Valpy Street RG1", price: "£265,000", date: "Jan 2025", type: "Flat", lat: 51.4572, lng: -0.9712 },
    ],
  },
};
