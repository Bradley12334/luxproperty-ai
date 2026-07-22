/**
 * lib/brief/planning.js
 * ─────────────────────────────────────────────────────────────────────────────
 * PLANNING DESIGNATIONS FETCHER — real, national, point-in-polygon.
 *
 * Source: MHCLG Planning Data platform (planning.data.gov.uk), the official open
 * planning dataset. ONE entity.json call returns every designation whose polygon
 * CONTAINS the validated coordinates, across the datasets we ask for — so it is a
 * single ~1s HTTP round-trip, run concurrently with the Land Registry scan (≈0 added
 * wall-clock). Best-effort: its own AbortSignal timeout, never throws.
 *
 * WHY NOT A "PLANNING APPLICATIONS COUNT": there is no free national feed of live
 * planning applications. The old /api/planning-activity tried an INSPIRE WFS host
 * that is now dead (DNS failure) and, on failure, fabricated a count from a hash of
 * the outcode — that fake number is dropped entirely. What planning.data.gov.uk DOES
 * provide, nationally and honestly, is the planning CONSTRAINTS at a point; that is
 * what this returns, with the source, the granularity, and each designation's date.
 * For live applications the section links out to the council's own portal.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const PLANNING_DATA = "https://www.planning.data.gov.uk/entity.json";

// Datasets queried at the point. Order = display priority. Each carries a buyer-facing
// label and a one-line "what it means", so a designation is never a bare name.
export const DESIGNATION_DATASETS = [
  { dataset: "listed-building-outline", label: "Listed building", meaning: "The building itself is statutorily listed — alterations, extensions and even some repairs need listed-building consent, and works can be costly and slow to approve." },
  { dataset: "conservation-area", label: "Conservation area", meaning: "Extra controls on alterations, demolition, materials and tree work to preserve the area's character; permitted-development rights are narrower than normal." },
  { dataset: "article-4-direction-area", label: "Article 4 direction", meaning: "Specific permitted-development rights have been withdrawn here, so changes that would normally be automatic (e.g. some extensions, changes of use) need a full planning application." },
  { dataset: "scheduled-monument", label: "Scheduled monument", meaning: "A nationally important archaeological site — scheduled-monument consent is required for most works affecting it." },
  { dataset: "world-heritage-site", label: "World Heritage Site", meaning: "Designated for outstanding heritage value; development in and around it faces heightened scrutiny." },
  { dataset: "tree-preservation-zone", label: "Tree preservation order (area)", meaning: "Trees here are protected — cutting, topping or removal needs council consent, and unauthorised work is an offence." },
  { dataset: "area-of-outstanding-natural-beauty", label: "Area of Outstanding Natural Beauty", meaning: "A protected landscape — development is tightly constrained to conserve natural beauty." },
  { dataset: "national-park", label: "National Park", meaning: "The strictest tier of landscape protection; the National Park Authority is the planning authority and development is heavily restricted." },
  { dataset: "green-belt", label: "Green Belt", meaning: "Strong policy presumption against new development to keep land open — extensions and new build face significant constraints." },
];

const DATASET_META = Object.fromEntries(DESIGNATION_DATASETS.map((d) => [d.dataset, d]));

// Curated council planning-portal link-outs (verified URLs). Keyed by billing/local
// authority name (upper-cased). Not exhaustive — a miss falls back to the Planning
// Portal's "find your local authority" search, which is honest and national.
const COUNCIL_PORTALS = {
  "CAMDEN": "https://www.camden.gov.uk/planning-applications",
  "CITY OF WESTMINSTER": "https://www.westminster.gov.uk/planning-and-building-control",
  "WESTMINSTER": "https://www.westminster.gov.uk/planning-and-building-control",
  "ISLINGTON": "https://www.islington.gov.uk/planning/planning-applications",
  "LAMBETH": "https://www.lambeth.gov.uk/planning-and-building-control/planning-applications",
  "SOUTHWARK": "https://www.southwark.gov.uk/planning-and-building-control/planning-applications",
  "HACKNEY": "https://hackney.gov.uk/planning",
  "TOWER HAMLETS": "https://www.towerhamlets.gov.uk/lgnl/planning_and_building_control",
  "WANDSWORTH": "https://www.wandsworth.gov.uk/planning",
  "LEWISHAM": "https://lewisham.gov.uk/myservices/planning",
  "GREENWICH": "https://www.royalgreenwich.gov.uk/planning",
  "HARINGEY": "https://www.haringey.gov.uk/planning-and-building-control",
  "HAMMERSMITH AND FULHAM": "https://www.lbhf.gov.uk/planning",
  "KENSINGTON AND CHELSEA": "https://www.rbkc.gov.uk/planning",
  "EALING": "https://www.ealing.gov.uk/info/201048/planning_applications",
  "BRENT": "https://www.brent.gov.uk/services-for-residents/planning-and-building-control",
  "BARNET": "https://www.barnet.gov.uk/planning-and-building",
  "ENFIELD": "https://www.enfield.gov.uk/services/planning",
  "WALTHAM FOREST": "https://www.walthamforest.gov.uk/planning",
  "NEWHAM": "https://www.newham.gov.uk/planning-building-control",
  "REDBRIDGE": "https://www.redbridge.gov.uk/planning",
  "HARROW": "https://www.harrow.gov.uk/planning",
  "HILLINGDON": "https://www.hillingdon.gov.uk/planning",
  "HOUNSLOW": "https://www.hounslow.gov.uk/info/20006/planning",
  "RICHMOND UPON THAMES": "https://www.richmond.gov.uk/services/planning",
  "KINGSTON UPON THAMES": "https://www.kingston.gov.uk/planning",
  "MERTON": "https://www.merton.gov.uk/planning",
  "CROYDON": "https://www.croydon.gov.uk/planning-and-regeneration",
  "BROMLEY": "https://www.bromley.gov.uk/planning",
  "BEXLEY": "https://www.bexley.gov.uk/services/planning-and-development",
  "SUTTON": "https://www.sutton.gov.uk/info/200397/planning",
  "READING": "https://www.reading.gov.uk/planning",
  "OXFORD": "https://www.oxford.gov.uk/planning",
  "MANCHESTER": "https://www.manchester.gov.uk/planning",
  "BIRMINGHAM": "https://www.birmingham.gov.uk/planning",
  "LEEDS": "https://www.leeds.gov.uk/planning",
  "SHEFFIELD": "https://www.sheffield.gov.uk/planning",
  "BRISTOL": "https://www.bristol.gov.uk/planning",
  "CITY OF BRISTOL": "https://www.bristol.gov.uk/planning",
  "LIVERPOOL": "https://www.liverpool.gov.uk/planning",
  "NEWCASTLE UPON TYNE": "https://www.newcastle.gov.uk/planning",
  "NOTTINGHAM": "https://www.nottinghamcity.gov.uk/planning",
  "COVENTRY": "https://www.coventry.gov.uk/planning",
  "LEICESTER": "https://www.leicester.gov.uk/planning",
};
const PORTAL_FALLBACK = "https://www.planningportal.co.uk/services/local-planning-authorities";

/**
 * Resolve a council planning-portal URL for a local authority, or a national fallback.
 * @param {string} localAuthority
 * @returns {{ url:string, curated:boolean }}
 */
export function councilPortal(localAuthority) {
  const key = String(localAuthority || "").toUpperCase().trim();
  if (COUNCIL_PORTALS[key]) return { url: COUNCIL_PORTALS[key], curated: true };
  for (const [k, v] of Object.entries(COUNCIL_PORTALS)) {
    if (key && (key.includes(k) || k.includes(key))) return { url: v, curated: true };
  }
  return { url: PORTAL_FALLBACK, curated: false };
}

/**
 * Fetch planning designations at the validated coordinates. Never throws.
 * @param {import("./resolve.js").ResolvedLocation} location
 * @param {{ signal?: AbortSignal, timeoutMs?: number }} [opts]
 * @returns {Promise<{ ok:boolean, data:{ designations:Array, lpaName:string|null }|null }>}
 */
export async function fetchPlanning(location, opts = {}) {
  const lat = Number(location?.lat);
  const lng = Number(location?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return { ok: false, data: null };

  // District-wide (bare outcode) uses the centroid: point-in-polygon still works, but a
  // single centroid can't represent designations across a whole district, so we flag it.
  const params = new URLSearchParams();
  for (const d of DESIGNATION_DATASETS) params.append("dataset", d.dataset);
  params.append("dataset", "local-planning-authority");
  params.append("longitude", String(lng));
  params.append("latitude", String(lat));
  params.append("limit", "50");

  const timeoutMs = opts.timeoutMs ?? 7000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const signal = opts.signal
    ? anySignal([opts.signal, controller.signal])
    : controller.signal;

  let json = null;
  try {
    const res = await fetch(`${PLANNING_DATA}?${params.toString()}`, { headers: { Accept: "application/json" }, signal });
    if (!res.ok) return { ok: false, data: null };
    json = await res.json();
  } catch {
    return { ok: false, data: null };
  } finally {
    clearTimeout(timer);
  }

  const entities = Array.isArray(json?.entities) ? json.entities : [];
  let lpaName = null;
  const designations = [];
  for (const e of entities) {
    if (e.dataset === "local-planning-authority") {
      lpaName = e.name || lpaName;
      continue;
    }
    const meta = DATASET_META[e.dataset];
    if (!meta) continue;
    designations.push({
      dataset: e.dataset,
      label: meta.label,
      meaning: meta.meaning,
      name: e.name || meta.label,
      reference: e.reference || null,
      date: e["designation-date"] || e["start-date"] || null,
      documentUrl: e["document-url"] || null,
    });
  }
  // Stable display order by dataset priority.
  const order = new Map(DESIGNATION_DATASETS.map((d, i) => [d.dataset, i]));
  designations.sort((a, b) => (order.get(a.dataset) ?? 99) - (order.get(b.dataset) ?? 99));

  return { ok: true, data: { designations, lpaName } };
}

/** Combine abort signals (Node 18 lacks AbortSignal.any in some runtimes). */
function anySignal(signals) {
  const controller = new AbortController();
  for (const s of signals) {
    if (s.aborted) { controller.abort(); break; }
    s.addEventListener("abort", () => controller.abort(), { once: true });
  }
  return controller.signal;
}
