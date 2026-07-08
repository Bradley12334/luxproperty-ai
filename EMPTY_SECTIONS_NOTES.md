# Empty-section handling — conservative redo

The first attempt (commit d1b94b01) over-hid: it added a whole-section hide for Local
Amenities and rewrote Rental Demand, which risked removing populated sections. That
commit was **reverted in full**, restoring every section to its prior behaviour.

Re-applied ONLY changes that cannot hide a populated section:

1. **"…is loading" captions → honest copy** (`mockEngine.ts`, Lifestyle Fit fallbacks).
   Text change only — never hides anything. Generation is complete at render time, so
   "data is loading" was simply false. Fixes the flagship "Green space data is loading…".
2. **Air-quality reading tiles** (`brief.tsx`, screen + PDF). Hides an individual NO₂/PM2.5
   tile ONLY when its literal value is empty/"No data"/"—" (regex `^(no data|—|n/a|)$`).
   It cannot hide a real reading, and cannot hide the section (Rating always stays).

Explicitly NOT done this round (would need live verification against SW3/Stockwell,
which isn't possible in this environment): any whole-section hide for Overpass-backed
sections (schools, amenities, stations). Those keep their PRE-EXISTING `length > 0`
guards, unchanged by this work.

## Important: why "empty array" is not a safe hide signal here
Schools/amenities/stations come from Overpass, which is flaky (rate-limits/timeouts). An
empty array can mean "the source failed this time", not "this postcode has none". The
existing `length > 0` guards already hide these when empty — so a transient Overpass
timeout can make SW3's schools/amenities momentarily vanish. That is a DATA-FETCH
reliability issue, not a rendering one, and must not be "fixed" by more hiding. A correct
empty-vs-failed distinction needs the pipeline to signal fetch-failure separately, plus
live testing — flagged, not guessed.

## Per-postcode expectation (by construction — NOT run live here)
- **SW3 1AA** and **Stockwell/Oval postcode**: schools, amenities, stations, both maps,
  rental demand all render exactly as before this work. The maps are gated only on
  `report.lat && report.lng` (untouched), so they render whenever the postcode resolves to
  coordinates. The only possible change: if the nearest DEFRA monitor reports NO₂ but not
  PM2.5, that one PM2.5 tile is omitted (Rating + NO₂ stay). No section is hidden.
