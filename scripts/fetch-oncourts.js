#!/usr/bin/env node
/* =========================================================================
   PUCAR — daily refresh of the DRISTI stat numbers from the PUBLIC
   ON Courts dashboard (https://oncourts.kerala.gov.in/dashboard).

   That dashboard is a Metabase public embed. Each stat is a "card" served
   as JSON from a no-auth endpoint:
     /pucar-dashboard/api/public/dashboard/<uuid>/dashcard/<dash>/card/<card>?parameters=[]
   Metabase answers 202 while the query runs, then 200 with the result, so
   we poll. The dashcard/card IDs below were captured from the live
   dashboard's network calls.

   Writes content/dristi-stats.json (read at build time by build-jobs.js,
   with hardcoded fallbacks). On failure for any field we KEEP the previous
   value, so the file never degrades to garbage. Run by the daily GitHub
   Action .github/workflows/oncourts-refresh.yml. Node 18+ (global fetch).
   ========================================================================= */
"use strict";
const fs = require("fs");
const path = require("path");

const OUT  = path.join(__dirname, "..", "content", "dristi-stats.json");
const UUID = "9b1eaaa1-9f5c-415e-81db-6e8c2388ad0c";
const BASE = "https://oncourts.kerala.gov.in/pucar-dashboard/api/public/dashboard/" + UUID;

/* field on the page  ->  [dashcardId, cardId] on the Metabase dashboard.
   "hearingsHeldPct" (the 98% card) has no matching public card, so it is
   left untouched (kept from the existing JSON / fallback). */
const CARDS = {
  filed:              [1789, 1125], // Total Cases Filed
  timeToDisposalDays: [1800, 1134], // Time to Disposal (days)
  hearingsToDisposal: [1840, 1167], // Hearings to Disposal
  advocates:          [1804, 1143], // Unique Advocates Using ON Court
  litigants:          [1801, 1141]  // Citizens Using ON Courts
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const HDRS = {
  "accept": "application/json",
  "user-agent": "Mozilla/5.0 (compatible; PUCAR-bot/1.0; +https://pucar.netlify.app)"
};

async function fetchScalar(field, dash, card) {
  // NOTE: brackets MUST be percent-encoded (%5B%5D); a literal "[]" is rejected.
  const url = BASE + "/dashcard/" + dash + "/card/" + card + "?parameters=%5B%5D";
  let last = 0;
  // 202 = Metabase is still computing this card. First run is slow; results
  // get cached server-side, so later daily runs return 200 quickly. Poll up
  // to ~4 min per card (all cards run in parallel, so wall time ≈ one card).
  for (let i = 0; i < 80; i++) {
    const ctl = new AbortController();
    const to = setTimeout(() => ctl.abort(), 25000); // per-request timeout
    let res;
    try { res = await fetch(url, { signal: ctl.signal, headers: HDRS }); }
    catch (e) { clearTimeout(to); if (i === 0) console.error("  " + field + ": fetch error " + (e && e.message)); await sleep(2500); continue; }
    clearTimeout(to);
    last = res.status;
    // This Metabase returns 202 *with the full result body already populated*
    // (not an empty "still running" envelope), so parse the body on 202 too.
    if (res.status === 200 || res.status === 202) {
      let j = null; try { j = await res.json(); } catch (e) {}
      const rows = j && j.data && j.data.rows;
      if (rows && rows.length && rows[0].length) {
        const v = Number(rows[0][0]);
        if (Number.isFinite(v)) return v;
      }
      // Genuinely empty body: 200 → give up; 202 → still computing, retry.
      if (res.status === 200) { console.error("  " + field + ": 200 but no numeric row"); return null; }
      await sleep(2500);
      continue;
    }
    if (res.status >= 400 && res.status !== 429) { console.error("  " + field + ": HTTP " + res.status + " (giving up)"); return null; }
    // 429 / 5xx: wait and retry
    await sleep(2500);
  }
  console.error("  " + field + ": no result after retries (last status " + last + ")");
  return null;
}

(async () => {
  let prev = {};
  try { prev = JSON.parse(fs.readFileSync(OUT, "utf8")); } catch (e) {}
  const out = Object.assign({}, prev);

  // Fetch all cards in PARALLEL so the whole run is ~one card's wait (<1 min),
  // not the sum of five. Each still falls back to the previous value on failure.
  const results = [];
  await Promise.all(Object.keys(CARDS).map(async function (field) {
    const dash = CARDS[field][0], card = CARDS[field][1];
    const before = prev[field];
    const v = await fetchScalar(field, dash, card);
    if (v == null) { results.push({ field, state: "FAILED", before, after: before }); return; }
    const after = Math.round(v);
    out[field] = after;
    results.push({ field, state: (Number(before) === after ? "unchanged" : "updated"), before, after });
  }));

  const nUpdated = results.filter(r => r.state === "updated").length;
  const nSame    = results.filter(r => r.state === "unchanged").length;
  const nFailed  = results.filter(r => r.state === "FAILED").length;

  console.log("\n===== ON Courts sync report =====");
  results.sort((a, b) => a.field.localeCompare(b.field)).forEach(function (r) {
    if (r.state === "updated")   console.log("  ~ " + r.field + ":  " + r.before + "  ->  " + r.after);
    else if (r.state === "unchanged") console.log("  = " + r.field + ":  " + r.after + "  (no change)");
    else console.log("  x " + r.field + ":  FAILED — kept " + r.before);
  });
  console.log("  ---");
  console.log("  " + nUpdated + " updated, " + nSame + " unchanged, " + nFailed + " failed");
  console.log("=================================\n");

  if (nUpdated + nSame === 0) {
    console.error("Every fetch failed — leaving content/dristi-stats.json unchanged (site keeps last-good numbers).");
    process.exit(1);
  }

  out.source = "https://oncourts.kerala.gov.in/dashboard";
  out.updated = new Date().toISOString();
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + "\n");
  console.log("Wrote " + OUT);
})();
