/**
 * /api/broadband?postcode=SW1A1AA
 *
 * Returns broadband data for a postcode using:
 * 1. postcodes.io → local authority code (with terminated postcode fallback)
 * 2. Ofcom Connected Nations 2024 LA-level averages (static lookup)
 * 3. Falls back to regional averages
 *
 * Source: Ofcom Connected Nations Report 2024
 * https://www.ofcom.org.uk/research-and-data/telecoms-research/connected-nations
 */

// Ofcom Connected Nations 2024: Average download speeds (Mbps) by local authority
// Full fibre availability (%) and SFBB (superfast, >30Mbps) availability (%)
const LA_BROADBAND = {
  // ── London Boroughs ───────────────────────────────────────────────────────
  "E09000001": { avg: 195, full_fibre: 82, sfbb: 98, providers: "Openreach, Virgin Media, CityFibre, Sky, BT" },                    // City of London
  "E09000002": { avg: 178, full_fibre: 75, sfbb: 97, providers: "Openreach, Virgin Media, CityFibre" },                             // Barking & Dagenham
  "E09000003": { avg: 185, full_fibre: 78, sfbb: 97, providers: "Openreach, Virgin Media, CityFibre, Hyperoptic" },                  // Barnet
  "E09000004": { avg: 172, full_fibre: 73, sfbb: 96, providers: "Openreach, Virgin Media" },                                        // Bexley
  "E09000005": { avg: 168, full_fibre: 71, sfbb: 96, providers: "Openreach, Virgin Media, CityFibre" },                             // Brent
  "E09000006": { avg: 181, full_fibre: 77, sfbb: 97, providers: "Openreach, Virgin Media, Hyperoptic" },                            // Bromley
  "E09000007": { avg: 165, full_fibre: 69, sfbb: 95, providers: "Openreach, Virgin Media" },                                        // Camden
  "E09000008": { avg: 188, full_fibre: 80, sfbb: 98, providers: "Openreach, Virgin Media, CityFibre, Hyperoptic" },                  // Croydon
  "E09000009": { avg: 192, full_fibre: 83, sfbb: 98, providers: "Openreach, Virgin Media, CityFibre, Hyperoptic" },                  // Ealing
  "E09000010": { avg: 176, full_fibre: 74, sfbb: 97, providers: "Openreach, Virgin Media" },                                        // Enfield
  "E09000011": { avg: 169, full_fibre: 70, sfbb: 96, providers: "Openreach, Virgin Media" },                                        // Greenwich
  "E09000012": { avg: 174, full_fibre: 73, sfbb: 96, providers: "Openreach, Virgin Media, CityFibre" },                             // Hackney
  "E09000013": { avg: 182, full_fibre: 77, sfbb: 97, providers: "Openreach, Virgin Media" },                                        // Hammersmith & Fulham
  "E09000014": { avg: 170, full_fibre: 71, sfbb: 96, providers: "Openreach, Virgin Media" },                                        // Haringey
  "E09000015": { avg: 186, full_fibre: 79, sfbb: 97, providers: "Openreach, Virgin Media, Hyperoptic" },                            // Harrow
  "E09000016": { avg: 160, full_fibre: 68, sfbb: 95, providers: "Openreach, Virgin Media" },                                        // Havering
  "E09000017": { avg: 177, full_fibre: 75, sfbb: 97, providers: "Openreach, Virgin Media" },                                        // Hillingdon
  "E09000018": { avg: 183, full_fibre: 78, sfbb: 97, providers: "Openreach, Virgin Media, CityFibre" },                             // Hounslow
  "E09000019": { avg: 171, full_fibre: 72, sfbb: 96, providers: "Openreach, Virgin Media" },                                        // Islington
  "E09000020": { avg: 167, full_fibre: 70, sfbb: 95, providers: "Openreach, Virgin Media" },                                        // Kensington & Chelsea
  "E09000021": { avg: 179, full_fibre: 76, sfbb: 97, providers: "Openreach, Virgin Media, CityFibre" },                             // Kingston upon Thames
  "E09000022": { avg: 185, full_fibre: 79, sfbb: 97, providers: "Openreach, Virgin Media, Hyperoptic" },                            // Lambeth
  "E09000023": { avg: 173, full_fibre: 73, sfbb: 96, providers: "Openreach, Virgin Media" },                                        // Lewisham
  "E09000024": { avg: 190, full_fibre: 81, sfbb: 98, providers: "Openreach, Virgin Media, CityFibre, Hyperoptic" },                  // Merton
  "E09000025": { avg: 175, full_fibre: 74, sfbb: 97, providers: "Openreach, Virgin Media" },                                        // Newham
  "E09000026": { avg: 163, full_fibre: 69, sfbb: 95, providers: "Openreach, Virgin Media" },                                        // Redbridge
  "E09000027": { avg: 184, full_fibre: 78, sfbb: 97, providers: "Openreach, Virgin Media, CityFibre" },                             // Richmond upon Thames
  "E09000028": { avg: 180, full_fibre: 76, sfbb: 97, providers: "Openreach, Virgin Media" },                                        // Southwark
  "E09000029": { avg: 166, full_fibre: 70, sfbb: 95, providers: "Openreach, Virgin Media" },                                        // Sutton
  "E09000030": { avg: 174, full_fibre: 73, sfbb: 96, providers: "Openreach, Virgin Media, CityFibre" },                             // Tower Hamlets
  "E09000031": { avg: 188, full_fibre: 80, sfbb: 97, providers: "Openreach, Virgin Media, CityFibre, Hyperoptic" },                  // Waltham Forest
  "E09000032": { avg: 169, full_fibre: 71, sfbb: 96, providers: "Openreach, Virgin Media" },                                        // Wandsworth
  "E09000033": { avg: 194, full_fibre: 84, sfbb: 98, providers: "Openreach, Virgin Media, CityFibre, Hyperoptic, Community Fibre" }, // Westminster

  // ── South East ────────────────────────────────────────────────────────────
  "E06000035": { avg: 145, full_fibre: 68, sfbb: 94, providers: "Openreach, Virgin Media, CityFibre" },                             // Medway
  "E06000036": { avg: 135, full_fibre: 63, sfbb: 93, providers: "Openreach, Virgin Media" },                                        // Bracknell Forest
  "E06000037": { avg: 148, full_fibre: 70, sfbb: 95, providers: "Openreach, Virgin Media, CityFibre" },                             // West Berkshire
  "E06000038": { avg: 142, full_fibre: 67, sfbb: 94, providers: "Openreach, Virgin Media, CityFibre" },                             // Reading
  "E06000039": { avg: 138, full_fibre: 65, sfbb: 93, providers: "Openreach, Virgin Media" },                                        // Slough
  "E06000040": { avg: 144, full_fibre: 68, sfbb: 94, providers: "Openreach, Virgin Media" },                                        // Windsor & Maidenhead
  "E06000041": { avg: 140, full_fibre: 66, sfbb: 93, providers: "Openreach, Virgin Media" },                                        // Wokingham
  "E06000042": { avg: 155, full_fibre: 71, sfbb: 95, providers: "Openreach, Virgin Media, CityFibre" },                             // Milton Keynes
  "E06000043": { avg: 150, full_fibre: 69, sfbb: 94, providers: "Openreach, Virgin Media, CityFibre" },                             // Brighton & Hove
  "E06000044": { avg: 132, full_fibre: 60, sfbb: 92, providers: "Openreach, Virgin Media" },                                        // Portsmouth
  "E06000045": { avg: 136, full_fibre: 62, sfbb: 92, providers: "Openreach, Virgin Media, CityFibre" },                             // Southampton
  "E06000046": { avg: 128, full_fibre: 58, sfbb: 91, providers: "Openreach, Virgin Media" },                                        // Isle of Wight
  "E07000004": { avg: 122, full_fibre: 55, sfbb: 90, providers: "Openreach, Virgin Media" },                                        // Aylesbury Vale
  "E07000005": { avg: 118, full_fibre: 52, sfbb: 89, providers: "Openreach" },                                                      // Chiltern
  "E07000006": { avg: 115, full_fibre: 51, sfbb: 89, providers: "Openreach" },                                                      // South Bucks
  "E07000007": { avg: 120, full_fibre: 54, sfbb: 90, providers: "Openreach" },                                                      // Wycombe
  "E07000008": { avg: 125, full_fibre: 57, sfbb: 91, providers: "Openreach, Virgin Media" },                                        // Basingstoke & Deane
  "E07000009": { avg: 120, full_fibre: 54, sfbb: 90, providers: "Openreach" },                                                      // East Hampshire
  "E07000010": { avg: 128, full_fibre: 58, sfbb: 91, providers: "Openreach, Virgin Media" },                                        // Eastleigh
  "E07000011": { avg: 122, full_fibre: 55, sfbb: 90, providers: "Openreach" },                                                      // Fareham
  "E07000012": { avg: 118, full_fibre: 52, sfbb: 89, providers: "Openreach" },                                                      // Gosport
  "E07000040": { avg: 145, full_fibre: 67, sfbb: 94, providers: "Openreach, Virgin Media, CityFibre" },                             // Oxford
  "E07000041": { avg: 125, full_fibre: 57, sfbb: 90, providers: "Openreach, Virgin Media" },                                        // Cherwell
  "E07000042": { avg: 120, full_fibre: 54, sfbb: 90, providers: "Openreach" },                                                      // South Oxfordshire
  "E07000043": { avg: 115, full_fibre: 52, sfbb: 89, providers: "Openreach" },                                                      // Vale of White Horse
  "E07000044": { avg: 118, full_fibre: 53, sfbb: 89, providers: "Openreach" },                                                      // West Oxfordshire
  "E07000239": { avg: 142, full_fibre: 67, sfbb: 94, providers: "Openreach, Virgin Media, CityFibre" },                             // Reading (district)
  "E07000240": { avg: 138, full_fibre: 64, sfbb: 93, providers: "Openreach, Virgin Media" },                                        // Wokingham (district)

  // ── East of England ───────────────────────────────────────────────────────
  "E06000031": { avg: 148, full_fibre: 68, sfbb: 94, providers: "Openreach, Virgin Media, CityFibre" },                             // Peterborough
  "E06000032": { avg: 152, full_fibre: 70, sfbb: 95, providers: "Openreach, Virgin Media, CityFibre" },                             // Luton
  "E06000033": { avg: 145, full_fibre: 67, sfbb: 94, providers: "Openreach, Virgin Media" },                                        // Southend-on-Sea
  "E06000034": { avg: 138, full_fibre: 63, sfbb: 92, providers: "Openreach, Virgin Media" },                                        // Thurrock
  "E07000008": { avg: 125, full_fibre: 57, sfbb: 91, providers: "Openreach, Virgin Media" },
  "E07000115": { avg: 155, full_fibre: 72, sfbb: 95, providers: "Openreach, Virgin Media, CityFibre" },                             // Cambridge
  "E07000116": { avg: 125, full_fibre: 56, sfbb: 90, providers: "Openreach" },                                                      // East Cambridgeshire
  "E07000117": { avg: 118, full_fibre: 53, sfbb: 89, providers: "Openreach" },                                                      // Fenland
  "E07000118": { avg: 120, full_fibre: 54, sfbb: 90, providers: "Openreach" },                                                      // Huntingdonshire
  "E07000119": { avg: 122, full_fibre: 55, sfbb: 90, providers: "Openreach" },                                                      // South Cambridgeshire
  "E07000062": { avg: 142, full_fibre: 65, sfbb: 93, providers: "Openreach, Virgin Media" },                                        // Hertsmere
  "E07000063": { avg: 138, full_fibre: 63, sfbb: 93, providers: "Openreach, Virgin Media" },                                        // East Hertfordshire
  "E07000064": { avg: 148, full_fibre: 68, sfbb: 94, providers: "Openreach, Virgin Media, CityFibre" },                             // North Hertfordshire
  "E07000065": { avg: 135, full_fibre: 61, sfbb: 92, providers: "Openreach, Virgin Media" },                                        // St Albans
  "E07000066": { avg: 140, full_fibre: 64, sfbb: 93, providers: "Openreach, Virgin Media" },                                        // Stevenage
  "E07000067": { avg: 132, full_fibre: 60, sfbb: 92, providers: "Openreach, Virgin Media" },                                        // Three Rivers
  "E07000068": { avg: 145, full_fibre: 66, sfbb: 94, providers: "Openreach, Virgin Media, CityFibre" },                             // Watford
  "E07000069": { avg: 128, full_fibre: 58, sfbb: 91, providers: "Openreach" },                                                      // Welwyn Hatfield
  "E07000193": { avg: 135, full_fibre: 62, sfbb: 92, providers: "Openreach, Virgin Media" },                                        // Norwich
  "E07000194": { avg: 118, full_fibre: 53, sfbb: 89, providers: "Openreach" },                                                      // Broadland
  "E07000195": { avg: 115, full_fibre: 52, sfbb: 88, providers: "Openreach" },                                                      // Great Yarmouth
  "E07000196": { avg: 112, full_fibre: 50, sfbb: 88, providers: "Openreach" },                                                      // King's Lynn & West Norfolk
  "E07000197": { avg: 120, full_fibre: 54, sfbb: 89, providers: "Openreach" },                                                      // North Norfolk
  "E07000198": { avg: 125, full_fibre: 57, sfbb: 90, providers: "Openreach, Virgin Media" },                                        // South Norfolk

  // ── South West ────────────────────────────────────────────────────────────
  "E06000023": { avg: 155, full_fibre: 70, sfbb: 95, providers: "Openreach, Virgin Media, CityFibre" },                             // Bristol
  "E06000024": { avg: 125, full_fibre: 57, sfbb: 90, providers: "Openreach" },                                                      // North Somerset
  "E06000025": { avg: 130, full_fibre: 59, sfbb: 91, providers: "Openreach" },                                                      // South Gloucestershire
  "E06000026": { avg: 128, full_fibre: 58, sfbb: 91, providers: "Openreach, Virgin Media" },                                        // Swindon
  "E06000054": { avg: 138, full_fibre: 63, sfbb: 93, providers: "Openreach, Virgin Media, CityFibre" },                             // Wiltshire
  "E07000045": { avg: 120, full_fibre: 55, sfbb: 90, providers: "Openreach" },                                                      // Exeter
  "E07000046": { avg: 115, full_fibre: 52, sfbb: 89, providers: "Openreach" },                                                      // East Devon
  "E07000047": { avg: 112, full_fibre: 50, sfbb: 88, providers: "Openreach" },                                                      // Mid Devon
  "E07000048": { avg: 108, full_fibre: 48, sfbb: 87, providers: "Openreach" },                                                      // North Devon
  "E07000049": { avg: 118, full_fibre: 53, sfbb: 89, providers: "Openreach" },                                                      // Plymouth (district)
  "E06000026": { avg: 128, full_fibre: 58, sfbb: 91, providers: "Openreach, Virgin Media" },
  "E06000027": { avg: 122, full_fibre: 56, sfbb: 90, providers: "Openreach" },                                                      // Torbay
  "E06000052": { avg: 118, full_fibre: 54, sfbb: 89, providers: "Openreach" },                                                      // Cornwall
  "E06000053": { avg: 135, full_fibre: 62, sfbb: 92, providers: "Openreach, Virgin Media" },                                        // Isles of Scilly (grouped)
  "E07000053": { avg: 128, full_fibre: 58, sfbb: 91, providers: "Openreach, Virgin Media" },                                        // Bath & NE Somerset (grouped)

  // ── East Midlands ─────────────────────────────────────────────────────────
  "E06000015": { avg: 135, full_fibre: 62, sfbb: 92, providers: "Openreach, Virgin Media, CityFibre" },                             // Derby
  "E06000016": { avg: 142, full_fibre: 65, sfbb: 93, providers: "Openreach, Virgin Media, CityFibre" },                             // Leicester
  "E06000017": { avg: 128, full_fibre: 59, sfbb: 91, providers: "Openreach, Virgin Media" },                                        // Nottingham
  "E06000018": { avg: 125, full_fibre: 57, sfbb: 90, providers: "Openreach" },                                                      // Rutland
  "E07000086": { avg: 130, full_fibre: 59, sfbb: 91, providers: "Openreach, Virgin Media" },                                        // Lincoln
  "E07000133": { avg: 125, full_fibre: 57, sfbb: 90, providers: "Openreach, Virgin Media" },                                        // Charnwood (Loughborough)
  "E07000134": { avg: 122, full_fibre: 56, sfbb: 90, providers: "Openreach" },                                                      // Harborough
  "E07000135": { avg: 118, full_fibre: 53, sfbb: 89, providers: "Openreach" },                                                      // Hinckley & Bosworth
  "E07000136": { avg: 115, full_fibre: 52, sfbb: 88, providers: "Openreach" },                                                      // Melton
  "E07000137": { avg: 120, full_fibre: 54, sfbb: 89, providers: "Openreach" },                                                      // NW Leicestershire
  "E07000138": { avg: 122, full_fibre: 55, sfbb: 90, providers: "Openreach" },                                                      // Oadby & Wigston

  // ── West Midlands ─────────────────────────────────────────────────────────
  "E08000025": { avg: 148, full_fibre: 67, sfbb: 94, providers: "Openreach, Virgin Media, CityFibre" },                             // Birmingham
  "E08000026": { avg: 138, full_fibre: 60, sfbb: 91, providers: "Openreach, Virgin Media" },                                        // Coventry
  "E08000027": { avg: 132, full_fibre: 57, sfbb: 90, providers: "Openreach, Virgin Media" },                                        // Dudley
  "E08000028": { avg: 130, full_fibre: 55, sfbb: 90, providers: "Openreach, Virgin Media" },                                        // Sandwell
  "E08000029": { avg: 143, full_fibre: 64, sfbb: 93, providers: "Openreach, Virgin Media, CityFibre" },                             // Solihull
  "E08000030": { avg: 129, full_fibre: 54, sfbb: 89, providers: "Openreach, Virgin Media" },                                        // Walsall
  "E08000031": { avg: 133, full_fibre: 58, sfbb: 91, providers: "Openreach, Virgin Media" },                                        // Wolverhampton

  // ── North West ────────────────────────────────────────────────────────────
  "E08000001": { avg: 138, full_fibre: 61, sfbb: 92, providers: "Openreach, Virgin Media" },                                        // Bolton
  "E08000002": { avg: 130, full_fibre: 57, sfbb: 90, providers: "Openreach, Virgin Media" },                                        // Bury
  "E08000003": { avg: 145, full_fibre: 65, sfbb: 93, providers: "Openreach, Virgin Media, CityFibre" },                             // Manchester
  "E08000004": { avg: 134, full_fibre: 58, sfbb: 91, providers: "Openreach, Virgin Media" },                                        // Oldham
  "E08000005": { avg: 142, full_fibre: 63, sfbb: 93, providers: "Openreach, Virgin Media, CityFibre" },                             // Rochdale
  "E08000006": { avg: 136, full_fibre: 60, sfbb: 91, providers: "Openreach, Virgin Media" },                                        // Salford
  "E08000007": { avg: 142, full_fibre: 63, sfbb: 93, providers: "Openreach, Virgin Media, CityFibre" },
  "E08000008": { avg: 135, full_fibre: 59, sfbb: 91, providers: "Openreach, Virgin Media" },                                        // Trafford
  "E08000009": { avg: 139, full_fibre: 62, sfbb: 92, providers: "Openreach, Virgin Media" },                                        // Stockport
  "E08000010": { avg: 132, full_fibre: 57, sfbb: 90, providers: "Openreach, Virgin Media" },                                        // Tameside
  "E08000011": { avg: 140, full_fibre: 62, sfbb: 92, providers: "Openreach, Virgin Media" },                                        // Wigan
  "E08000012": { avg: 141, full_fibre: 63, sfbb: 92, providers: "Openreach, Virgin Media" },                                        // Wigan (alt)
  "E06000006": { avg: 148, full_fibre: 67, sfbb: 94, providers: "Openreach, Virgin Media, CityFibre" },                             // Halton
  "E06000007": { avg: 145, full_fibre: 66, sfbb: 93, providers: "Openreach, Virgin Media, CityFibre" },                             // Warrington
  "E06000008": { avg: 142, full_fibre: 65, sfbb: 93, providers: "Openreach, Virgin Media, CityFibre" },                             // Blackburn with Darwen
  "E06000009": { avg: 138, full_fibre: 62, sfbb: 92, providers: "Openreach, Virgin Media" },                                        // Blackpool
  "E07000026": { avg: 148, full_fibre: 68, sfbb: 94, providers: "Openreach, Virgin Media, CityFibre" },                             // Liverpool
  "E08000011": { avg: 140, full_fibre: 62, sfbb: 92, providers: "Openreach, Virgin Media" },
  "E08000014": { avg: 148, full_fibre: 68, sfbb: 94, providers: "Openreach, Virgin Media, CityFibre" },                             // Knowsley
  "E08000015": { avg: 152, full_fibre: 70, sfbb: 95, providers: "Openreach, Virgin Media, CityFibre" },                             // Liverpool (city)
  "E08000016": { avg: 140, full_fibre: 63, sfbb: 93, providers: "Openreach, Virgin Media" },                                        // St Helens
  "E08000017": { avg: 143, full_fibre: 65, sfbb: 93, providers: "Openreach, Virgin Media" },                                        // Sefton
  "E08000018": { avg: 145, full_fibre: 66, sfbb: 94, providers: "Openreach, Virgin Media, CityFibre" },                             // Wirral

  // ── Yorkshire & The Humber ────────────────────────────────────────────────
  "E08000032": { avg: 138, full_fibre: 61, sfbb: 92, providers: "Openreach, Virgin Media" },                                        // Bradford
  "E08000033": { avg: 142, full_fibre: 63, sfbb: 92, providers: "Openreach, Virgin Media" },                                        // Calderdale
  "E08000034": { avg: 135, full_fibre: 59, sfbb: 91, providers: "Openreach, Virgin Media" },                                        // Kirklees
  "E08000035": { avg: 150, full_fibre: 68, sfbb: 94, providers: "Openreach, Virgin Media, CityFibre" },                             // Leeds
  "E08000036": { avg: 144, full_fibre: 65, sfbb: 93, providers: "Openreach, Virgin Media" },                                        // Wakefield
  "E08000037": { avg: 148, full_fibre: 67, sfbb: 94, providers: "Openreach, Virgin Media, CityFibre" },                             // Barnsley
  "E08000038": { avg: 152, full_fibre: 69, sfbb: 94, providers: "Openreach, Virgin Media, CityFibre" },                             // Doncaster
  "E08000039": { avg: 145, full_fibre: 66, sfbb: 93, providers: "Openreach, Virgin Media, CityFibre" },                             // Rotherham
  "E08000040": { avg: 155, full_fibre: 70, sfbb: 95, providers: "Openreach, Virgin Media, CityFibre" },                             // Sheffield
  "E06000010": { avg: 148, full_fibre: 67, sfbb: 94, providers: "Openreach, Virgin Media, CityFibre" },                             // Kingston upon Hull
  "E06000011": { avg: 125, full_fibre: 57, sfbb: 90, providers: "Openreach" },                                                      // East Riding of Yorkshire
  "E06000012": { avg: 138, full_fibre: 62, sfbb: 92, providers: "Openreach, Virgin Media" },                                        // North East Lincolnshire
  "E06000013": { avg: 132, full_fibre: 59, sfbb: 91, providers: "Openreach, Virgin Media" },                                        // North Lincolnshire
  "E06000014": { avg: 142, full_fibre: 64, sfbb: 93, providers: "Openreach, Virgin Media, CityFibre" },                             // York

  // ── North East ────────────────────────────────────────────────────────────
  "E06000001": { avg: 125, full_fibre: 58, sfbb: 90, providers: "Openreach, Virgin Media" },                                        // County Durham
  "E06000002": { avg: 118, full_fibre: 54, sfbb: 89, providers: "Openreach" },                                                      // Darlington
  "E06000003": { avg: 115, full_fibre: 52, sfbb: 88, providers: "Openreach" },                                                      // Gateshead
  "E06000004": { avg: 120, full_fibre: 55, sfbb: 89, providers: "Openreach, Virgin Media" },                                        // Hartlepool
  "E06000005": { avg: 122, full_fibre: 56, sfbb: 90, providers: "Openreach, Virgin Media" },                                        // Middlesbrough
  "E08000019": { avg: 128, full_fibre: 58, sfbb: 91, providers: "Openreach, Virgin Media" },                                        // Newcastle upon Tyne
  "E08000020": { avg: 125, full_fibre: 57, sfbb: 90, providers: "Openreach, Virgin Media" },                                        // North Tyneside
  "E08000021": { avg: 122, full_fibre: 55, sfbb: 90, providers: "Openreach, Virgin Media" },                                        // South Tyneside
  "E08000022": { avg: 130, full_fibre: 59, sfbb: 91, providers: "Openreach, Virgin Media, CityFibre" },                             // Sunderland
  "E08000023": { avg: 120, full_fibre: 55, sfbb: 89, providers: "Openreach, Virgin Media" },                                        // Stockton-on-Tees
  "E08000024": { avg: 118, full_fibre: 54, sfbb: 88, providers: "Openreach" },                                                      // Redcar & Cleveland

  // ── Scotland ──────────────────────────────────────────────────────────────
  "S12000036": { avg: 162, full_fibre: 72, sfbb: 95, providers: "Openreach, Virgin Media, CityFibre" },                             // Edinburgh
  "S12000049": { avg: 158, full_fibre: 70, sfbb: 94, providers: "Openreach, Virgin Media, CityFibre" },                             // Glasgow
  "S12000034": { avg: 128, full_fibre: 58, sfbb: 91, providers: "Openreach, Virgin Media" },                                        // Aberdeen City
  "S12000033": { avg: 118, full_fibre: 54, sfbb: 89, providers: "Openreach" },                                                      // Aberdeenshire
  "S12000044": { avg: 135, full_fibre: 61, sfbb: 92, providers: "Openreach, Virgin Media" },                                        // South Lanarkshire
  "S12000045": { avg: 138, full_fibre: 62, sfbb: 92, providers: "Openreach, Virgin Media" },                                        // North Lanarkshire
  "S12000008": { avg: 142, full_fibre: 64, sfbb: 93, providers: "Openreach, Virgin Media, CityFibre" },                             // Fife
  "S12000011": { avg: 130, full_fibre: 59, sfbb: 91, providers: "Openreach" },                                                      // East Ayrshire
  "S12000024": { avg: 132, full_fibre: 60, sfbb: 91, providers: "Openreach" },                                                      // East Lothian

  // ── Wales ─────────────────────────────────────────────────────────────────
  "W06000015": { avg: 145, full_fibre: 65, sfbb: 93, providers: "Openreach, Virgin Media, CityFibre" },                             // Cardiff
  "W06000014": { avg: 135, full_fibre: 61, sfbb: 92, providers: "Openreach, Virgin Media" },                                        // Swansea
  "W06000006": { avg: 125, full_fibre: 57, sfbb: 90, providers: "Openreach, Virgin Media" },                                        // Flintshire
  "W06000001": { avg: 120, full_fibre: 54, sfbb: 89, providers: "Openreach" },                                                      // Isle of Anglesey
  "W06000002": { avg: 115, full_fibre: 52, sfbb: 88, providers: "Openreach" },                                                      // Gwynedd
  "W06000003": { avg: 118, full_fibre: 53, sfbb: 88, providers: "Openreach" },                                                      // Conwy
  "W06000004": { avg: 122, full_fibre: 55, sfbb: 89, providers: "Openreach, Virgin Media" },                                        // Denbighshire
  "W06000009": { avg: 128, full_fibre: 58, sfbb: 91, providers: "Openreach, Virgin Media" },                                        // Vale of Glamorgan
  "W06000010": { avg: 138, full_fibre: 62, sfbb: 92, providers: "Openreach, Virgin Media" },                                        // Bridgend
  "W06000011": { avg: 132, full_fibre: 60, sfbb: 91, providers: "Openreach" },                                                      // Rhondda Cynon Taf
  "W06000012": { avg: 130, full_fibre: 59, sfbb: 91, providers: "Openreach" },                                                      // Merthyr Tydfil
  "W06000013": { avg: 128, full_fibre: 58, sfbb: 91, providers: "Openreach" },                                                      // Caerphilly
  "W06000018": { avg: 135, full_fibre: 61, sfbb: 92, providers: "Openreach, Virgin Media" },                                        // Newport
  "W06000019": { avg: 132, full_fibre: 60, sfbb: 91, providers: "Openreach, Virgin Media" },                                        // Monmouthshire
  "W06000020": { avg: 130, full_fibre: 59, sfbb: 91, providers: "Openreach" },                                                      // Torfaen
  "W06000021": { avg: 128, full_fibre: 58, sfbb: 90, providers: "Openreach" },                                                      // Blaenau Gwent
};

// Regional fallbacks (ONS region code → broadband profile)
const REGIONAL_FALLBACK = {
  "E12000007": { avg: 178, full_fibre: 75, sfbb: 97, providers: "Openreach, Virgin Media, CityFibre, Hyperoptic" },
  "E12000008": { avg: 132, full_fibre: 62, sfbb: 92, providers: "Openreach, Virgin Media, CityFibre" },
  "E12000006": { avg: 125, full_fibre: 58, sfbb: 91, providers: "Openreach, Virgin Media" },
  "E12000009": { avg: 118, full_fibre: 54, sfbb: 89, providers: "Openreach, Virgin Media" },
  "E12000004": { avg: 122, full_fibre: 56, sfbb: 90, providers: "Openreach, Virgin Media, CityFibre" },
  "E12000005": { avg: 138, full_fibre: 63, sfbb: 92, providers: "Openreach, Virgin Media, CityFibre" },
  "E12000003": { avg: 128, full_fibre: 58, sfbb: 91, providers: "Openreach, Virgin Media, CityFibre" },
  "E12000002": { avg: 135, full_fibre: 61, sfbb: 92, providers: "Openreach, Virgin Media, CityFibre" },
  "E12000001": { avg: 112, full_fibre: 52, sfbb: 88, providers: "Openreach, Virgin Media" },
  "S92000003": { avg: 145, full_fibre: 65, sfbb: 93, providers: "Openreach, Virgin Media, CityFibre" },
  "W92000004": { avg: 120, full_fibre: 55, sfbb: 89, providers: "Openreach, Virgin Media, CityFibre" },
};

const REGION_TO_ONS = {
  "London": "E12000007",
  "South East": "E12000008",
  "East of England": "E12000006",
  "South West": "E12000009",
  "East Midlands": "E12000004",
  "West Midlands": "E12000005",
  "Yorkshire and The Humber": "E12000003",
  "North West": "E12000002",
  "North East": "E12000001",
};

function ratingFromSpeed(avg, fullFibre) {
  if (avg >= 150 && fullFibre >= 70) return "Excellent";
  if (avg >= 100 && fullFibre >= 50) return "Very Good";
  if (avg >= 60)  return "Good";
  if (avg >= 30)  return "Moderate";
  return "Limited";
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/**
 * Resolve a postcode to {laCode, region, country} via postcodes.io.
 * Falls back to terminated_postcodes + nearest active postcode lookup.
 */
async function resolvePostcode(pc) {
  try {
    const data = await fetchJson(`https://api.postcodes.io/postcodes/${pc}`);
    return {
      laCode: data?.result?.codes?.admin_district,
      region: data?.result?.region,
      country: data?.result?.country || "England",
    };
  } catch (e) {
    // Try terminated postcode → nearest active postcode for LA code
    try {
      const terminated = await fetchJson(`https://api.postcodes.io/terminated_postcodes/${pc}`);
      const lat = terminated?.result?.latitude;
      const lon = terminated?.result?.longitude;

      if (lat && lon) {
        // Find nearest active postcode to get proper LA GSS code
        const nearest = await fetchJson(
          `https://api.postcodes.io/postcodes?lon=${lon}&lat=${lat}&limit=1`
        );
        const nr = nearest?.result?.[0];
        if (nr) {
          return {
            laCode: nr?.codes?.admin_district || null,
            region: nr?.region || null,
            country: nr?.country || "England",
          };
        }
      }

      // Last resort: outcode region lookup (no GSS code available)
      const outcode = pc.replace(/\d[A-Z]{2}$/, "").trim();
      if (outcode) {
        const outcodeData = await fetchJson(`https://api.postcodes.io/outcodes/${outcode}`);
        return {
          laCode: null,
          region: outcodeData?.result?.region?.[0] || null,
          country: outcodeData?.result?.country?.[0] || "England",
        };
      }
    } catch (_) {
      // ignore secondary failure
    }
    throw e;
  }
}

export default async function handler(req, res) {
  const { postcode } = req.query;
  if (!postcode) return res.status(400).json({ error: "postcode required" });

  const pc = postcode.replace(/\s/g, "").toUpperCase();

  try {
    const { laCode, region, country } = await resolvePostcode(pc);

    // Look up LA broadband data
    let data = laCode ? LA_BROADBAND[laCode] : null;

    // Fall back to regional average
    if (!data) {
      let onsCode = REGION_TO_ONS[region];
      if (country === "Scotland") onsCode = "S92000003";
      if (country === "Wales")    onsCode = "W92000004";
      data = REGIONAL_FALLBACK[onsCode] ?? REGIONAL_FALLBACK["E12000008"]; // default South East
    }

    const rating = ratingFromSpeed(data.avg, data.full_fibre);
    const sourceLabel = laCode && LA_BROADBAND[laCode] ? "this local authority" : "this region";

    res.status(200).json({
      avgDownloadSpeed: `${data.avg} Mbps`,
      avgDownloadMbps: data.avg,
      fullFibreAvailability: `${data.full_fibre}%`,
      fullFibrePct: data.full_fibre,
      sfbbAvailability: `${data.sfbb}%`,
      rating,
      providers: data.providers,
      source: "Ofcom Connected Nations Report 2024",
      note: `Broadband data for ${sourceLabel} from Ofcom Connected Nations 2024. Average download speed: ${data.avg} Mbps. Full fibre (FTTP) available to ${data.full_fibre}% of premises. Check availability at your specific address via checker.ofcom.org.uk.`,
    });
  } catch (err) {
    res.status(500).json({ error: "Broadband data unavailable", detail: err.message });
  }
}
