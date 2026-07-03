#!/usr/bin/env node
/*
  Self-host contributor photos.

  Downloads every content/contributors/*.json photo that still points at
  framerusercontent.com into assets/contributors/<slug>.<ext>, then rewrites
  the JSON's "photo" field to the local path.

  Run locally (needs normal internet access, Node 18+ for fetch):
    node scripts/mirror-contributor-photos.js

  Safe to re-run: already-local photos are skipped, failed downloads leave
  the JSON untouched so nothing breaks.
*/
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SRC = path.join(ROOT, "content", "contributors");
const OUT = path.join(ROOT, "assets", "contributors");
fs.mkdirSync(OUT, { recursive: true });

const files = fs.readdirSync(SRC).filter(function (f) { return f.endsWith(".json"); });

(async function () {
  let done = 0, skipped = 0, failed = [];
  for (const f of files) {
    const file = path.join(SRC, f);
    const person = JSON.parse(fs.readFileSync(file, "utf8"));
    if (!person.photo || !/^https?:\/\//.test(person.photo)) { skipped++; continue; }
    const slug = f.replace(/\.json$/, "");
    const ext = (person.photo.split(".").pop().split("?")[0] || "jpg").toLowerCase();
    const local = "assets/contributors/" + slug + "." + ext;
    try {
      const res = await fetch(person.photo);
      if (!res.ok) throw new Error("HTTP " + res.status);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 500) throw new Error("suspiciously small response");
      fs.writeFileSync(path.join(ROOT, local), buf);
      person.photo = "/" + local;
      fs.writeFileSync(file, JSON.stringify(person, null, 2) + "\n");
      done++;
      process.stdout.write("✓ " + slug + " (" + Math.round(buf.length / 1024) + " KB)\n");
    } catch (e) {
      failed.push(slug + ": " + e.message);
    }
  }
  console.log("\n" + done + " downloaded, " + skipped + " already local/no photo" +
    (failed.length ? ", FAILED:\n  " + failed.join("\n  ") : ""));
  if (done) console.log("\nNow rebuild + commit:\n  node scripts/build-jobs.js\n  git add -A && git commit -m \"Self-host contributor photos\" && git push");
})();
