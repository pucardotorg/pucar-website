#!/usr/bin/env node
/*
  Self-host the FUNDING CONTRIBUTORS logos from pucar.org/about.

  The 14 logos below were identified visually from the site's funding
  ticker (July 2026, in ticker order). Downloads each into
  assets/funders/<slug>.png.

  Run locally (needs internet, Node 18+; the agent sandbox cannot reach
  framerusercontent.com — same as mirror-contributor-photos.js):
    node scripts/mirror-funder-logos.js

  Safe to re-run; skips files that already exist.
*/
const fs = require("fs");
const path = require("path");

const BASE = "https://framerusercontent.com/images/";
const LOGOS = [
  ["binny-bansal",                "XfiS6ZWKzNfiV1vtHPGORuE.png"],
  ["nilekani-philanthropies",     "JxtuHpbPDTMdvnhEedWBcx92I.png"],
  ["tree-of-life-foundation",     "HOSIVZ0EIEG8OdGLWGyQYizYnB0.png"],
  ["ravi-venkatesan",             "BxtEhPL4zMUdRx8humR5sv5Nk.png"],
  ["harish-bina-shah-foundation", "QzldhECBfHz1wvWABY1IxY6KjA.png"],
  ["trilegal",                    "Fq9TmGNxlqFJcphhQhHBcKuK5Q.png"],
  ["lal-foundation",              "eVnZGvWbvKPJFW5MhevK1X6xNw.png"],
  ["cyrus-j-guzder",              "XbifVM9NLlzHkYdXGNJ6RUIhs.png"],
  ["godrej",                      "foJem5Wwe61ajRg5bQ6RwQKnw4.png"],
  ["spectrum-impact",             "84Adb0DBpSJZeUQIgj6Ph4ZzGOM.png"],
  ["c-s-vaidyanathan",            "o1h6lAYFZ70myZpfsChOPAwmYE.png"],
  ["ajit-issac",                  "N4XR5kjjNZrnMWTQn9wctH8DQ.png"],
  ["mahesh-krishnamurthy",        "vHQeJqk0Dnwj7XtmxwiDtLGu6w.png"],
  ["amita-gupta",                 "iulapEoBYegdPkItGlU5MNZFlQ.png"]
];

const OUT = path.join(__dirname, "..", "assets", "funders");
fs.mkdirSync(OUT, { recursive: true });

(async function () {
  let done = 0, skipped = 0, failed = [];
  for (const [slug, file] of LOGOS) {
    const dest = path.join(OUT, slug + ".png");
    if (fs.existsSync(dest)) { skipped++; continue; }
    try {
      const res = await fetch(BASE + file);
      if (!res.ok) throw new Error("HTTP " + res.status);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 200) throw new Error("suspiciously small");
      fs.writeFileSync(dest, buf);
      done++;
      console.log("✓ " + slug + " (" + Math.round(buf.length / 1024) + " KB)");
    } catch (e) {
      failed.push(slug + ": " + e.message);
    }
  }
  console.log("\n" + done + " downloaded, " + skipped + " already present" +
    (failed.length ? ", FAILED:\n  " + failed.join("\n  ") : ""));
  if (done) console.log("\nCommit:\n  git add -A && git commit -m \"Self-host funder logos\" && git push");
})();
