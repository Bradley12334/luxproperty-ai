/**
 * scripts/warm-districts.mjs — post-cutover L2 WARMING PASS (read-only vs code).
 *
 * Warms the production durable L2 cache for every E&W district by hitting the LIVE
 * https://www.luxproperty.ai/api/brief once per district (each cold hit runs the
 * SPARQL scan and writes the durable cache on the Vercel side). Polite + resumable.
 *
 *   node scripts/warm-districts.mjs
 *
 * POLITENESS: concurrency 4, 300ms stagger between dispatches, ≤3 attempts/district
 * (retry only on the retryable price-UNAVAILABLE tail, 3s backoff).
 * RESUMABLE: appends each outcome to /tmp/warming-progress.jsonl; on restart it skips
 * districts already recorded WARMED. Safe to Ctrl-C and re-run.
 */
import fs from "fs";
const BASE = "https://www.luxproperty.ai";
const PROGRESS = "/tmp/warming-progress.jsonl";
const CONCURRENCY = 4;
const STAGGER_MS = 300;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const sweep = JSON.parse(fs.readFileSync("/tmp/district-sweep.json", "utf8"));
const districts = sweep.resolvedOutcodes;

const done = new Set();
if (fs.existsSync(PROGRESS)) {
  for (const line of fs.readFileSync(PROGRESS, "utf8").split("\n").filter(Boolean)) {
    try { const r = JSON.parse(line); if (r.outcome === "WARMED") done.add(r.district); } catch {}
  }
}
const todo = districts.filter((d) => !done.has(d));
console.log(`WARMING PASS — total ${districts.length}, already warmed ${done.size}, to do ${todo.length}`);
console.log(`concurrency ${CONCURRENCY}, stagger ${STAGGER_MS}ms, ≤3 attempts/district\n`);

async function realPostcode(oc) {
  for (let i = 0; i < 4; i++) {
    const r = await fetch(`https://api.postcodes.io/random/postcodes?outcode=${oc}`).then((x) => x.json()).catch(() => null);
    if (r?.result?.postcode) return r.result.postcode;
    await sleep(200);
  }
  return null;
}

async function warmOne(oc) {
  const pc = await realPostcode(oc);
  if (!pc) return { district: oc, outcome: "FAILED", reason: "no-postcode" };
  for (let attempt = 1; attempt <= 3; attempt++) {
    const t0 = Date.now();
    try {
      // skipOverpass=1 — warm the SPARQL transaction cache + non-rate-limited source
      // caches only. Overpass is NEVER called (organic traffic fills it via the combined
      // query), so warming cannot re-trigger the per-IP Overpass rate limit.
      const res = await fetch(`${BASE}/api/brief?postcode=${encodeURIComponent(pc)}&skipOverpass=1`, { signal: AbortSignal.timeout(120000) });
      const j = await res.json().catch(() => null);
      const ms = Date.now() - t0;
      const price = (j?.sections || []).find((s) => s.key === "pricesTrendNegotiation")?.state;
      const de = j?.meta?.dataError;
      if (j?.ok && price && price !== "UNAVAILABLE") {
        return { district: oc, postcode: pc, outcome: "WARMED", ms, tx: j.meta.transactionCount, price };
      }
      if (de?.retryable && attempt < 3) { await sleep(3000); continue; }
      return { district: oc, postcode: pc, outcome: "FAILED", reason: de ? de.code : (price || "no-price"), ms };
    } catch (e) {
      if (attempt < 3) { await sleep(3000); continue; }
      return { district: oc, postcode: pc, outcome: "FAILED", reason: String(e.name || e).slice(0, 40) };
    }
  }
}

let idx = 0, warmed = 0, failed = 0;
async function worker() {
  while (idx < todo.length) {
    const oc = todo[idx++];
    await sleep(STAGGER_MS);
    const r = await warmOne(oc);
    fs.appendFileSync(PROGRESS, JSON.stringify(r) + "\n");
    if (r.outcome === "WARMED") warmed++; else failed++;
    if ((warmed + failed) % 50 === 0) {
      console.log(`  ${warmed + failed}/${todo.length} · warmed ${warmed} · failed ${failed}`);
    }
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));

// Final summary from the full progress file (resumable-aware)
const all = fs.readFileSync(PROGRESS, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
const w = all.filter((r) => r.outcome === "WARMED");
const f = all.filter((r) => r.outcome === "FAILED");
const byReason = {};
for (const x of f) byReason[x.reason] = (byReason[x.reason] || 0) + 1;
const times = w.map((r) => r.ms).filter(Boolean).sort((a, b) => a - b);
const pct = (q) => times.length ? (times[Math.floor(q * times.length)] / 1000).toFixed(1) + "s" : "—";
console.log(`\n═══ WARMING COMPLETE ═══`);
console.log(`WARMED: ${w.length} / ${districts.length}`);
console.log(`FAILED: ${f.length}  reasons=${JSON.stringify(byReason)}`);
console.log(`cold times p50=${pct(0.5)} p90=${pct(0.9)} p99=${pct(0.99)}`);
if (f.length) console.log(`failed districts: ${f.map((x) => x.district).join(", ")}`);
