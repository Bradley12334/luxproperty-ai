/**
 * scripts/live-diagnose.mjs — LIVE production diagnosis (read-only, no code changes).
 * Hits the REAL https://www.luxproperty.ai/api/brief anonymously, timed, and prints
 * meta (cache read/write, tx count, dataError/retryable) + per-section states.
 */
const BASE = "https://www.luxproperty.ai";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function realPostcode(outcode) {
  for (let i = 0; i < 5; i++) {
    const r = await fetch(`https://api.postcodes.io/random/postcodes?outcode=${outcode}`).then((x) => x.json()).catch(() => null);
    if (r?.result?.postcode) return r.result.postcode;
    await sleep(200);
  }
  return null;
}

async function timeBrief(postcode, label) {
  const url = `${BASE}/api/brief?postcode=${encodeURIComponent(postcode)}`;
  const t0 = Date.now();
  let res, json, err = null;
  try {
    res = await fetch(url, { headers: { Accept: "application/json" } });
    json = await res.json().catch(() => null);
  } catch (e) { err = String(e); }
  const ms = Date.now() - t0;
  const meta = json?.meta || {};
  const sections = json?.sections || [];
  const byState = {};
  const unavailable = [];
  for (const s of sections) {
    byState[s.state] = (byState[s.state] || 0) + 1;
    if (s.state === "UNAVAILABLE") unavailable.push(s.key);
  }
  console.log(`\n── ${label}: ${postcode} ──`);
  console.log(`  HTTP ${res?.status ?? "ERR"} · total ${(ms / 1000).toFixed(1)}s${err ? " · ERROR " + err : ""}`);
  console.log(`  ok=${json?.ok} · tier=${meta.tier} · txCount=${meta.transactionCount} · truncated=${meta.truncated}`);
  console.log(`  cache: cached=${meta.cached} · cacheLayer=${meta.cacheLayer ?? "—"}`);
  console.log(`  dataError=${meta.dataError ? JSON.stringify(meta.dataError) : "null"}`);
  console.log(`  sections: ${sections.length} · byState=${JSON.stringify(byState)}`);
  if (unavailable.length) console.log(`  UNAVAILABLE sections: ${unavailable.join(", ")}`);
  // price section specifically
  const price = sections.find((s) => s.key === "pricesTrendNegotiation");
  console.log(`  price section state: ${price?.state ?? "(absent)"}`);
  return { postcode, ms, status: res?.status, meta, byState, unavailable };
}

(async () => {
  console.log("LIVE DIAGNOSIS — non-London cold briefs vs www.luxproperty.ai (post-truncate)\n");
  const targets = [
    ["NG1", "Midlands (Nottingham)"],
    ["NE1", "North (Newcastle)"],
    ["LD3", "Rural (Brecon, Wales)"],
  ];
  const picks = [];
  for (const [oc, label] of targets) {
    const pc = await realPostcode(oc);
    console.log(`  ${label}: ${oc} → ${pc}`);
    picks.push({ pc, label });
  }

  console.log("\n═══ COLD RUNS (each district cold after Stage-3 truncate) ═══");
  const cold = [];
  for (const { pc, label } of picks) {
    if (!pc) { console.log(`  (skip ${label} — no postcode)`); continue; }
    cold.push(await timeBrief(pc, `COLD ${label}`));
  }

  console.log("\n═══ WARM RE-RUN (immediately repeat the first) ═══");
  if (picks[0]?.pc) await timeBrief(picks[0].pc, `WARM ${picks[0].label}`);

  console.log("\n═══ SUMMARY ═══");
  for (const c of cold) console.log(`  ${c.postcode.padEnd(9)} ${(c.ms/1000).toFixed(1)}s  states=${JSON.stringify(c.byState)}  dataError=${c.meta.dataError?"YES("+c.meta.dataError.code+")":"no"}  cached=${c.meta.cached}`);
})();
