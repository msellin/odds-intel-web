#!/usr/bin/env node
/**
 * COMP-FALLBACK-DRIFT-GUARD — fail CI when the landing's hardcoded competitor
 * numbers have rotted away from the engine's published ledger.
 *
 * Why this exists (2026-09-02): COMP_FALLBACK is what the landing renders when
 * the request-time fetch of the engine ledger fails. It was supposed to be kept
 * current by the engine's daily audit workflow, which runs
 * update_frontend_comp_fallback.py and pushes here. That push is gated on a
 * cross-repo PAT, and when the PAT is absent the step exits 0 with a log line.
 * So it never ran. The fallback sat on the 2026-07-05 snapshot for two months
 * and drifted into claims that were simply false — Tipstrr was published as
 * -5.22% ROI when the ledger had them at +1.49%. A sign error about a named
 * competitor, on the page whose entire pitch is that our numbers are auditable.
 *
 * The guard deliberately lives HERE rather than in the engine: this repo owns
 * the published claim, and the ledger is public, so checking it needs no PAT
 * and cannot be skipped for want of a credential. A network failure fails the
 * job — that is the point. Silent success is the bug being fixed.
 *
 *   node scripts/check_comp_fallback.mjs
 */
import { readFileSync } from "node:fs";

const LEDGER =
  "https://raw.githubusercontent.com/msellin/odds-intel-engine/main/ledger";
// TOLERANCES. The fallback cannot track the ledger exactly: the ledger is
// rebuilt daily (our matched cohort grows every day we place bets), while
// page.tsx only changes when someone commits here. An exact-match guard would
// be red every single morning, and a guard that is always red is a guard
// nobody reads.
//
// So the guard asks the question the fallback actually has to answer: if the
// request-time fetch fails and we serve these numbers instead, are they still
// HONEST? Daily wobble is fine. A sign flip is not, and neither is a snapshot
// from two months ago.
//
// Calibrated against the real 2026-09-02 drift, where every one of the five
// stale sources is caught: tipstrr -5.22 vs +1.49 (6.7pp) and signalodds
// -0.44 vs -6.44 (6.0pp) trip the ROI bound; forebet (2.9pp) and winnerodds
// (2.0pp) slip under it but are caught by MAX_AGE_DAYS on a 59-day-old stamp.
// The age check is the backstop that makes the whole thing sound.
const ROI_TOL = Number(process.env.COMP_ROI_TOL ?? 3.0);   // percentage points
const N_TOL_FRAC = Number(process.env.COMP_N_TOL ?? 0.25); // relative
const MAX_AGE_DAYS = Number(process.env.COMP_MAX_AGE_DAYS ?? 30);

const src = readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");
const block = src.slice(
  src.indexOf("const COMP_FALLBACK"),
  src.indexOf("const LEDGER_RAW"),
);
if (!block) {
  console.error("COMP_FALLBACK block not found in page.tsx");
  process.exit(1);
}

const re =
  /(\w+):\s*\{\s*theirN:\s*(\d+),\s*theirRoi:\s*(-?[\d.]+),[\s\S]*?snapshotAt:\s*"([\d-]+)"\s*\}/g;
const claims = [...block.matchAll(re)].map((m) => ({
  key: m[1],
  theirN: Number(m[2]),
  theirRoi: Number(m[3]),
  snapshotAt: m[4],
}));

if (claims.length === 0) {
  console.error("parsed 0 entries from COMP_FALLBACK — the shape changed");
  process.exit(1);
}


// Reading the ledger: API first, raw as fallback.
//
// raw.githubusercontent serves with max-age=300 and its cache key IGNORES the
// query string, so a cache-bust parameter does nothing (verified 2026-09-02) —
// it will happily serve the previous ledger for five minutes after an engine
// push. Since the normal workflow is "push engine, then push web", the
// push-triggered run would fail on numbers that are already correct, and a
// guard that goes red when nothing is wrong is one you learn to ignore.
//
// The contents API reflects a push immediately. It is rate-limited (60/hr
// unauthenticated, 1000/hr with a token) and this needs 5 calls per run, so
// the limit is not a real constraint; GITHUB_TOKEN is used when present purely
// for headroom. raw stays as the fallback for the case where the API is
// unreachable — there staleness is still better than no check, and the age
// bound below is what catches a genuinely dead sync anyway.
const API =
  "https://api.github.com/repos/msellin/odds-intel-engine/contents/ledger";

async function fetchLedger(key) {
  const headers = {
    Accept: "application/vnd.github.raw",
    "User-Agent": "oddsintel-comp-fallback-guard",
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  try {
    const res = await fetch(`${API}/comparison_${key}.json?ref=main`, { headers });
    if (res.ok) return JSON.parse(await res.text());
    console.error(`  ${key}: contents API ${res.status}, falling back to raw`);
  } catch (e) {
    console.error(`  ${key}: contents API error (${e.message}), falling back to raw`);
  }
  try {
    const res = await fetch(`${LEDGER}/comparison_${key}.json`, { cache: "no-store" });
    if (res.ok) return await res.json();
    console.error(`  ${key}: raw fetch ${res.status}`);
  } catch (e) {
    console.error(`  ${key}: raw fetch error ${e.message}`);
  }
  return null;
}

const problems = [];
for (const c of claims) {
  // raw.githubusercontent caches for ~5 minutes. Without a cache-bust this
  // guard reads the PREVIOUS ledger for several minutes after an engine push,
  // and since the usual workflow is "push engine, then push web", the
  // push-triggered run would fail on numbers that are already correct. A
  // spuriously red guard is worse than no guard: it trains you to ignore it.
  // The daily 07:00 UTC run is 5h after the engine's 02:00 audit and never
  // races, but the push run does.
  const j = await fetchLedger(c.key);
  if (j === null) {
    problems.push(`${c.key}: ledger fetch failed (see log above)`);
    continue;
  }
  const t = j.their_stats ?? {};

  const roiGap = Math.abs((t.roi_pct ?? NaN) - c.theirRoi);
  const nGap = t.n ? Math.abs(t.n - c.theirN) / t.n : 1;
  const ageDays =
    (Date.now() - Date.parse(`${c.snapshotAt}T00:00:00Z`)) / 86_400_000;

  // A sign flip is always a problem, however small the gap: publishing a
  // competitor as losing money when they are making it is the specific
  // falsehood this guard exists to stop.
  const signFlip =
    Number.isFinite(t.roi_pct) &&
    Math.sign(t.roi_pct) !== Math.sign(c.theirRoi) &&
    Math.max(Math.abs(t.roi_pct), Math.abs(c.theirRoi)) >= 1.0;

  if (signFlip) {
    problems.push(
      `${c.key}: SIGN FLIP — landing publishes ROI=${c.theirRoi}%, ledger says ${t.roi_pct}%`,
    );
  } else if (roiGap > ROI_TOL) {
    problems.push(
      `${c.key}: ROI off by ${roiGap.toFixed(2)}pp (landing ${c.theirRoi}%, ledger ${t.roi_pct}%)`,
    );
  }
  if (nGap > N_TOL_FRAC) {
    problems.push(
      `${c.key}: bet count off by ${(nGap * 100).toFixed(0)}% (landing ${c.theirN}, ledger ${t.n})`,
    );
  }
  if (ageDays > MAX_AGE_DAYS) {
    problems.push(
      `${c.key}: fallback snapshot is ${ageDays.toFixed(0)} days old (${c.snapshotAt}) — the sync has stopped running`,
    );
  }

  const ok = !problems.some((p) => p.startsWith(`${c.key}:`));
  console.log(
    `  ${c.key.padEnd(12)} ledger n=${String(t.n).padStart(5)} roi=${String(t.roi_pct).padStart(7)}%` +
      `  | landing ${String(c.theirN).padStart(5)} ${String(c.theirRoi).padStart(7)}%` +
      `  age ${ageDays.toFixed(0)}d  ${ok ? "ok" : "DRIFT"}`,
  );
}

if (problems.length) {
  console.error(
    `\nCOMP_FALLBACK has drifted from the engine ledger:\n` +
      problems.map((p) => `  - ${p}`).join("\n") +
      `\n\nFix: in the engine repo run\n` +
      `  python3 scripts/update_frontend_comp_fallback.py --web-repo ../odds-intel-web\n` +
      `then commit page.tsx here.\n`,
  );
  process.exit(1);
}
console.log(`\nCOMP_FALLBACK matches the ledger for all ${claims.length} sources.`);
