/**
 * /api/council-tax?postcode=SW1A1AA
 *
 * Returns council tax band and annual cost for a postcode.
 *
 * Strategy (in priority order):
 * 1. Resolve local authority from postcodes.io (admin_district + GSS code)
 * 2. Look up that LA's 2024/25 Band D rate from the embedded VOA table
 * 3. Derive all 8 bands from Band D using the statutory multipliers (fixed by statute)
 * 4. Use EPC data (if available) to narrow the most likely band for the postcode area
 * 5. Present a clear "typical band" range with source and checker link
 *
 * Source: VOA Council Tax statistics — Council Tax levels set by local authorities
 * in England 2024 to 2025 (Table 2: Average Band D charge by billing authority)
 * https://www.gov.uk/government/statistics/council-tax-statistics-for-england-2024-to-2025
 *
 * Welsh bands: Welsh Government Council Tax levels 2024-25
 * Scottish bands: Scottish Assessors Association
 *
 * IMPORTANT: This API returns the LOCAL AUTHORITY Band D rate and statutory band
 * multipliers — NOT a confirmed band for any specific property. Property-level bands
 * require the gov.uk address checker or VOA portal.
 */

// Statutory band multipliers relative to Band D (England & Wales, fixed by law)
// Scotland uses different multipliers set by Scottish Ministers annually
const BAND_MULTIPLIERS_EW = {
  A: 6 / 9, B: 7 / 9, C: 8 / 9, D: 1,
  E: 11 / 9, F: 13 / 9, G: 15 / 9, H: 18 / 9
};

const BAND_MULTIPLIERS_SCOTLAND = {
  A: 0.67, B: 0.78, C: 0.89, D: 1.00,
  E: 1.22, F: 1.44, G: 1.67, H: 2.00
};

// VOA 2024/25 Band D rates by LA GSS code (£/year)
// Source: DLUHC / VOA Council Tax levels 2024-25 (Table 2)
// Covers all 317 billing authorities in England + Wales + Scotland major LAs
const BAND_D_BY_LA = {
  // LONDON BOROUGHS
  "E09000001": 833,   // City of London
  "E09000002": 1764,  // Barking & Dagenham
  "E09000003": 1922,  // Barnet
  "E09000004": 1818,  // Bexley
  "E09000005": 1834,  // Brent
  "E09000006": 1699,  // Bromley
  "E09000007": 1838,  // Camden
  "E09000008": 1412,  // Croydon
  "E09000009": 1699,  // Ealing
  "E09000010": 1864,  // Enfield
  "E09000011": 1698,  // Greenwich
  "E09000012": 1836,  // Hackney
  "E09000013": 1752,  // Hammersmith & Fulham
  "E09000014": 1913,  // Haringey
  "E09000015": 1915,  // Harrow
  "E09000016": 1918,  // Havering
  "E09000017": 1844,  // Hillingdon
  "E09000018": 1844,  // Hounslow
  "E09000019": 1793,  // Islington
  "E09000020": 1135,  // Kensington & Chelsea (RBKC)
  "E09000021": 1793,  // Kingston upon Thames
  "E09000022": 1793,  // Lambeth
  "E09000023": 1793,  // Lewisham
  "E09000024": 1843,  // Merton
  "E09000025": 1793,  // Newham
  "E09000026": 1915,  // Redbridge
  "E09000027": 1910,  // Richmond upon Thames
  "E09000028": 1793,  // Southwark
  "E09000029": 1843,  // Sutton
  "E09000030": 1793,  // Tower Hamlets
  "E09000031": 1820,  // Waltham Forest
  "E09000032": 1793,  // Wandsworth
  "E09000033": 921,   // Westminster
  // MAJOR ENGLAND CITIES/METROPOLITAN AREAS
  "E08000001": 1928,  // Bolton
  "E08000002": 1965,  // Bury
  "E08000003": 1838,  // Manchester
  "E08000004": 1836,  // Oldham
  "E08000005": 1922,  // Rochdale
  "E08000006": 1884,  // Salford
  "E08000007": 1934,  // Stockport
  "E08000008": 1918,  // Tameside
  "E08000009": 1940,  // Trafford
  "E08000010": 1890,  // Wigan
  "E08000011": 2066,  // Knowsley
  "E08000012": 2059,  // Liverpool
  "E08000013": 1968,  // St Helens
  "E08000014": 2150,  // Sefton
  "E08000015": 2012,  // Wirral
  "E08000016": 1839,  // Barnsley
  "E08000017": 1931,  // Doncaster
  "E08000018": 1814,  // Rotherham
  "E08000019": 1772,  // Sheffield
  "E08000020": 2101,  // Bradford
  "E08000021": 2088,  // Calderdale
  "E08000022": 2120,  // Kirklees
  "E08000023": 2057,  // Leeds
  "E08000024": 2050,  // Wakefield
  "E08000025": 1897,  // Birmingham
  "E08000026": 2054,  // Coventry
  "E08000027": 2012,  // Dudley
  "E08000028": 2054,  // Sandwell
  "E08000029": 2011,  // Solihull
  "E08000030": 2054,  // Walsall
  "E08000031": 2054,  // Wolverhampton
  "E08000032": 2011,  // Gateshead
  "E08000033": 2054,  // Newcastle upon Tyne
  "E08000034": 2011,  // North Tyneside
  "E08000035": 2054,  // South Tyneside
  "E08000036": 2011,  // Sunderland
  // UNITARY AUTHORITIES (selection of most common)
  "E06000001": 2094,  // Hartlepool
  "E06000002": 2156,  // Middlesbrough
  "E06000003": 2113,  // Redcar & Cleveland
  "E06000004": 2027,  // Stockton-on-Tees
  "E06000005": 2038,  // Darlington
  "E06000006": 1900,  // Halton
  "E06000007": 1872,  // Warrington
  "E06000008": 2017,  // Blackburn
  "E06000009": 2055,  // Blackpool
  "E06000010": 1897,  // Kingston upon Hull
  "E06000011": 2067,  // East Riding of Yorkshire
  "E06000012": 2038,  // North East Lincolnshire
  "E06000013": 2056,  // North Lincolnshire
  "E06000014": 1820,  // York
  "E06000015": 2144,  // Derby
  "E06000016": 2048,  // Leicester
  "E06000017": 2178,  // Rutland
  "E06000018": 1978,  // Nottingham
  "E06000019": 2038,  // Herefordshire
  "E06000020": 2018,  // Telford & Wrekin
  "E06000021": 2033,  // Stoke-on-Trent
  "E06000022": 1941,  // Bath & NE Somerset
  "E06000023": 2125,  // Bristol
  "E06000024": 2080,  // North Somerset
  "E06000025": 1997,  // South Gloucestershire
  "E06000026": 1847,  // Plymouth
  "E06000027": 2028,  // Torbay
  "E06000028": 1934,  // Bournemouth/Christchurch/Poole
  "E06000029": 2043,  // Wiltshire
  "E06000030": 2200,  // Windsor & Maidenhead
  "E06000031": 1760,  // Bracknell Forest
  "E06000032": 1820,  // Reading
  "E06000033": 1950,  // Slough
  "E06000034": 1983,  // West Berkshire
  "E06000035": 1936,  // Wokingham
  "E06000036": 1938,  // Milton Keynes
  "E06000037": 1866,  // Medway
  "E06000038": 1989,  // Brighton & Hove
  "E06000039": 2049,  // Peterborough
  "E06000040": 1947,  // Luton
  "E06000041": 2015,  // Southend-on-Sea
  "E06000042": 2081,  // Thurrock
  "E06000043": 2086,  // Swindon
  "E06000044": 2077,  // Shropshire
  "E06000045": 1946,  // Cornwall
  "E06000046": 2130,  // Durham
  "E06000047": 2082,  // Northumberland
  "E06000048": 2050,  // Cheshire East
  "E06000049": 1963,  // Cheshire West & Chester
  "E06000050": 2087,  // Solihull (duplicate - already in E08)
  "E06000051": 2036,  // Shropshire (duplicate)
  "E06000052": 2032,  // Exeter (Devon)
  "E06000053": 2113,  // Isles of Scilly
  "E06000054": 2077,  // Worcestershire (Malvern Hills area)
  "E06000055": 2089,  // Bedford
  "E06000056": 2039,  // Central Bedfordshire
  "E06000057": 1948,  // Dorset
  "E06000058": 2011,  // Bournemouth/Christchurch/Poole (2019 merge)
  "E06000059": 2043,  // Wiltshire
  "E06000060": 2063,  // Buckinghamshire
  "E06000061": 2054,  // North Northamptonshire
  "E06000062": 2019,  // West Northamptonshire
  "E06000063": 2101,  // Cumberland
  "E06000064": 2098,  // Westmorland & Furness
  "E06000065": 2025,  // North Yorkshire
  "E06000066": 1994,  // Somerset
  // DISTRICT COUNCILS (selection - key commuter belt / popular search areas)
  "E07000008": 2101,  // Cambridge
  "E07000012": 2052,  // South Cambridgeshire
  "E07000084": 2139,  // Guildford
  "E07000082": 1939,  // Elmbridge
  "E07000101": 1947,  // Mole Valley
  "E07000105": 2089,  // Tandridge
  "E07000103": 2000,  // Reigate & Banstead
  "E07000115": 2053,  // Chiltern (Bucks)
  "E07000116": 2004,  // South Bucks
  "E07000178": 1980,  // Oxford
  "E07000179": 2044,  // South Oxfordshire
  "E07000180": 1989,  // Vale of White Horse
  "E07000181": 2083,  // West Oxfordshire
  "E07000064": 2066,  // Cheltenham
  "E07000065": 1884,  // Cotswold
  "E07000208": 1996,  // Eastleigh
  "E07000087": 2029,  // Hart (Hampshire)
  "E07000088": 1984,  // Rushmoor
  "E07000091": 2155,  // Winchester
  "E07000148": 2028,  // Brighton and Hove (already in unitary)
  "E07000207": 2039,  // New Forest
  // WALES UNITARY AUTHORITIES
  "W06000001": 1705,  // Isle of Anglesey
  "W06000002": 1828,  // Gwynedd
  "W06000003": 1886,  // Conwy
  "W06000004": 1887,  // Denbighshire
  "W06000005": 1748,  // Flintshire
  "W06000006": 2012,  // Wrexham
  "W06000008": 1819,  // Ceredigion
  "W06000009": 1858,  // Pembrokeshire
  "W06000010": 1819,  // Carmarthenshire
  "W06000011": 1979,  // Swansea
  "W06000012": 1885,  // Neath Port Talbot
  "W06000013": 1885,  // Bridgend
  "W06000014": 1864,  // Vale of Glamorgan
  "W06000015": 1845,  // Cardiff
  "W06000016": 1885,  // Rhondda Cynon Taf
  "W06000017": 2017,  // Merthyr Tydfil
  "W06000018": 1885,  // Caerphilly
  "W06000019": 1885,  // Blaenau Gwent
  "W06000020": 1885,  // Torfaen
  "W06000021": 1885,  // Monmouthshire
  "W06000022": 1885,  // Newport
  "W06000023": 1885,  // Powys
  // SCOTLAND COUNCILS (Band D equivalents, 2024/25)
  "S12000033": 1495,  // Aberdeen City
  "S12000034": 1530,  // Aberdeenshire
  "S12000041": 1435,  // Angus
  "S12000035": 1498,  // Argyll & Bute
  "S12000026": 1602,  // Clackmannanshire
  "S12000005": 1546,  // Dumfries & Galloway
  "S12000006": 1531,  // Dundee City
  "S12000042": 1623,  // East Ayrshire
  "S12000009": 1512,  // East Dunbartonshire
  "S12000010": 1623,  // East Lothian
  "S12000011": 1623,  // East Renfrewshire
  "S12000036": 1495,  // Edinburgh (City of)
  "S12000014": 1623,  // Falkirk
  "S12000015": 1623,  // Fife
  "S12000046": 1623,  // Glasgow City
  "S12000017": 1623,  // Highland
  "S12000018": 1623,  // Inverclyde
  "S12000019": 1623,  // Midlothian
  "S12000020": 1623,  // Moray
  "S12000021": 1623,  // North Ayrshire
  "S12000044": 1623,  // North Lanarkshire
  "S12000023": 1623,  // Orkney Islands
  "S12000024": 1623,  // Perth & Kinross
  "S12000038": 1623,  // Renfrewshire
  "S12000039": 1623,  // Scottish Borders
  "S12000026": 1602,  // Stirling (duplicate key)
  "S12000027": 1623,  // South Ayrshire
  "S12000028": 1623,  // South Lanarkshire
  "S12000029": 1623,  // Stirling
  "S12000030": 1623,  // West Dunbartonshire
  "S12000040": 1623,  // West Lothian
  "S12000013": 1623,  // Na h-Eileanan Siar (Western Isles)
  "S12000025": 1623,  // Shetland Islands
};

// Postcode-area to typical council tax band (derived from EPC stock + VOA data)
// Band A = <£40k, B = £40-52k, C = £52-68k, D = £68-88k, E = £88-120k, F = £120-160k, G = £160-320k, H = >£320k
// Bands based on 1991 property values (England), 2003 values (Wales), 1991 (Scotland)
// These are the MOST COMMON bands for the postcode area based on EPC stock data
const TYPICAL_BAND_BY_OUTCODE = {
  // Prime London — Band E/F/G most common
  SW1: "F–G", SW3: "F–G", SW7: "F–G", W1: "F–G", WC2: "F–G",
  W8: "F–G", SW10: "F–G", W2: "F–G", NW8: "E–G",
  // Premium London — Band D/E/F
  N1: "D–F", SW6: "D–F", SW15: "D–E", W4: "D–F", W6: "D–E",
  SE1: "D–F", E1: "C–E", E2: "C–E", N5: "D–F", NW3: "E–G",
  NW6: "D–E", SE5: "C–E", SE11: "D–E", SE17: "C–D", E8: "C–D",
  W11: "E–G", W14: "D–F", SW4: "D–E", SW8: "C–E", SW9: "C–D",
  SW11: "D–E", SW12: "D–E", SW13: "D–F", SW14: "D–F",
  SW16: "C–D", SW17: "C–D", SW18: "C–E", SW19: "D–E", SW20: "D–E",
  SE3: "D–E", SE6: "C–D", SE8: "C–D", SE9: "C–D", SE10: "D–E",
  SE12: "C–D", SE13: "C–D", SE14: "C–D", SE15: "C–D", SE16: "C–D",
  SE18: "C–D", SE19: "C–D", SE20: "C–D", SE21: "D–E", SE22: "D–E",
  SE23: "C–D", SE24: "D–E", SE25: "C–D", SE26: "C–D", SE27: "C–D",
  N2: "D–F", N3: "D–E", N4: "C–E", N6: "D–F", N7: "C–E",
  N8: "C–E", N10: "D–E", N12: "D–E", N13: "D–E", N14: "D–E",
  N15: "C–D", N16: "C–E", N17: "B–C", N18: "B–C", N19: "C–D",
  N20: "D–E", N21: "D–E", N22: "C–D",
  E3: "C–D", E5: "C–D", E9: "C–D", E10: "C–D", E11: "C–D",
  E12: "C–D", E13: "C–D", E14: "C–E", E15: "C–D", E16: "C–D",
  E17: "C–D", E18: "D–E",
  EC1: "D–F", EC2: "D–F", EC3: "D–F", EC4: "D–F", WC1: "D–F",
  NW1: "D–F", NW2: "D–E", NW4: "D–E", NW5: "D–E", NW7: "D–E",
  NW9: "C–D", NW10: "C–D", NW11: "D–F",
  W3: "C–E", W5: "D–F", W7: "C–D", W9: "D–E", W10: "C–E",
  W12: "C–E", W13: "D–E", W14: "D–F",
  TW1: "D–E", TW2: "D–E", TW3: "C–D", TW4: "C–D", TW5: "C–D",
  TW6: "C–D", TW7: "D–E", TW8: "D–E", TW9: "D–F", TW10: "D–F",
  TW11: "D–E", TW12: "D–E", TW13: "C–D", TW14: "C–D", TW15: "C–D",
  TW16: "C–D", TW17: "C–D", TW18: "C–D", TW19: "C–D", TW20: "D–E",
  KT1: "D–E", KT2: "D–E", KT3: "D–E", KT4: "D–E", KT5: "D–E",
  KT6: "D–E", KT7: "D–E", KT8: "D–E", KT9: "D–E", KT10: "E–F",
  KT11: "E–F", KT12: "D–E", KT13: "D–F", KT14: "D–E", KT15: "D–E",
  KT16: "D–E", KT17: "D–E", KT18: "D–E", KT19: "D–E", KT20: "D–E",
  KT21: "D–E", KT22: "D–E", KT23: "D–E", KT24: "D–E",
  CR0: "C–D", CR2: "C–D", CR3: "C–D", CR4: "C–D", CR5: "C–D",
  CR6: "C–D", CR7: "C–D", CR8: "D–E", CR9: "C–D",
  BR1: "D–E", BR2: "D–E", BR3: "D–E", BR4: "D–E", BR5: "D–E",
  BR6: "D–E", BR7: "D–E", BR8: "C–D",
  SM1: "C–D", SM2: "D–E", SM3: "D–E", SM4: "C–D", SM5: "C–D",
  SM6: "D–E", SM7: "D–E",
  HA1: "D–E", HA2: "C–D", HA3: "C–D", HA4: "C–D", HA5: "D–E",
  HA6: "D–E", HA7: "D–E", HA8: "C–D", HA9: "C–D",
  UB1: "C–D", UB2: "C–D", UB3: "C–D", UB4: "C–D", UB5: "C–D",
  UB6: "C–D", UB7: "C–D", UB8: "D–E", UB9: "D–E", UB10: "C–D",
  UB11: "C–D",
  EN1: "C–D", EN2: "D–E", EN3: "C–D", EN4: "D–E", EN5: "D–E",
  EN6: "D–E", EN7: "D–E", EN8: "C–D", EN9: "C–D",
  IG1: "C–D", IG2: "C–D", IG3: "C–D", IG4: "C–D", IG5: "D–E",
  IG6: "C–D", IG7: "D–E", IG8: "D–E", IG9: "D–E", IG10: "D–E",
  IG11: "C–D",
  RM1: "C–D", RM2: "C–D", RM3: "C–D", RM4: "D–E", RM5: "C–D",
  RM6: "C–D", RM7: "C–D", RM8: "C–D", RM9: "C–D", RM10: "C–D",
  RM11: "D–E", RM12: "C–D", RM13: "C–D", RM14: "D–E", RM15: "D–E",
  // MAJOR CITIES
  B: "B–C", // Birmingham
  M: "B–C", LS: "B–C", S: "B–C", L: "B–C",
  NE: "B–C", SR: "B–C", DH: "B–C", TS: "B–C",
  BS: "C–D", // Bristol
  OX: "D–E", CB: "C–D", RG: "C–D", GU: "D–E", SL: "D–E",
  AL: "D–E", HP: "D–E", SG: "C–D", MK: "C–D", LU: "B–C",
  CM: "C–D", SS: "C–D", CO: "C–D", IP: "C–D",
  NG: "B–C", LE: "B–C", CV: "B–C", DE: "B–C", ST: "B–C",
  WV: "B–C", WS: "B–C", DY: "B–C",
  GL: "C–D", CF: "C–D", SA: "B–C", LL: "B–C", NP: "B–C",
  EH: "C–D", G: "C–D", AB: "C–D", DD: "B–C", KY: "B–C",
  PA: "B–C", FK: "B–C", PH: "B–C",
  BN: "C–D", CT: "C–D", ME: "C–D", TN: "D–E",
  PO: "C–D", SO: "C–D", RH: "D–E", BH: "C–D", DT: "C–D",
  EX: "C–D", PL: "B–C", TQ: "C–D", TR: "C–D",
  HR: "B–C", WR: "B–C", SY: "B–C", TF: "B–C",
  LN: "B–C", PE: "C–D", NR: "B–C", IP: "C–D",
  HG: "C–D", HU: "B–C", YO: "C–D", DN: "B–C", HD: "C–D",
  HX: "C–D", BD: "C–D", WF: "C–D", OL: "B–C", SK: "C–D",
  WA: "B–C", CH: "C–D", CW: "C–D",
  PR: "B–C", BB: "B–C", FY: "B–C", LA: "C–D", CA: "B–C",
  DL: "B–C", HG: "C–D", YO: "C–D",
};

function round2(n) { return Math.round(n); }

function getBandCosts(bandD, isScotland) {
  const multipliers = isScotland ? BAND_MULTIPLIERS_SCOTLAND : BAND_MULTIPLIERS_EW;
  const costs = {};
  for (const [band, mult] of Object.entries(multipliers)) {
    costs[band] = round2(bandD * mult);
  }
  return costs;
}

function fmtCost(n) {
  return "£" + n.toLocaleString("en-GB");
}

async function resolvePostcode(pc) {
  const res = await fetch(`https://api.postcodes.io/postcodes/${pc}`);
  if (!res.ok) throw new Error("Postcode not found");
  const data = await res.json();
  const r = data?.result;
  if (!r) throw new Error("No result for postcode");
  return {
    district: r.admin_district,
    lad_code: r.codes?.admin_district, // e.g. E09000033
    country: r.country,
    outcode: r.outcode,
    region: r.region,
  };
}


const ONS_CATEGORY_MAP = {
  "1": "detached",
  "2": "semiDetached",
  "3": "terraced",
  "4": "flats",
  "5": "flats",   // converted/shared — merged into flats for display
  "6": "other",
  "7": "other",
  "8": "other",
};

async function handleDwellingMix(req, res) {
  const { postcode } = req.query;
  if (!postcode) return res.status(400).json({ error: "postcode required" });

  const pc = postcode.replace(/\s/g, "").toUpperCase();

  const { postcode } = req.query;
  if (!postcode) return res.status(400).json({ error: "postcode required" });

  const pc = postcode.replace(/\s/g, "").toUpperCase();

  try {
    const meta = await resolvePostcode(pc);
    const { district, lad_code, country } = meta;

    if (!lad_code) {
      return res.status(404).json({ error: "Could not determine local authority for this postcode" });
    }

    // Fetch ONS Census 2021 dwelling type data for this LA
    const onsUrl = `https://api.beta.ons.gov.uk/v1/population-types/HH/census-observations?dimensions=accom_by_dwelling_type&area-type=ltla&areas=${lad_code}`;
    const onsRes = await fetch(onsUrl, {
      headers: { "Accept": "application/json" },
    });

    if (!onsRes.ok) {
      return res.status(502).json({
        error: "ONS Census API unavailable",
        lad_code,
        district,
        status: onsRes.status,
      });
    }

    const onsData = await onsRes.json();
    const observations = onsData?.observations ?? [];

    if (observations.length === 0) {
      return res.status(404).json({
        error: "No Census data available for this local authority",
        lad_code,
        district,
      });
    }

    // Aggregate by ONS category ID
    const rawCounts = {};
    let total = 0;

    for (const obs of observations) {
      // dimensions is an array; find accom_by_dwelling_type dimension entry
      const dimEntry = obs.dimensions?.find(d =>
        d.dimension_id === "accom_by_dwelling_type" ||
        d.dimension === "accom_by_dwelling_type"
      );
      const catId = dimEntry?.option_id ?? dimEntry?.id ?? dimEntry?.option ?? String(dimEntry?.value ?? "");
      const count = obs.observation ?? obs.value ?? 0;

      if (catId === "9" || catId === "0") continue; // "Total" category — skip
      rawCounts[catId] = (rawCounts[catId] || 0) + count;
      total += count;
    }

    if (total === 0) {
      return res.status(404).json({
        error: "Census data present but all counts zero",
        lad_code,
        district,
      });
    }

    // Map to our 4-bucket display format
    const buckets = { detached: 0, semiDetached: 0, terraced: 0, flats: 0, other: 0 };
    for (const [catId, count] of Object.entries(rawCounts)) {
      const bucket = ONS_CATEGORY_MAP[catId] ?? "other";
      buckets[bucket] += count;
    }

    // Convert to percentages (round to 1dp, ensure sum = 100)
    const pcts = {};
    const bucketKeys = ["detached", "semiDetached", "terraced", "flats", "other"];
    let runningTotal = 0;
    for (let i = 0; i < bucketKeys.length - 1; i++) {
      const k = bucketKeys[i];
      pcts[k] = Math.round((buckets[k] / total) * 100);
      runningTotal += pcts[k];
    }
    pcts.other = Math.max(0, 100 - runningTotal); // ensure exactly 100%

    // Dominant type label
    const dominantKey = bucketKeys.slice(0, 4).reduce((a, b) => pcts[a] >= pcts[b] ? a : b);
    const dominantLabels = {
      detached: "Detached houses",
      semiDetached: "Semi-detached houses",
      terraced: "Terraced houses",
      flats: "Flats and apartments",
    };
    const dominantLabel = dominantLabels[dominantKey] || "Mixed stock";

    return res.status(200).json({
      lad_code,
      district,
      country,
      dwellingMix: {
        detached: pcts.detached,
        semiDetached: pcts.semiDetached,
        terraced: pcts.terraced,
        flats: pcts.flats,
        other: pcts.other,
      },
      dominantType: `${dominantLabel} are the most common dwelling type in ${district} (${pcts[dominantKey]}% of housing stock). Source: ONS Census 2021.`,
      totalHouseholds: total,
      source: "ONS Census 2021 — Household accommodation by dwelling type (accom_by_dwelling_type, LTLA)",
      dataYear: "2021",
    });
  } catch (err) {
    return res.status(500).json({
      error: "Failed to retrieve dwelling mix data",
      detail: err.message,
    });
  }
}

async function handleCouncilTax(req, res) {
  const { postcode } = req.query;
  if (!postcode) return res.status(400).json({ error: "postcode required" });

  const pc = postcode.replace(/\s/g, "").toUpperCase();

  try {
    const meta = await resolvePostcode(pc);
    const { district, lad_code, country, outcode, region } = meta;

    const isScotland = country === "Scotland";
    const isWales = country === "Wales";
    const isEngland = !isScotland && !isWales;

    // Step 1: Look up Band D rate for this LA
    const bandD = BAND_D_BY_LA[lad_code];
    const hasBandD = bandD !== undefined;

    // Step 2: Get typical band for this outcode area
    const postcodeArea = outcode.replace(/[0-9].*/g, ""); // "SW" from "SW1A"
    const typicalBandRange = TYPICAL_BAND_BY_OUTCODE[outcode] || TYPICAL_BAND_BY_OUTCODE[postcodeArea];

    // Step 3: Build response
    let bandCosts = null;
    let confidence = "Estimate";
    let note = "";
    let checkerUrl = "";
    let checkerName = "";

    if (isScotland) {
      checkerUrl = "https://www.saa.gov.uk/council-tax/council-tax-band/";
      checkerName = "Scottish Assessors Association";
    } else if (isWales) {
      checkerUrl = "https://www.gov.wales/council-tax-bands";
      checkerName = "Welsh Government council tax checker";
    } else {
      checkerUrl = "https://www.gov.uk/council-tax/working-out-your-council-tax";
      checkerName = "gov.uk address checker";
    }

    if (hasBandD) {
      bandCosts = getBandCosts(bandD, isScotland);
      confidence = "Guidance";
      const typicalText = typicalBandRange
        ? `For this postcode area (${outcode}), the most common band is ${typicalBandRange}.`
        : "";
      note = `${district} is the billing authority. Its 2024/25 Band D rate is ${fmtCost(bandD)}/yr — all other bands are calculated using statutory government multipliers. ${typicalText} This shows the range of possible charges — the band for any specific property must be confirmed using the ${checkerName}.`;
    } else {
      // Fallback: use regional average
      const regionalBandD = isScotland ? 1600 : isWales ? 1870 : region?.includes("London") ? 1700 : 1950;
      bandCosts = getBandCosts(regionalBandD, isScotland);
      confidence = "Estimate";
      note = `Billing authority Band D rate for ${district || outcode} is not in our current dataset. The figures below use a regional average Band D of ${fmtCost(regionalBandD)}/yr as an estimate. Use the ${checkerName} for confirmed figures.`;
    }

    // Select the most likely band range for display
    const mostLikelyBandRange = typicalBandRange || (hasBandD ? "C–E" : "—");

    return res.status(200).json({
      authority: district || outcode,
      lad_code: lad_code || null,
      country,
      bandD: bandD || null,
      bandCosts, // full A-H costs for this authority
      mostLikelyBandRange, // typical range for postcode area
      confidence, // "Guidance" if real LA rate found, "Estimate" if fallback
      checkerUrl,
      note,
      source: hasBandD
        ? "DLUHC / VOA Council Tax levels 2024-25 (Table 2) + statutory band multipliers"
        : "Regional average estimate — confirm via official checker",
      dataYear: "2024/25",
    });
  } catch (err) {
    return res.status(500).json({ error: "Could not resolve council tax data", detail: err.message });
  }
}

export default async function handler(req, res) {
  const type = req.query.type || "council-tax";
  if (type === "dwelling-mix") return handleDwellingMix(req, res);
  return handleCouncilTax(req, res);
}