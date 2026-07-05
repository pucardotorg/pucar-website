#!/usr/bin/env node
/*
  Self-host the Resources page thumbnails:
    - blog article thumbs from framerusercontent.com  -> assets/blog/<slug>.<ext>
    - learning circle video thumbs from i.ytimg.com   -> assets/circles/<id>.jpg

  Run locally (needs internet, Node 18+; the agent sandbox cannot reach
  either CDN — same as the other mirror scripts):
    node scripts/mirror-resource-thumbs.js

  Safe to re-run; skips files that already exist.
*/
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");

const blog = JSON.parse(fs.readFileSync(path.join(ROOT, "content/resources/blog.json"), "utf8"));
const circles = JSON.parse(fs.readFileSync(path.join(ROOT, "content/resources/circles.json"), "utf8"));

const jobs = [];
blog.forEach(function (b) {
  jobs.push({
    url: "https://framerusercontent.com/images/" + b.remote,
    dest: path.join(ROOT, b.thumb.replace(/^\//, ""))
  });
});
circles.forEach(function (c) {
  jobs.push({
    url: "https://i.ytimg.com/vi/" + c.id + "/hqdefault.jpg",
    dest: path.join(ROOT, c.thumb.replace(/^\//, ""))
  });
});

(async function () {
  let done = 0, skipped = 0, failed = [];
  for (const j of jobs) {
    fs.mkdirSync(path.dirname(j.dest), { recursive: true });
    if (fs.existsSync(j.dest)) { skipped++; continue; }
    try {
      const res = await fetch(j.url);
      if (!res.ok) throw new Error("HTTP " + res.status);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 500) throw new Error("suspiciously small");
      fs.writeFileSync(j.dest, buf);
      done++;
      console.log("✓ " + path.basename(j.dest) + " (" + Math.round(buf.length / 1024) + " KB)");
    } catch (e) {
      failed.push(path.basename(j.dest) + ": " + e.message);
    }
  }
  console.log("\n" + done + " downloaded, " + skipped + " already present" +
    (failed.length ? ", FAILED:\n  " + failed.join("\n  ") : ""));
  if (done) console.log("\nCommit:\n  git add -A && git commit -m \"Self-host resource thumbnails\" && git push");
})();
