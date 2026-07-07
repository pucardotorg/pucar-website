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

async function fetchScalar(dash, card) {
  const url = BASE + "/dashcard/" + dash + "/card/" + card + "?parameters=[]";
  for (let i = 0; i < 40; i++) { // ~2 min max
    let res;
    try { res = await fetch(url, { headers: { accept: "application/json" } }); }
    catch (e) { await sleep(3000); continue; }
    if (res.status === 200) {
      let j; try { j = await res.json(); } catch (e) { return null; }
      const rows = j && j.data && j.data.rows;
      if (rows && rows.length && rows[0].length) {
        const v = Number(rows[0][0]);
        if (Number.isFinite(v)) return v;
      }
      return null;
    }
    // 202 (still running) or a transient status: wait and retry
    await sleep(3000);
  }
  return null;
}

(async () => {
  let prev = {};
  try { prev = JSON.parse(fs.readFileSync(OUT, "utf8")); } catch (e) {}
  const out = Object.assign({}, prev);

  let ok = 0, fail = 0;
  for (const field of Object.keys(CARDS)) {
    const [dash, card] = CARDS[field];
    const v = await fetchScalar(dash, card);
    if (v == null) { console.error("FAIL " + field + " (card " + card + ") — keeping " + prev[field]); fail++; continue; }
    out[field] = Math.round(v);
    ok++;
    console.log("OK   " + field + " = " + out[field]);
  }

  if (ok === 0) {
    console.error("All fetches failed — leaving content/dristi-stats.json unchanged.");
    process.exit(1);
  }

  out.source = "https://oncourts.kerala.gov.in/dashboard";
  out.updated = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + "\n");
  console.log("Wrote " + OUT + "  (" + ok + " updated, " + fail + " kept as fallback)");
})();
