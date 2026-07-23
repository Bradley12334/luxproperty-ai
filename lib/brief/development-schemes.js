/**
 * lib/brief/development-schemes.js
 * ─────────────────────────────────────────────────────────────────────────────
 * CURATED DEVELOPMENT SCHEMES — hand-curated major local development/regeneration
 * schemes for a small set of districts where curation genuinely exists. This is NOT
 * a live planning feed and NOT nationwide: there is no free national applications
 * feed to derive schemes from (see lib/brief/planning.js), so this is editorial
 * curation, compiled and last verified through 2025, and labelled as such wherever
 * it renders. Each scheme carries its own status/timeline text.
 *
 * For every district NOT listed here, the Development Tracker says plainly that no
 * tracked major schemes are curated for the area and links to the council portal —
 * never an invented scheme, never London content leaking into a non-London brief
 * (entries are keyed by outcode). Scotland/NI never reach this stage.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** Editorial as-of for every scheme below. */
export const SCHEMES_AS_OF = "2025";

/** @type {Record<string, Array<{name:string,type:string,status:string,impact:'Positive'|'Neutral'|'Monitor',detail:string}>>} */
export const DEVELOPMENT_SCHEMES = {
  B1: [
    {"name":"HS2 Curzon Street Station","type":"Transport","status":"Under construction (~2033 opening)","impact":"Positive","detail":"High Speed 2's Birmingham terminus — ~52 minutes to London Euston on opening. Within 1km of B1's eastern boundary. The single most significant value driver for B1 and B4 properties in the medium term."},
    {"name":"Digbeth East Side City","type":"Mixed-use","status":"Masterplan approved, phased delivery","impact":"Positive","detail":"Birmingham City Council's 5,000+ home masterplan for Digbeth, immediately east of B1. Major cultural, commercial, and residential investment will transform the B1 eastern fringe."}
  ],
  BS1: [
    {"name":"University of Bristol Temple Quarter Campus","type":"Education/Commercial","status":"Under construction, opening 2025","impact":"Positive","detail":"UoB's £300m new campus adjacent to Temple Meads will bring 10,000 students and staff to the BS1 border. Structural demand driver for BS1 residential rental and owner-occupier values."},
    {"name":"Finzel's Reach Phase 2","type":"Residential","status":"Completing 2025","impact":"Neutral","detail":"240 additional residential units on the Finzel's Reach site. Adds quality supply to the BS1 market — monitor for any short-term softening on equivalent new-build product."}
  ],
  CB1: [
    {"name":"Cambridge Cancer Research Hospital","type":"Education/Healthcare","status":"Under construction, opening ~2027","impact":"Positive","detail":"£300m+ Cancer Research UK hospital on the Biomedical Campus — will bring additional high-salary medical researchers and clinicians to CB1's catchment. Structural demand positive for CB1/CB2 residential values."},
    {"name":"East West Rail","type":"Transport","status":"Under construction (Oxford-Cambridge delivery 2030s)","impact":"Positive","detail":"East West Rail's Cambridge–Oxford corridor will open a new buyer segment and dramatically improve Cambridge's connectivity. Structural positive for CB1 — adds London buyers commuting from Cambridge as a realistic option."}
  ],
  E1: [
    {"name":"Whitechapel Masterplan","type":"Mixed-use","status":"Planning approved, phased delivery 2024–2035","impact":"Positive","detail":"Tower Hamlets' major masterplan for Whitechapel — 5,000+ homes, a new library, public spaces, and commercial around the Elizabeth line station. Long-term transformative for E1 status and values."},
    {"name":"Truman Brewery Development","type":"Mixed-use","status":"Contended — community opposition ongoing","impact":"Monitor","detail":"Developer plans for commercial/retail expansion of the Truman Brewery site on Brick Lane continue to face community opposition. Planning outcome uncertain. Monitor closely for E1/Spitalfields character implications."}
  ],
  E14: [
    {"name":"Canary Wharf Group — Wood Wharf","type":"Mixed-use","status":"Under construction","impact":"Positive","detail":"3,600 homes, offices, and retail across 23 acres adjacent to Canary Wharf. Completion expected 2027."},
    {"name":"Asda Crossharbour Redevelopment","type":"Mixed-use","status":"Planning approved","impact":"Positive","detail":"Asda store plus 1,900 new homes and commercial space. LBTH approved 2023."}
  ],
  E20: [
    {"name":"Olympic/Stratford Legacy Developments","type":"Mixed-use","status":"Under construction","impact":"Positive","detail":"Continued build-out of East Bank cultural quarter and Chobham Manor/East Wick residential phases."}
  ],
  E8: [
    {"name":"London Fields Lido","type":"Leisure","status":"Refurbishment complete (2024)","impact":"Positive","detail":"Hackney Council's £5m refurbishment of the E8 Lido is complete. The Lido is a significant value driver for London Fields-adjacent properties — its reopening has been positively received."},
    {"name":"Hackney Walk Expansion","type":"Commercial","status":"Planning approved","impact":"Positive","detail":"Expansion of Hackney Walk designer outlet on Mare Street strengthens E8's retail and destination offer. Net positive for commercial vitality and residential values on the E8/E9 corridor."}
  ],
  EC1: [
    {"name":"Barbican Estate Refurbishment","type":"Residential","status":"Long-term programme, City of London","impact":"Positive","detail":"City of London's commitment to maintaining and improving the Barbican Estate — one of London's most significant post-war residential complexes. Ongoing investment protects values in EC2/EC1 adjacent."},
    {"name":"Farringdon East Office-to-Residential","type":"Residential","status":"Multiple schemes approved","impact":"Positive","detail":"Several office-to-residential PD conversions approved in EC1M/EC1V — adding high-quality loft residential stock to the postcode. Net positive for the area's residential character and demand depth."}
  ],
  LS1: [
    {"name":"South Bank Masterplan","type":"Mixed-use","status":"Long-term delivery (10–15 years)","impact":"Positive","detail":"60+ acres of brownfield land immediately south of Leeds station — 8,000 homes, 35,000 jobs, the new Channel 4 national headquarters. Largest regeneration scheme in northern England. Buy adjacent properties now."},
    {"name":"West Yorkshire Mass Transit","type":"Transport","status":"Approval expected 2026–2028","impact":"Positive","detail":"The long-awaited West Yorkshire tram network — if approved, would transform LS1 and suburban Leeds connectivity. A major structural positive for all Leeds city-centre values. Monitor the West Yorkshire Combined Authority consultation."}
  ],
  M1: [
    {"name":"NOMA Masterplan","type":"Mixed-use","status":"Ongoing (20+ acres, 10+ year delivery)","impact":"Positive","detail":"The Co-operative Group's major city-centre masterplan — offices, residential, retail, public space on the north M1 border. Structural positive for M1 and adjacent M4 values as the area matures."},
    {"name":"St Michael's Quarter","type":"Mixed-use","status":"Planning approved","impact":"Positive","detail":"High-profile mixed-use development including hotel, residential, and public space on the Peter Street/Bootle Street site. Adds premium residential supply and further activates M1's western edge."}
  ],
  N1: [
    {"name":"Angel Central","type":"Commercial","status":"Refurbishment ongoing","impact":"Positive","detail":"Ongoing improvement to the Angel Central retail destination strengthens N1's amenity offer — net positive for adjacent residential values."},
    {"name":"King's Cross Ripple Effect","type":"Residential/Commercial","status":"Ongoing","impact":"Positive","detail":"The King's Cross regeneration continues to push values northward into N1's southern border (EC1/N1 transition zone). Properties on the Caledonian Road corridor are benefiting from progressive gentrification."}
  ],
  NW1: [
    {"name":"Euston HS2 Station","type":"Transport","status":"Under construction (2026–2032)","impact":"Monitor","detail":"Major construction phase for HS2's Euston terminus will cause significant noise, traffic, and disruption within ~500m. Longer-term (post-2033), a new major terminus would be a structural positive for NW1 values. Monitor closely if considering NW1 2 properties."},
    {"name":"Google DeepMind King's Cross Campus","type":"Commercial","status":"Complete (2024)","impact":"Positive","detail":"Google DeepMind's consolidated London HQ at King's Cross brings 7,000+ high-salary employees to NW1's doorstep. Structural demand driver for NW1 9 and adjacent NW1 2 residential values."}
  ],
  NW10: [
    {"name":"Old Oak Common Interchange (HS2/Elizabeth Line)","type":"Transport","status":"Under construction","impact":"Monitor","detail":"New super-hub station connecting HS2, Elizabeth Line, and Overground. Massive regeneration zone."}
  ],
  NW3: [
    {"name":"Swiss Cottage Leisure Centre","type":"Commercial","status":"Refurbishment ongoing","impact":"Positive","detail":"Camden's major refurbishment of Swiss Cottage Leisure Centre (NW3 south). Improves local amenity — net positive for NW3 values on the Belsize Park/Swiss Cottage border."},
    {"name":"Hampstead Heath Management Plan","type":"Green Space","status":"Ongoing (City of London)","impact":"Positive","detail":"City of London's rolling Heath management improvements — paths, ponds, woodland management. The Heath's quality is a fundamental driver of NW3 values and is actively maintained."}
  ],
  OX1: [
    {"name":"East West Rail (Oxford Phase)","type":"Transport","status":"Under construction","impact":"Positive","detail":"East West Rail's Oxford–Milton Keynes–Cambridge corridor will significantly improve OX1's connectivity to Cambridge's knowledge economy. Structural demand positive — opens a new buyer segment from the Oxford-Cambridge arc."},
    {"name":"Oxford Station Masterplan","type":"Mixed-use/Transport","status":"Planning approved","impact":"Positive","detail":"Network Rail and Oxford City Council's approved masterplan for Oxford station — improved interchange, public realm, and mixed-use development. Strengthens OX1's arrival experience and connectivity."}
  ],
  RG1: [
    {"name":"Station Hill","type":"Mixed-use/Residential","status":"Delivering from 2024 (1,500 homes)","impact":"Monitor","detail":"Major new residential development adjacent to Reading station — 1,500 homes, retail, office. High-quality addition to RG1 but adds new-build supply. Period terraces in the conservation area are insulated from this supply pressure."},
    {"name":"Reading Prison Conversion","type":"Residential","status":"Planning approved","impact":"Positive","detail":"The Grade I-listed former HM Prison Reading (Oscar Wilde's incarceration site) is approved for residential conversion. Unique heritage apartments on Forbury Road — will command significant premium on completion."}
  ],
  SE1: [
    {"name":"Bankside Yards","type":"Mixed-use","status":"Planning approved, delivering 2025–2030","impact":"Positive","detail":"Major mixed-use scheme on the South Bank (former Network Rail depot) — residential, office, cultural space, public riverside. Long-term positive for SE1 SE cultural offer and connectivity."},
    {"name":"Elephant Park","type":"Residential","status":"Under construction (completing ~2030)","impact":"Monitor","detail":"3,000-home Lendlease regeneration scheme. Significant new supply in SE1 7 and SE17 — monitor for impact on new-build SE1 flat values. The overall masterplan is positive for SE1 long-term."}
  ],
  SW1: [
    {"name":"1 Palace Street SW1E","type":"Residential","status":"Complete (2024)","impact":"Positive","detail":"72 luxury units converted from former Crown Estate offices. Added high-quality supply without materially impacting values — absorbed by international buyer demand."},
    {"name":"Victoria Crossrail Place (Proposed)","type":"Transport","status":"Under review","impact":"Positive","detail":"Speculative long-term proposal to add Victoria to the Elizabeth line network. No confirmed planning — monitor only."},
    {"name":"Pimlico Road Streetscape","type":"Commercial","status":"Planning approved 2024","impact":"Positive","detail":"Westminster Council improvements to Pimlico Road public realm — wider pavements, cycle lanes, improved lighting. Enhances the Belgravia/Pimlico character street."}
  ],
  SW11: [
    {"name":"Battersea Power Station Phase 4","type":"Mixed-use","status":"Under construction","impact":"Positive","detail":"Additional residential and retail phases at Battersea Power Station complex."}
  ],
  SW3: [
    {"name":"Lots Road Power Station","type":"Mixed-use","status":"Under construction (completing 2025–26)","impact":"Positive","detail":"740 residential units, retail, and community space on the former power station site at the SW3/SW10 border. Adds supply to Chelsea World's End — watch for any short-term softening in the SW10 overlap zone."},
    {"name":"Royal Brompton Hospital Site","type":"Residential","status":"Proposed (long-term)","impact":"Positive","detail":"NHS England's long-term plan to consolidate heart and lung services may release the Royal Brompton site on Fulham Road for residential development. Timeline uncertain — 5+ years."}
  ],
  SW8: [
    {"name":"Nine Elms / Battersea Power Station","type":"Mixed-use","status":"Under construction","impact":"Positive","detail":"20,000 new homes across the Nine Elms Opportunity Area. Northern Line extension operational."}
  ],
  W1: [
    {"name":"Oxford Street Pedestrianisation","type":"Transport/Public Realm","status":"Phased delivery 2025–2030","impact":"Positive","detail":"Westminster's plan to pedestrianise Oxford Street and create a major public realm improvement. If delivered, would materially lift residential values on adjoining streets — particularly W1C and W1U sub-sectors."},
    {"name":"Soho Place","type":"Commercial/Cultural","status":"Complete (2024)","impact":"Positive","detail":"New Apollo Theatre above Tottenham Court Road Elizabeth line entrance. Enhances Soho's cultural offer and footfall — net positive for W1D residential values."}
  ],
  W11: [
    {"name":"Notting Hill Gate Junction Improvements","type":"Transport","status":"Approved 2024","impact":"Positive","detail":"TfL scheme to improve cycling and pedestrian access at the Notting Hill Gate junction. Minor construction disruption during delivery — positive long-term public realm outcome."},
    {"name":"Portobello Village Public Realm","type":"Commercial","status":"Ongoing","impact":"Positive","detail":"RBKC incremental improvements to Portobello Road's public realm — repaving, lighting, market infrastructure. Strengthens the area's character and the premium buyers pay for it."}
  ],
  W8: [
    {"name":"Kensington Forum Hotel Extension","type":"Commercial","status":"Under construction","impact":"Neutral","detail":"Large hotel refurbishment on Cromwell Road. Construction noise/traffic on the W8/SW7 border during build phase — not expected to impact residential values post-completion."},
    {"name":"Holland Park School Expansion","type":"Commercial","status":"Planning approved","impact":"Positive","detail":"RBKC-approved expansion of Holland Park School (Outstanding Ofsted) — increases capacity and strengthens the school premium that underpins W8 residential values."}
  ],
};

/**
 * Curated schemes for a district, or null if none are curated.
 * @param {string} outcode
 * @returns {{ schemes:Array, asOf:string }|null}
 */
export function developmentSchemesFor(outcode) {
  const schemes = DEVELOPMENT_SCHEMES[String(outcode || '').toUpperCase()];
  return schemes && schemes.length ? { schemes, asOf: SCHEMES_AS_OF } : null;
}
