// HS2 Phase 1 & Phase 2a — affected postcode areas
// Source: HS2 Ltd route maps and Stop HS2 affected areas documentation
// Covers areas within ~2km of the confirmed route

export interface InfrastructureFlag {
  name: string;
  type: "HS2" | "Crossrail" | "LLDC" | "Freeport" | "Development";
  impact: "Positive" | "Disruptive" | "Mixed";
  detail: string;
  phaseOrStatus: string;
}

// Outcodes near confirmed HS2 Phase 1 route (London–Birmingham corridor)
const HS2_AFFECTED_OUTCODES: Record<string, InfrastructureFlag> = {
  // London — Old Oak Common / Euston
  "NW10": { name: "HS2 Old Oak Common Interchange", type: "HS2", impact: "Mixed",
    detail: "Old Oak Common is the primary HS2 London interchange. Major regeneration zone but sustained construction disruption until mid-2030s.",
    phaseOrStatus: "Phase 1 — Under construction" },
  "W3": { name: "HS2 Old Oak Common Zone", type: "HS2", impact: "Mixed",
    detail: "Adjacent to Old Oak Common HS2 terminal. Significant construction activity and regeneration investment.",
    phaseOrStatus: "Phase 1 — Under construction" },
  "NW1": { name: "HS2 Euston Terminus", type: "HS2", impact: "Mixed",
    detail: "Euston HS2 terminus construction ongoing. Disruption to roads and local businesses in the short term; significant uplift expected post-completion.",
    phaseOrStatus: "Phase 1 — Under construction" },
  // Chiltern / Hertfordshire
  "HP7": { name: "HS2 Chiltern Tunnel Zone", type: "HS2", impact: "Disruptive",
    detail: "Chiltern tunnel construction zone. Properties within 200m may experience vibration and construction noise.",
    phaseOrStatus: "Phase 1 — Under construction" },
  "HP14": { name: "HS2 Route Proximity", type: "HS2", impact: "Disruptive",
    detail: "Within proximity of HS2 Phase 1 route. Check HS2 Ltd safeguarding maps for individual property impact.",
    phaseOrStatus: "Phase 1 — Under construction" },
  // Birmingham
  "B1": { name: "HS2 Birmingham Curzon Street", type: "HS2", impact: "Positive",
    detail: "Birmingham Curzon Street terminus will transform city centre connectivity. Significant regeneration investment in surrounding area.",
    phaseOrStatus: "Phase 1 — Under construction" },
  "B5": { name: "HS2 Birmingham Zone", type: "HS2", impact: "Positive",
    detail: "Adjacent to Curzon Street HS2 terminus. Strong regeneration potential.",
    phaseOrStatus: "Phase 1 — Under construction" },
  "B6": { name: "HS2 Phase 1 Corridor", type: "HS2", impact: "Mixed",
    detail: "On HS2 Phase 1 corridor north of Birmingham. Check HS2 safeguarding for individual addresses.",
    phaseOrStatus: "Phase 1 — Under construction" },
  // Phase 2a — Birmingham to Crewe (paused but safeguarded)
  "ST7": { name: "HS2 Phase 2a Safeguarded Route", type: "HS2", impact: "Disruptive",
    detail: "Within HS2 Phase 2a safeguarded corridor. Phase 2a is paused but safeguarding remains in place, which can affect planning applications.",
    phaseOrStatus: "Phase 2a — Paused / Safeguarded" },
  "CW2": { name: "HS2 Crewe Hub Area", type: "HS2", impact: "Positive",
    detail: "Near proposed HS2 Crewe Hub station (Phase 2a). If Phase 2a proceeds, strong uplift potential.",
    phaseOrStatus: "Phase 2a — Paused / Safeguarded" },
  // Crossrail / Elizabeth Line
  "SL6": { name: "Crossrail / Elizabeth Line", type: "Crossrail", impact: "Positive",
    detail: "Maidenhead serves the Elizabeth Line, significantly improving London commute times.",
    phaseOrStatus: "Live — Operational" },
  "SL1": { name: "Crossrail / Elizabeth Line", type: "Crossrail", impact: "Positive",
    detail: "Slough serves the Elizabeth Line.",
    phaseOrStatus: "Live — Operational" },
  "UB1": { name: "Crossrail / Elizabeth Line", type: "Crossrail", impact: "Positive",
    detail: "Southall and Hayes serve the Elizabeth Line.",
    phaseOrStatus: "Live — Operational" },
  "UB3": { name: "Crossrail / Elizabeth Line", type: "Crossrail", impact: "Positive",
    detail: "Hayes & Harlington serves the Elizabeth Line.",
    phaseOrStatus: "Live — Operational" },
};

export function getInfrastructureFlags(postcode: string): InfrastructureFlag[] {
  const outcode = postcode.trim().toUpperCase().split(" ")[0].replace(/\d[A-Z]{2}$/, "").trim();
  const flags: InfrastructureFlag[] = [];
  if (HS2_AFFECTED_OUTCODES[outcode]) {
    flags.push(HS2_AFFECTED_OUTCODES[outcode]);
  }
  return flags;
}
